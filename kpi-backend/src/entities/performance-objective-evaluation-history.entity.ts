import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
// Import the related entity if needed
// import { PerformanceObjectiveEvaluation } from './performance-objective-evaluation.entity';

@Entity('performance_objective_evaluation_history')
export class PerformanceObjectiveEvaluationHistory {
  @PrimaryGeneratedColumn()
  id: number;

  // Example: reference to the evaluation (uncomment and adjust if needed)
  // @ManyToOne(() => PerformanceObjectiveEvaluation, evaluation => evaluation.history)
  // evaluation: PerformanceObjectiveEvaluation;

  @Column({ nullable: true })
  status: string;

  @Column({ nullable: true })
  comment: string;

  @CreateDateColumn()
  createdAt: Date;

  // Add more fields as needed
}
