import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Employee } from './employee.entity';

export enum OverallReviewStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  MANAGER_REVIEWED = 'MANAGER_REVIEWED',
  EMPLOYEE_FEEDBACK_PENDING = 'EMPLOYEE_FEEDBACK_PENDING',
  EMPLOYEE_RESPONDED = 'EMPLOYEE_RESPONDED',
  COMPLETED = 'COMPLETED',
}

@Entity('overall_reviews')
@Index(['targetId', 'targetType', 'cycleId', 'reviewedById'], { unique: true })
export class OverallReview {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  targetId: number;

  @Column({
    type: 'varchar',
    length: 50,
    enum: ['employee', 'section', 'department'],
  })
  targetType: 'employee' | 'section' | 'department';

  @Column({ type: 'varchar', length: 50 })
  cycleId: string;

  @Column({ type: 'text', nullable: true })
  overallComment: string | null;

  @Column({ type: 'int', nullable: true })
  overallScore: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalWeightedScore: string | null;

  @Column({ type: 'text', nullable: true })
  employeeComment: string | null;

  @Column({ type: 'timestamp', nullable: true })
  employeeFeedbackDate: Date | null;

  @Column()
  reviewedById: number;

  @Column({
    type: 'enum',
    enum: [
      'PENDING_REVIEW',
      'MANAGER_REVIEWED',
      'EMPLOYEE_FEEDBACK_PENDING',
      'EMPLOYEE_RESPONDED',
      'COMPLETED',
    ],
    default: 'PENDING_REVIEW',
  })
  status: string;

  @ManyToOne(() => Employee, { nullable: false })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: Employee;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
