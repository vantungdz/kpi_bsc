import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Employee } from './employee.entity'; 
import { ReviewCycle } from './review-cycle.entity';
import { PerformanceObjectiveEvaluationDetail } from './performance-objective-evaluation-detail.entity';
import { PerformanceObjectiveEvaluationHistory } from './performance-objective-evaluation-history.entity';
import { ObjectiveEvaluationStatus } from './objective-evaluation-status.enum';

@Entity('performance_objective_evaluations')
export class PerformanceObjectiveEvaluation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  employee_id: number; 

  @ManyToOne(
    () => Employee,
    (employee) => employee.objectiveEvaluationsReceived,
  )
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column()
  evaluated_by_id: number; 

  @ManyToOne(() => Employee, (employee) => employee.objectiveEvaluationsDone)
  @JoinColumn({ name: 'evaluated_by_id' })
  evaluator: Employee;

  @Column({ nullable: true })
  review_cycle_id: number;

  @ManyToOne(() => ReviewCycle, (cycle) => cycle.objectiveEvaluations, {
    nullable: true,
  })
  @JoinColumn({ name: 'review_cycle_id' })
  reviewCycle: ReviewCycle;

  @Column({
    type: 'enum',
    enum: ObjectiveEvaluationStatus,
    default: ObjectiveEvaluationStatus.PENDING_SECTION_APPROVAL,
  })
  status: ObjectiveEvaluationStatus;

  @Column('decimal', {nullable: true })
  total_weighted_score_supervisor: number;

  @Column('decimal', {nullable: true })
  average_score_supervisor: number;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @Column({ nullable: true })
  approved_by_id: number | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy: Employee;

  @Column({ type: 'timestamp', nullable: true })
  approved_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ nullable: true })
  updated_by: number; 

  @OneToMany(
    () => PerformanceObjectiveEvaluationDetail,
    (detail) => detail.evaluation,
    { cascade: true },
  )
  details: PerformanceObjectiveEvaluationDetail[];

  @OneToMany(
    () => PerformanceObjectiveEvaluationHistory,
    (historyItem) => historyItem.performanceObjectiveEvaluation,
  )
  history: PerformanceObjectiveEvaluationHistory[];
}
