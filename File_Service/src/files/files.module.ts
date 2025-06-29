import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { MinioModule } from '../minio/minio.module';

@Module({
    imports: [MinioModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService], 
})
export class FilesModule {}