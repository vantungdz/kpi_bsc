import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Unique,
  JoinColumn,
} from 'typeorm';
import { Kpi } from './kpi.entity';
import { User } from './user.entity';

@Entity('kpi_evaluations')
@Unique(['kpi_id', 'evaluatee_id', 'period_end_date'])
export class KpiEvaluation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Kpi, (kpi) => kpi.evaluations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id' })
  kpi: Kpi;

  @Column()
  kpi_id: number;

  @ManyToOne(() => User, (user) => user.evaluationsAsEvaluator)
  @JoinColumn({ name: 'evaluator_id' })
  evaluator: User;

  @Column()
  evaluator_id: number;

  @ManyToOne(() => User, (user) => user.evaluationsAsEvaluatee)
  @JoinColumn({ name: 'evaluatee_id' })
  evaluatee: User;

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

  @Column({
    type: 'varchar',
    length: 20,
    default: 'Met',
    enum: ['Met', 'Not Met', 'In Progress', 'Not Started', 'Exceeded'],
  })
  status: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
