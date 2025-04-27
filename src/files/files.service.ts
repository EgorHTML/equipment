import {
    Injectable,
    Inject,
    BadRequestException,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg'; 
import { PG_CONNECTION } from '../core/database/database.provider';
import { MinioService } from '../core/minio/minio.service';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { FileMetadata } from '../shared/interfaces/file-metadata.interface';
import { ProcessedFile } from '../core/interfaces/processed-file.interface'; 

@Injectable()
export class FilesService {
    private readonly logger = new Logger(FilesService.name);

    constructor(
        @Inject(PG_CONNECTION) private readonly pool: Pool,
        private readonly minioService: MinioService,
        private readonly configService: ConfigService,
    ) {}

    async uploadFile(
        file: ProcessedFile,
        uploadedById: number,
    ): Promise<FileMetadata> {
        if (!file || !file.buffer || !file.originalname || !file.mimetype || file.size === undefined) {
            throw new BadRequestException('Invalid or incomplete file data provided.');
        }

        const client = await this.pool.connect();
        let uniqueObjectName: string | null = null; 

        try {
            const fileExt = path.extname(file.originalname);
            uniqueObjectName = `${uuidv4()}${fileExt}`; 

            this.logger.debug(`Uploading ${file.originalname} as ${uniqueObjectName} to MinIO...`);
            await this.minioService.uploadFile(
                uniqueObjectName,
                file.buffer,
                file.size,
                { 'Content-Type': file.mimetype },
            );
            this.logger.debug(`File ${uniqueObjectName} uploaded to MinIO.`);

            const storageUrl = this.minioService.getFileUrl(uniqueObjectName);

            const insertFileSql = `
                INSERT INTO files (file_name, file_type, file_size, storage_url, uploaded_by)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, file_name, file_type, file_size, storage_url, uploaded_by, created_at;
            `;
            const fileResult = await client.query(insertFileSql, [
                file.originalname, 
                file.mimetype,
                file.size,
                storageUrl,
                uploadedById,
            ]);

            const newFile: FileMetadata = fileResult.rows[0];
            this.logger.log(`File metadata saved (ID: ${newFile.id}, Name: ${newFile.file_name}) by user ${uploadedById}`);
            return newFile;

        } catch (error) {
            this.logger.error(`Failed during uploadFile for ${file.originalname}: ${error.message}`, error.stack);

            if (uniqueObjectName) {
                 this.logger.warn(`Attempting to clean up uploaded file ${uniqueObjectName} from MinIO due to database error...`);
                 await this.minioService.deleteFile(uniqueObjectName).catch(cleanupError => {
                     this.logger.error(`Failed to clean up file ${uniqueObjectName} from MinIO: ${cleanupError.message}`);
                 });
            }
            if (error instanceof BadRequestException) throw error; 
            throw new InternalServerErrorException(`Failed to upload file ${file.originalname}`);
        } finally {
            client.release();
        }
    }

  
    async uploadAndLinkFiles(
        files: ProcessedFile[],
        equipmentId: number,
        uploadedById: number,
    ): Promise<number[]> {
        if (!files || files.length === 0) {
            throw new BadRequestException('At least one file is required.');
        }
        for (const file of files) {
            if (!file || !file.buffer || !file.originalname || !file.mimetype || file.size === undefined) {
                throw new BadRequestException(`Invalid or incomplete file data found in the batch for equipment ${equipmentId}.`);
            }
        }

        const client = await this.pool.connect();
        const uploadedFileIds: number[] = [];
        const uploadedObjectNames: string[] = [];

        try {
            await client.query('BEGIN');

            const checkEqSql = 'SELECT id FROM equipment WHERE id = $1 FOR UPDATE'; 
            const eqRes = await client.query(checkEqSql, [equipmentId]);
            if (eqRes.rowCount === 0) {
                throw new NotFoundException(`Equipment with id ${equipmentId} not found.`);
            }

            for (const file of files) {
                const fileExt = path.extname(file.originalname);
                const uniqueObjectName = `${uuidv4()}${fileExt}`;
                uploadedObjectNames.push(uniqueObjectName); 

                await this.minioService.uploadFile(
                    uniqueObjectName,
                    file.buffer,
                    file.size,
                    { 'Content-Type': file.mimetype },
                );
                const storageUrl = this.minioService.getFileUrl(uniqueObjectName);

                const insertFileSql = `
                    INSERT INTO files (file_name, file_type, file_size, storage_url, uploaded_by)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING id;
                `;
                const fileResult = await client.query(insertFileSql, [
                    file.originalname, file.mimetype, file.size, storageUrl, uploadedById,
                ]);
                const newFileId = fileResult.rows[0].id;

                const linkFileSql = 'INSERT INTO equipment_files (equipment_id, file_id) VALUES ($1, $2)';
                await client.query(linkFileSql, [equipmentId, newFileId]);

                uploadedFileIds.push(newFileId);
                this.logger.log(`File ${file.originalname} (ID: ${newFileId}) uploaded and linked to equipment ${equipmentId}`);
            }

            await client.query('COMMIT');
            this.logger.log(`Successfully uploaded and linked ${files.length} files for equipment ${equipmentId}. File IDs: [${uploadedFileIds.join(', ')}]`);
            return uploadedFileIds;

        } catch (error) {
            await client.query('ROLLBACK'); 
            this.logger.error(`Failed during batch file upload/link for equipment ${equipmentId}: ${error.message}`, error.stack);

            if (uploadedObjectNames.length > 0) {
                 this.logger.warn(`Attempting to clean up ${uploadedObjectNames.length} files from MinIO due to transaction rollback...`);
                 for (const objectName of uploadedObjectNames) {
                     await this.minioService.deleteFile(objectName).catch(cleanupError => {
                         this.logger.error(`Failed to clean up file ${objectName} from MinIO: ${cleanupError.message}`);
                     });
                 }
            }

            if (error instanceof NotFoundException) throw error;
            if (error.code === '23503' && error.constraint === 'equipment_files_equipment_id_fkey') {
                 throw new NotFoundException(`Equipment with id ${equipmentId} not found.`);
            }
             if (error.code === '23503' && error.constraint === 'equipment_files_file_id_fkey') {
                 this.logger.error(`Potential issue: Foreign key constraint violation on file_id during linking.`);
            }
            throw new InternalServerErrorException(`Failed to upload and link files for equipment ${equipmentId}`);
        } finally {
            client.release();
        }
    }

 
    async unlinkFileFromEquipment(equipmentId: number, fileId: number): Promise<void> {
        const client = await this.pool.connect();
        try {
            const deleteLinkSql = 'DELETE FROM equipment_files WHERE equipment_id = $1 AND file_id = $2 RETURNING file_id';
            const result = await client.query(deleteLinkSql, [equipmentId, fileId]);
            if (result.rowCount === 0) {
                this.logger.warn(`Link between equipment ${equipmentId} and file ${fileId} not found or already deleted.`);
                throw new NotFoundException(`Link between equipment ${equipmentId} and file ${fileId} not found.`);
            } else {
                this.logger.log(`Unlinked file ${fileId} from equipment ${equipmentId}`);
            }

        } catch(error) {
            this.logger.error(`Failed to unlink file ${fileId} from equipment ${equipmentId}: ${error.message}`, error.stack);
            if (error instanceof NotFoundException) throw error;
            throw new InternalServerErrorException('Failed to unlink file');
        } finally {
            client.release();
        }
    }

   
    async deleteFile(fileId: number): Promise<void> {
        const client = await this.pool.connect();
        let objectName: string | null = null;
        let fileNameDb: string | null = null;
        try {
            await client.query('BEGIN');

            const getFileInfoSql = 'SELECT storage_url, file_name FROM files WHERE id = $1 FOR UPDATE';
            const fileInfoResult = await client.query(getFileInfoSql, [fileId]);
            if (fileInfoResult.rowCount === 0) {
                this.logger.warn(`File with ID ${fileId} not found for deletion.`);
                await client.query('COMMIT'); 
                throw new NotFoundException(`File with ID ${fileId} not found.`);
            }
            const { storage_url, file_name } = fileInfoResult.rows[0];
            fileNameDb = file_name; 
            objectName = this.extractObjectNameFromUrl(storage_url); 

            const checkLinksSql = 'SELECT 1 FROM equipment_files WHERE file_id = $1 LIMIT 1';
            const linkResult = await client.query(checkLinksSql, [fileId]);
            if (linkResult.rowCount && linkResult.rowCount > 0) {
                throw new BadRequestException(`File ${fileId} ('${fileNameDb}') is still linked to equipment. Unlink first.`);
            }

            const deleteRecordSql = 'DELETE FROM files WHERE id = $1';
            await client.query(deleteRecordSql, [fileId]);
            this.logger.log(`Deleted file record ${fileId} ('${fileNameDb}') from database.`);

            if (objectName) {
                await this.minioService.deleteFile(objectName);
                this.logger.log(`Deleted file ${objectName} ('${fileNameDb}') from MinIO storage.`);
            } else {
                this.logger.warn(`Could not extract object name from URL: ${storage_url} for file ID ${fileId}. File might remain in storage.`);
            }

            await client.query('COMMIT'); 

        } catch (error) {
            await client.query('ROLLBACK'); 
            this.logger.error(`Failed to delete file ${fileId} ('${fileNameDb || 'N/A'}'): ${error.message}`, error.stack);

            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException(`Failed to delete file ${fileId}`);
        } finally {
            client.release();
        }
    }

     private extractObjectNameFromUrl(url: string): string | null {
        if (!url) return null;
        try {
            const parsedUrl = new URL(url);
            const bucketName = this.configService.get<string>('MINIO_BUCKET_NAME');
            const pathParts = parsedUrl.pathname.split('/');
            const bucketIndex = pathParts.findIndex(part => part === bucketName);

            if (bucketIndex !== -1 && bucketIndex + 1 < pathParts.length) {
                 return decodeURIComponent(pathParts.slice(bucketIndex + 1).join('/'));
            }
            this.logger.warn(`Could not extract object name: Bucket name '${bucketName}' mismatch or unexpected URL structure in ${url}`);
            return decodeURIComponent(pathParts[pathParts.length - 1]);
        } catch (e) {
            this.logger.error(`Error parsing URL to extract object name: ${url}`, e);
            return null;
        }
     }
}