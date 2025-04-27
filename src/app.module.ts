import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; 

import { DatabaseModule } from './core/database/database.module';
import { MinioModule } from './core/minio/minio.module';       

import { CategoriesModule } from './categories/categories.module';
import { EquipmentModule } from './equipment/equipment.module';
import { FilesModule } from './files/files.module';

import { configuration } from './config/configuration';


@Module({
  imports: [
    ConfigModule.forRoot({    
      isGlobal: true,
      load: [configuration],
    }),

    DatabaseModule,         
    MinioModule,            

    CategoriesModule,
    EquipmentModule,
    FilesModule,            

  ],
})
export class AppModule {}