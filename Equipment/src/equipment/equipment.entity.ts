import { Category } from 'src/categories/categories.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  TreeParent,
  TreeChildren,
  Tree,
  Relation,
} from 'typeorm';

@Tree('closure-table')
@Entity()
export class Equipment {
  @PrimaryGeneratedColumn()
  id: number;

  @TreeParent({ onDelete: 'SET NULL' })
  parent: Relation<Equipment> | null;

  @TreeChildren({ cascade: true })
  children: Relation<Equipment>[];


  @Column()
  @ManyToOne(() => Category, { nullable: false })
  @JoinColumn({ name: 'category_id' })
  category_id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  serial_number: string;

  @Column({ nullable: true, type: 'bigint' })
  warranty_end: number | null;

  @Column({ type: 'text', nullable: true })
  article: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'bigint',
    default: () => 'EXTRACT(EPOCH FROM NOW())::bigint',
  })
  created_at: number;

  @Column({
    type: 'bigint',
    default: () => 'EXTRACT(EPOCH FROM NOW())::bigint',
  })
  updated_at: number;
}
