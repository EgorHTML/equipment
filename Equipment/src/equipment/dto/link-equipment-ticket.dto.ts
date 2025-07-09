import { IsNotEmpty, IsInt, IsPositive, Min } from 'class-validator';

export class LinkEquipmentTicketDto {
  @IsInt()
  @Min(0)
  @IsNotEmpty()
  quantity_used: number;
}