import {
  IsInt,
  IsPositive,
  IsNotEmpty,
} from 'class-validator';

export class FindAllCategoryDto {
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  company_id: number;
}
