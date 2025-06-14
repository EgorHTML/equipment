import { Module } from '@nestjs/common';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';
import { DataSource } from 'typeorm';
import { PG_CONNECTION } from 'src/core/database/database.provider';
import { Equipment } from './equipment.entity';

@Module({
  controllers: [EquipmentController],
  providers: [
    EquipmentService,
    {
      provide: 'EQUIPMENT_REPOSITORY',
      useFactory: (dataSource: DataSource) =>
        dataSource.getRepository(Equipment),
      inject: [PG_CONNECTION],
    },
  ],
  exports: [EquipmentService],
})
export class EquipmentModule {}
