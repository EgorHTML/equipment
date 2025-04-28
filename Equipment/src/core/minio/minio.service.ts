import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { Readable } from 'stream';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly minioClient: Minio.Client;
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT')??'localhost',
      port: parseInt(this.configService.get<string>('MINIO_PORT') ?? '9000', 10),
      useSSL: this.configService.get<string>('MINIO_USE_SSL') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY'),
    });
    this.bucketName = this.configService.get<string>('MINIO_BUCKET_NAME') ?? 'dev';
  }

  async onModuleInit() {
    await this.ensureBucketExists();
  }

  private async ensureBucketExists() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        this.logger.log(`Bucket "${this.bucketName}" does not exist. Creating...`);
        await this.minioClient.makeBucket(this.bucketName);
        this.logger.log(`Bucket "${this.bucketName}" created successfully.`);
      } else {
        this.logger.log(`Bucket "${this.bucketName}" already exists.`);
      }
    } catch (err) {
      this.logger.error(`Error checking or creating bucket "${this.bucketName}":`, err);
      throw err; 
    }
  }

  async uploadFile(
    objectName: string,
    buffer: Buffer | Readable,
    size: number,
    metadata?: Minio.ItemBucketMetadata,
  ): Promise<any> {
    try {
      const metaData = {
        'Content-Type': metadata?.['Content-Type'] || 'application/octet-stream',
        ...metadata, 
      };
      const result = await this.minioClient.putObject(
          this.bucketName,
          objectName,
          buffer,
          size,
          metaData
      );
      this.logger.log(`File ${objectName} uploaded successfully. ETag: ${result.etag}`);
      return result;
    } catch (err) {
        this.logger.error(`Error uploading file ${objectName}:`, err);
        throw err;
    }
  }

  async deleteFile(objectName: string): Promise<void> {
      try {
          await this.minioClient.removeObject(this.bucketName, objectName);
          this.logger.log(`File ${objectName} deleted successfully.`);
      } catch (err) {
          this.logger.error(`Error deleting file ${objectName}:`, err);
      }
  }

  getFileUrl(objectName: string): string {
      const endpoint = this.configService.get<string>('MINIO_ENDPOINT');
      const port = this.configService.get<string>('MINIO_PORT');
      const useSSL = this.configService.get<string>('MINIO_USE_SSL') === 'true';
      const protocol = useSSL ? 'https' : 'http';
      return `${protocol}://${endpoint}:${port}/${this.bucketName}/${objectName}`;

      // Вариант с presigned URL (более безопасный для приватных бакетов)
      // return this.minioClient.presignedGetObject(this.bucketName, objectName, expiry_in_seconds);
  }
}
