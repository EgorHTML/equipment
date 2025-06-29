import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { Category } from './categories.entity';
import { DataSource } from 'typeorm';
import { PG_CONNECTION } from 'src/core/database/database.provider';

@Module({
  controllers: [CategoriesController],
  providers: [
    CategoriesService,
    {
      provide: 'CATEGORY_REPOSITORY',
      useFactory: (dataSource: DataSource) =>
        dataSource.getRepository(Category),
      inject: [PG_CONNECTION],
    },
  ],
  exports: [CategoriesService],
})
export class CategoriesModule {}
