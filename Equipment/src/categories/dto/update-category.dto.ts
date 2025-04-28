import {
  IsString,
  IsOptional,
  MaxLength,
  IsInt,
  IsPositive,
  IsNotEmpty,
} from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  company_id?: number;
}
