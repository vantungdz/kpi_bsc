import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('performance_objective_evaluation_history')
export class PerformanceObjectiveEvaluationHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  status: string;

  @Column({ nullable: true })
  comment: string;

  @CreateDateColumn()
  createdAt: Date;
}
