import { Module } from '@nestjs/common';
import { CategoriesModule } from './categories/categories.module';
import { DatabaseModule } from './core/database/database.module';

@Module({
  imports: [CategoriesModule,DatabaseModule],
})
export class AppModule {}
