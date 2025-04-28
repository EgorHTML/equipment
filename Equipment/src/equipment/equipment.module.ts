import { Module, forwardRef } from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { EquipmentController } from './equipment.controller';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    forwardRef(() => FilesModule), 
  ],
  controllers: [EquipmentController],
  providers: [EquipmentService],
  exports: [EquipmentService], 
})
export class EquipmentModule {}