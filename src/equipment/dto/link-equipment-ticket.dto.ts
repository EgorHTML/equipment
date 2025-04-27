import { IsNotEmpty, IsInt, IsPositive } from 'class-validator';

export class LinkEquipmentTicketDto {
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  quantity_used: number;

  @IsNotEmpty()
  @IsInt()
  @IsPositive()
  equipment_id: number;

  @IsNotEmpty()
  @IsInt()
  @IsPositive()
  ticket_id: number;
}