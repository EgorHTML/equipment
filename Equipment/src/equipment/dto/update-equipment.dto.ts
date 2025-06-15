import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsDateString,
  Min,
  MaxLength,
  IsPositive,
} from 'class-validator';

export class UpdateEquipmentDto {
  @IsOptional()
  parent?:  { id: number };


  @IsInt()
  @IsPositive()
  @IsOptional()
  category_id: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @IsOptional()
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsOptional()
  serial_number: string;

  @IsOptional()
  @IsDateString()
  warranty_end?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  article?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  user_ids?: number[];

  @IsOptional()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  company_ids?: number[];
}
