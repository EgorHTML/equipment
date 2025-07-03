import {
  BeforeInsert,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Relation,
} from 'typeorm';
import { Equipment } from './equipment.entity';

@Entity()
export class Equipment_ticket {
  @PrimaryColumn()
  ticket_id: number;

  @PrimaryColumn()
  equipment_id: number;

  @Column()
  quantity_used: number;

  @ManyToOne(() => Equipment, (equipment) => equipment.linkedTickets, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Relation<Equipment>;

  @Column({
    type: 'bigint',
    default: () => 'EXTRACT(EPOCH FROM NOW())::bigint',
  })
  recorded_at: number;

  @BeforeInsert()
  updateTimestampsOnInsert() {
    const now = Math.floor(Date.now() / 1000);
    this.recorded_at = now;
  }
}