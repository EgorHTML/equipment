import { IsString, IsNotEmpty, IsOptional, IsInt, IsDateString, IsNumber, Min, MaxLength, IsPositive } from 'class-validator';

export class UpdateEquipmentDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  parent_id?: number;

  @IsInt()
  @IsPositive()
  category_id: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
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