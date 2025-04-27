import {
  createParamDecorator,
  ExecutionContext,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { ProcessedFile } from '../interfaces/processed-file.interface';

export interface MultipartData {
  fields: { [key: string]: any };
  files: Record<string, ProcessedFile | ProcessedFile[]>;
}

const logger = new Logger('MultipartDataDecorator');

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
        const part = body[key];

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
        } else if (
          part &&
          part.type === 'file' &&
          typeof part.toBuffer === 'function'
        ) {
          const fileFieldname = part.fieldname;
          if (typeof fileFieldname !== 'string') {
            logger.warn(
              `Skipping file part with invalid fieldname: key='${key}', filename='${part.filename}'`,
            );
            continue;
          }

          try {
            const buffer = await part.toBuffer();
            const fileInfo: ProcessedFile = {
              fieldname: fileFieldname,
              originalname: part.filename,
              encoding: part.encoding,
              mimetype: part.mimetype,
              buffer: buffer,
              size: buffer.length,
            };

            if (result.files[fileFieldname]) {
              if (Array.isArray(result.files[fileFieldname])) {
                (result.files[fileFieldname] as ProcessedFile[]).push(fileInfo);
              } else {
                result.files[fileFieldname] = [
                  result.files[fileFieldname] as ProcessedFile,
                  fileInfo,
                ];
              }
            } else {
              result.files[fileFieldname] = fileInfo;
            }
          } catch (error) {
            logger.error(
              `Failed to process file part '${key}' to buffer: ${error.message}`,
              error.stack,
            );
            throw new InternalServerErrorException(
              `Failed to process uploaded file: ${part.filename || key}`,
            );
          }
        }
      }
    }
    return result;
  },
);
