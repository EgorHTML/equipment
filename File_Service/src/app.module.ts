import { Module } from '@nestjs/common';
import { MinioModule } from './minio/minio.module';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config/configuration';

@Module({
  imports: [MinioModule, 
    ConfigModule.forRoot({    
    isGlobal: true,
    load: [configuration],
  }),],
})
export class AppModule {}


