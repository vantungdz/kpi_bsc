import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ObjectiveEvaluation } from './objective-evaluation.entity';
import { Employee } from './employee.entity';
import { ObjectiveEvaluationStatus } from './objective-evaluation-status.enum';

@Entity('objective_evaluation_history')
export class ObjectiveEvaluationHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  evaluationId: number;

  @ManyToOne(() => ObjectiveEvaluation, (evaluation) => evaluation.history, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'evaluationId' })
  evaluation: ObjectiveEvaluation;

  @Column({
    type: 'enum',
    enum: ObjectiveEvaluationStatus,
  })
  oldStatus: ObjectiveEvaluationStatus;

  @Column({
    type: 'enum',
    enum: ObjectiveEvaluationStatus,
  })
  newStatus: ObjectiveEvaluationStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null; // Reason for rejection

  @Column()
  changedById: number;

  @ManyToOne(() => Employee, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'changedById' })
  changedBy: Employee;

  @CreateDateColumn()
  timestamp: Date;
}
