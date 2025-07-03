import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Relation,
} from 'typeorm';
import { Equipment } from './equipment.entity';

@Entity()
export class Equipment_company {
  @PrimaryColumn()
  company_id: number;

  @PrimaryColumn()
  equipment_id: number;

  @ManyToOne(() => Equipment, (equipment) => equipment.linkedCompanies, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Relation<Equipment>;
}
