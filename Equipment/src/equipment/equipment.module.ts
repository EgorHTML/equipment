import { Module } from '@nestjs/common';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';
import { DataSource } from 'typeorm';
import { PG_CONNECTION } from 'src/core/database/database.provider';
import { Equipment } from './entity/equipment.entity';
import { Equipment_finite } from './entity/equipment_finite.entity';
import { Equipment_user } from './entity/equipment_user.entity';
import { Equipment_company } from './entity/equipment_company.entity';
import { Equipment_ticket } from './entity/equipment_ticket.entity';

@Module({
  controllers: [EquipmentController],
  providers: [
    EquipmentService,
    {
      provide: 'EQUIPMENT_TICKET',
      useFactory: (dataSource: DataSource) =>
        dataSource.getRepository(Equipment_ticket),
      inject: [PG_CONNECTION],
    },
    {
      provide: 'EQUIPMENT_COMPANY',
      useFactory: (dataSource: DataSource) =>
        dataSource.getRepository(Equipment_company),
      inject: [PG_CONNECTION],
    },
    {
      provide: 'EQUIPMENT_USER',
      useFactory: (dataSource: DataSource) =>
        dataSource.getRepository(Equipment_user),
      inject: [PG_CONNECTION],
    },
    {
      provide: 'EQUIPMENT_REPOSITORY',
      useFactory: (dataSource: DataSource) =>
        dataSource.getRepository(Equipment),
      inject: [PG_CONNECTION],
    },
    {
      provide: 'EQUIPMENT_FINITE_REPOSITORY',
      useFactory: (dataSource: DataSource) =>
        dataSource.getRepository(Equipment_finite),
      inject: [PG_CONNECTION],
    },
  ],
  exports: [EquipmentService],
})
export class EquipmentModule {}
