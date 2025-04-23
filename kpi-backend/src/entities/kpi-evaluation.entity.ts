import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Unique,
  JoinColumn,
} from 'typeorm';
import { KPIAssignment } from './kpi-assignment.entity';

@Entity('kpi_evaluations')
@Unique(['evaluatee_id', 'period_end_date'])
export class KpiEvaluation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => KPIAssignment, (kpiAssignment) => kpiAssignment.id, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'kpi_assigment_id' })
  kpiAssignment: KPIAssignment;

  @Column()
  kpi_assigment_id: number;

  @Column()
  evaluator_id: number;

  @Column()
  evaluatee_id: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  evaluation_date: Date;

  @Column({ type: 'date' })
  period_start_date: string;

  @Column({ type: 'date' })
  period_end_date: string;

  @Column({ length: 50 })
  rating: string;

  @Column({ type: 'text', nullable: true })
  comments: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
