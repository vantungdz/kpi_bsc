import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { OverallReviewStatus } from './objective-evaluation-status.enum';

@Entity('overall_reviews')
export class OverallReview {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  targetId: number; // ID của nhân viên, section hoặc department được review

  @Column({ type: 'varchar', length: 32 })
  targetType: 'employee' | 'section' | 'department';

  @Index()
  @Column()
  reviewedById: number; // Người thực hiện review ở cấp hiện tại

  @Column({ type: 'varchar', length: 32 })
  cycleId: string; // Chu kỳ review (quý/năm...)

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  overallScore: number;

  @Column({ type: 'text', nullable: true })
  overallComment: string;

  @Column({
    type: 'enum',
    enum: OverallReviewStatus,
    default: OverallReviewStatus.DRAFT,
  })
  status: OverallReviewStatus;

  @Column({ type: 'text', nullable: true })
  employeeComment: string;

  @Column({ type: 'timestamp', nullable: true })
  employeeFeedbackDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalWeightedScore: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
