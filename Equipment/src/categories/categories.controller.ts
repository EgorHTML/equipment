import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get()
  async findAll() {
    return await this.categoriesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.categoriesService.findOne(id);
  }

  @Post()
  async create(@Body() data: CreateCategoryDto) {
    return this.categoriesService.create(data);
  }

  @Patch(':id')
  async update(
    @Body() data: UpdateCategoryDto,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.categoriesService.update(data, id);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.categoriesService.remove(id);
  }
}
