import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor( private categoriesService: CategoriesService) {}

  @Get()
  async findAll() {
    return await this.categoriesService.findAll();
  }

  @Post()
  async create(@Body() data: CreateCategoryDto) {
     return this.categoriesService.create(data)
  }
}
