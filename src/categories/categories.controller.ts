import { Body, Controller, Get, Query, Res } from '@nestjs/common';
import { ICategory } from './interfaces/category.interface';
import { CategoriesService } from './categories.service';
import { FindAllCategoryDto } from './dto/findAll-category.dto';

@Controller('categories')
export class CategoriesController{
    constructor(private categoriesService: CategoriesService) {}


    @Get()
    async findAll(@Res() res) {
        res.send(await this.categoriesService.findAll())
      }
}