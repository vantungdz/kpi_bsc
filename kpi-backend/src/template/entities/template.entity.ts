import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Perspective } from '../../perspective/entities/perspective.entity';
import { KpiFormula } from '../../kpi-formula/entities/kpi-formula.entity';
import { ReviewCycle } from '../../review-cycle/entities/review-cycle.entity';
import { Employee } from '../../employees/entities/employee.entity';

/**
 * Entity representing a KPI Template
 * Templates are reusable KPI definitions that can be used to create actual KPIs
 */
@Entity('templates')
export class Template {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  typePerformance: string;

  @Column()
  name: string;

  @Column({
    type: 'varchar',
    length: 20,
    enum: ['efficiency', 'qualitative'],
  })
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

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  weight: number;

  @Column({ nullable: true })
  perspective_id: number;

  @ManyToOne(() => Perspective, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true,
  })
  @JoinColumn({ name: 'perspective_id' })
  perspective: Perspective;

  @Column({ nullable: true })
  formula_id: number;

  @ManyToOne(() => KpiFormula, {
    nullable: true,
    eager: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'formula_id' })
  formula: KpiFormula;

  @Column({ nullable: true })
  review_cycle_id: number;

  @ManyToOne(() => ReviewCycle, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true,
  })
  @JoinColumn({ name: 'review_cycle_id' })
  reviewCycle: ReviewCycle;

  @Column({ nullable: true })
  created_by: number;

  @ManyToOne(() => Employee, { nullable: true, eager: false })
  @JoinColumn({ name: 'created_by' })
  createdBy?: Employee;

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
}
