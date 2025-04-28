import {
  createParamDecorator,
  ExecutionContext,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { ProcessedFile } from '../interfaces/processed-file.interface';

interface FastifyMultipartPart {
  type: 'field' | 'file';
  fieldname: string;
  value?: any; 
  filename?: string; 
  encoding?: string; 
  mimetype?: string; 
  file?: NodeJS.ReadableStream; 
  fields?: any; 
  toBuffer?: () => Promise<Buffer>; 
}

export interface MultipartData {
  fields: { [key: string]: any };
  files: Record<string, ProcessedFile | ProcessedFile[]>;
}

const logger = new Logger('MultipartDataDecorator');

async function processSingleFilePart(
  part: FastifyMultipartPart,
): Promise<ProcessedFile | null> {
  if (part && part.type === 'file' && typeof part.toBuffer === 'function') {
    const fileFieldname = part.fieldname;
    if (typeof fileFieldname !== 'string') {
      logger.warn(
        `Skipping file part with invalid fieldname: filename='${part.filename}'`,
      );
      return null;
    }
    try {
      const buffer = await part.toBuffer();
      const fileInfo: ProcessedFile = {
        fieldname: fileFieldname,
        originalname: part.filename || 'unknown', 
        encoding: part.encoding || '', 
        mimetype: part.mimetype || 'application/octet-stream', 
        buffer: buffer,
        size: buffer.length,
      };
      
      return fileInfo;
    } catch (error) {
      logger.error(
        `Failed to process file part '${fileFieldname}' to buffer: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to process uploaded file: ${part.filename || fileFieldname}`,
      );
    }
  }
  return null; 
}

export const MultipartData = createParamDecorator(
  async (data: unknown, ctx: ExecutionContext): Promise<MultipartData> => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const body = request.body as any;

    if (!request.isMultipart() || typeof body !== 'object' || body === null) {
      logger.warn(
        'Request is not multipart or body is not an object. Returning empty data.',
      );
      return { fields: {}, files: {} };
    }

    const result: MultipartData = { fields: {}, files: {} };

    for (const key in body) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        const partOrParts = body[key]; 

        if (Array.isArray(partOrParts)) {
          const processedFilesArray: ProcessedFile[] = [];
          let fieldNameFromArray: string | null = null;

          for (const part of partOrParts) {
            const processedFile = await processSingleFilePart(part);
            if (processedFile) {
              processedFilesArray.push(processedFile);
              if (!fieldNameFromArray) {
                fieldNameFromArray = processedFile.fieldname; 
              }
            } else {
              logger.warn(
                `Item in array for key '${key}' is not a processable file part.`,
              );
            }
          }

          if (processedFilesArray.length > 0 && fieldNameFromArray) {
            result.files[fieldNameFromArray] = processedFilesArray;
           
          } else if (processedFilesArray.length > 0) {
            logger.warn(
              `Could not determine fieldname for array of files under key '${key}'. Skipping.`,
            );
          }
        } else {
          const part = partOrParts;
          if (part && part.type === 'field' && part.value !== undefined) {
            const fieldName = part.fieldname || key;
            if (typeof fieldName === 'string') {
              logger.debug(`Processing field: ${fieldName} = ${part.value}`);
              result.fields[fieldName] = part.value;
            } else {
              logger.warn(
                `Skipping field part with invalid fieldname: key='${key}'`,
              );
            }
          } else {
            const processedFile = await processSingleFilePart(part);
            if (processedFile) {
              result.files[processedFile.fieldname] = processedFile;
           
            } else if (part && part.type !== 'field') {
              logger.warn(
                `Skipping unexpected single part in body: key='${key}', type='${part?.type}'`,
              );
            }
          }
        }
      }
    }
    return result;
  },
);
