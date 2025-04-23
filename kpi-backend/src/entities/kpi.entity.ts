import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Perspective } from './perspective.entity';
import { KPIAssignment } from './kpi-assignment.entity';

@Entity('kpis')
export class Kpi {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'sum',
    enum: ['sum', 'average', 'percent'],
  })
  calculation_type: string;

  @Column()
  type: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 50 })
  unit: string;

  @Column('numeric')
  target: number;

  @Column({
    type: 'varchar',
    length: 20,
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
  })
  frequency: string;

  @Column('numeric', { precision: 5, scale: 2, default: 0 })
  weight: number;

  @Column({ nullable: true })
  perspective_id: number;

  @ManyToOne(() => Perspective, (perspective) => perspective.kpis, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true,
  })
  @JoinColumn({ name: 'perspective_id' })
  perspective: Perspective;

  @Column({ type: 'date', nullable: true })
  start_date: string;

  @Column({ type: 'date', nullable: true })
  end_date: string;

  @Column({ type: 'numeric', nullable: true })
  min_target: number;

  @Column({ type: 'numeric', nullable: true })
  max_target: number;

  @Column({ type: 'numeric', nullable: true })
  mid_target: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  memo: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'Active',
    enum: ['Active', 'Inactive'],
  })
  status: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  created_by_type: 'company' | 'department' | 'section' | 'employee';

  @Column({ nullable: true })
  created_by: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ nullable: true })
  deleted_by: number;

  @DeleteDateColumn()
  deleted_at?: Date;

  @OneToMany(() => KPIAssignment, (assignment) => assignment.kpi, {
    eager: true,
  })
  assignments: KPIAssignment[];
}
