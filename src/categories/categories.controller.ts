import { Body, Controller, Get } from '@nestjs/common';
import { ICategory } from './interfaces/category.interface';
import { CategoriesService } from './categories.service';
import { FindAllCategoryDto } from './dto/findAll-category.dto';

@Controller('categories')
export class CategoriesController{
    constructor(private categoriesService: CategoriesService) {}


    @Get()
    async findAll(@Body() findAllCategoryDto:FindAllCategoryDto): Promise<ICategory[]> {
        return await this.categoriesService.findAll(findAllCategoryDto.company_id)
      }
}