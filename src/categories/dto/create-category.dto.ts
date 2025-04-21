import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsInt,
  IsPositive,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsInt()
  @IsPositive()
  company_id: number; // ID из внешней системы
}
