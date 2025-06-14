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
  pool:any

  constructor(
    @Inject('CATEGORY_REPOSITORY')
    private categoryProviders: Repository<Category>,
  ) {}

  async create(createDto: CreateCategoryDto): Promise<ICategory> {
    return this.categoryProviders.save(createDto)
  }

  async findAll(): Promise<ICategory[]> {
    return this.categoryProviders.find()
  }

  async findOne(id: number): Promise<any> {
    const client = await this.pool.connect();
    try {
      const sql = 'SELECT * FROM categories WHERE id = $1';
      const result = await client.query(sql, [id]);
      if (result.rowCount === 0) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }
      return result.rows[0];
    } catch (error) {
      this.logger.error(
        `Failed to find category ${id}: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to retrieve category');
    } finally {
      client.release();
    }
  }

  async update(id: number, updateDto: UpdateCategoryDto): Promise<any> {
    const client = await this.pool.connect();
    try {
      const fieldsToUpdate: string[] = [];
      const values = [id];
      let valueIndex = 2;

      Object.keys(updateDto).forEach((key) => {
        if (updateDto[key] !== undefined) {
          const snakeCaseKey = key.replace(
            /[A-Z]/g,
            (letter) => `_${letter.toLowerCase()}`,
          );
          fieldsToUpdate.push(`${snakeCaseKey} = $${valueIndex}`);
          values.push(updateDto[key]);
          valueIndex++;
        }
      });

      if (fieldsToUpdate.length === 0) {
        this.logger.warn(`Update called for category ${id} with no changes.`);
        return this.findOne(id);
      }

      if (updateDto.name) {
        const currentCategory = await this.findOne(id);
        const checkSql =
          'SELECT id FROM categories WHERE name = $1 AND company_id = $2 AND id != $3';
        const checkResult = await client.query(checkSql, [
          updateDto.name,
          updateDto.company_id ?? currentCategory.company_id,
          id,
        ]);
        if (checkResult.rowCount && checkResult.rowCount > 0) {
          throw new ConflictException(
            `Category with name "${updateDto.name}" already exists for this company.`,
          );
        }
      }

      const updateSql = `
                UPDATE categories
                SET ${fieldsToUpdate.join(', ')}
                WHERE id = $1
                RETURNING *;
            `;
      const result = await client.query(updateSql, values);
      if (result.rowCount === 0) {
        throw new NotFoundException(
          `Category with ID ${id} not found for update`,
        );
      }
      this.logger.log(`Category updated with ID: ${result.rows[0].id}`);
      return result.rows[0];
    } catch (error) {
      this.logger.error(
        `Failed to update category ${id}: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      )
        throw error;
      throw new InternalServerErrorException('Failed to update category');
    } finally {
      client.release();
    }
  }

  async remove(id: number): Promise<void> {
    const client = await this.pool.connect();
    try {
      const checkUsageSql =
        'SELECT 1 FROM equipment WHERE category_id = $1 LIMIT 1';
      const usageResult = await client.query(checkUsageSql, [id]);
      if (usageResult.rowCount && usageResult.rowCount > 0) {
        throw new BadRequestException(
          `Cannot delete category ${id}: it is currently assigned to equipment.`,
        );
      }

      const deleteSql = 'DELETE FROM categories WHERE id = $1 RETURNING id';
      const result = await client.query(deleteSql, [id]);
      if (result.rowCount === 0) {
        throw new NotFoundException(
          `Category with ID ${id} not found for deletion`,
        );
      }
      this.logger.log(`Category deleted with ID: ${id}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete category ${id}: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      // Обработка foreign key constraint violation (хотя мы добавили проверку выше)
      if (error.code === '23503') {
        // foreign_key_violation
        throw new BadRequestException(
          `Cannot delete category ${id}: it is referenced by other records (e.g., equipment).`,
        );
      }
      throw new InternalServerErrorException('Failed to delete category');
    } finally {
      client.release();
    }
  }
}
