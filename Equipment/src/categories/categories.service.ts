import {
  Injectable,
  Inject,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ICategory } from './interfaces/category.interface';
import { Repository } from 'typeorm';
import { Category } from './categories.entity';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);
  pool: any;

  constructor(
    @Inject('CATEGORY_REPOSITORY')
    private categoryProviders: Repository<Category>,
  ) {}

  async create(createDto: CreateCategoryDto): Promise<ICategory> {
    return this.categoryProviders.save(createDto);
  }

  async findAll(): Promise<ICategory[]> {
    return this.categoryProviders.find();
  }

  async findOne(id: number): Promise<any> {
    return this.categoryProviders.findOneBy({ id });
  }

  async update(data: UpdateCategoryDto, id: number): Promise<any> {
    const categoryToUpdate = await this.categoryProviders.findOneBy({
      id,
    });

    if(!categoryToUpdate) throw new NotFoundException()

    return this.categoryProviders.save({ ...categoryToUpdate, ...data });
  }

  async remove(id: number): Promise<Category[]> {
    const category = await this.findOne(id);

    return this.categoryProviders.remove(category);
  }
}
