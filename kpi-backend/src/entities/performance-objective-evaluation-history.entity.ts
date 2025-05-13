import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { PerformanceObjectiveEvaluation } from './performance-objective-evaluation.entity';
import { ObjectiveEvaluationStatus } from './objective-evaluation-status.enum';
import { Employee } from './employee.entity';

@Entity('performance_objective_evaluation_history')
export class PerformanceObjectiveEvaluationHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  performance_objective_evaluation_id: number;

  @ManyToOne(
    () => PerformanceObjectiveEvaluation,
    (evaluation) => evaluation.history,
  )
  @JoinColumn({ name: 'performance_objective_evaluation_id' })
  performanceObjectiveEvaluation: PerformanceObjectiveEvaluation;

  @Column({
    type: 'enum',
    enum: ObjectiveEvaluationStatus,
    enumName: 'objective_evaluation_status_enum',
    nullable: true,
  })
  status_before: ObjectiveEvaluationStatus | null;

  @Column({
    type: 'enum',
    enum: ObjectiveEvaluationStatus,
    enumName: 'objective_evaluation_status_enum',
  })
  status_after: ObjectiveEvaluationStatus;

  @Column({ length: 255 })
  action: string; 

  @Column({ type: 'text', nullable: true })
  reason: string | null; 

  @Column()
  changed_by_id: number;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'changed_by_id' })
  changedBy: Employee;

  @CreateDateColumn()
  changed_at: Date;
}
