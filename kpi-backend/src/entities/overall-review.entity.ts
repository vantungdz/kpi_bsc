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

import { OverallReviewStatus } from './objective-evaluation-status.enum';
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
    enum: OverallReviewStatus,
    default: OverallReviewStatus.DRAFT,
  })
  status: OverallReviewStatus;

  @ManyToOne(() => Employee, { nullable: false })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: Employee;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
