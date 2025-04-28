import {
  Controller,
  Post,
  ParseIntPipe,
  Param,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FilesService } from './files.service';
// import { AuthUserId } from '../auth/decorators/auth-user-id.decorator'; // получения ID пользователя
import { MultipartData } from 'src/core/decorators/multipart-data.decorator';

@Controller('files')
export class FilesController {
  private readonly logger = new Logger(FilesController.name);
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  async uploadSingleFile(@MultipartData() data: MultipartData) {
    const userId = data.fields?.userId;
    const file = data.files.file;

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (userId === undefined || userId === null || isNaN(userId)) {
      this.logger.error(`Invalid or missing userId in request body.`);
      throw new BadRequestException(
        'userId is required in the request body and must be a number.',
      );
    }

    if (!Array.isArray(file)) return this.filesService.uploadFile(file, userId);
    else return new BadRequestException('file must be a single');
  }

  @Get(':id')
  async getFileMetadata(@Param('id', ParseIntPipe) id: number) {
    throw new Error('Method getFileMetadata not implemented.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFile(@Param('id', ParseIntPipe) id: number) {
    await this.filesService.deleteFile(id);
  }

  @Delete('unlink/equipment/:equipmentId/:fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlinkFile(
    @Param('equipmentId', ParseIntPipe) equipmentId: number,
    @Param('fileId', ParseIntPipe) fileId: number,
  ) {
    await this.filesService.unlinkFileFromEquipment(equipmentId, fileId);
  }

  @Post('link/equipment/:equipmentId')
  async linkFile(
    @MultipartData() data:MultipartData,
    @Param('equipmentId',ParseIntPipe) equipmentId
  ) {
    await this.filesService.uploadAndLinkFiles([data.files.file].flat(),equipmentId,1);
  }
}
