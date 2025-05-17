import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Employee } from './employee.entity';
import { ObjectiveEvaluationHistory } from './objective-evaluation-history.entity';

@Entity('objective_evaluations')
export class ObjectiveEvaluation {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  employeeId: number; // The employee being evaluated

  @ManyToOne(
    () => Employee,
    (employee) => employee.objectiveEvaluationsAsSubject,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Index()
  @Column()
  evaluatorId: number; // The manager/person who submitted this evaluation

  @ManyToOne(
    () => Employee,
    (employee) => employee.objectiveEvaluationsAsEvaluator,
    { onDelete: 'SET NULL', nullable: true },
  )
  @JoinColumn({ name: 'evaluatorId' })
  evaluator: Employee;

  @Index()
  @Column()
  cycleId: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  totalWeightedScoreSupervisor: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  averageScoreSupervisor: number;

  @Column({ type: 'text', nullable: true })
  currentRejectionReason: string;

  @OneToMany(() => ObjectiveEvaluationHistory, (history) => history.evaluation)
  history: ObjectiveEvaluationHistory[];

  // This field could be linked if an OverallReview record triggers the creation of an ObjectiveEvaluation
  // @Column({ type: 'int', nullable: true })
  // overallReviewId?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updated_at: Date; // Matches frontend expectation
}
