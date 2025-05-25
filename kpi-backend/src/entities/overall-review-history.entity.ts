import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { OverallReview } from './overall-review.entity';
import { Employee } from './employee.entity';

@Entity('overall_review_history')
export class OverallReviewHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => OverallReview)
  @JoinColumn({ name: 'overallReviewId' })
  overallReview: OverallReview;

  @Column()
  overallReviewId: number;

  @Column({ type: 'varchar', length: 32 })
  action: string; // approve, reject, feedback, submit, ...

  @Column({ type: 'varchar', length: 32 })
  fromStatus: string;

  @Column({ type: 'varchar', length: 32 })
  toStatus: string;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'actorId' })
  actor: Employee;

  @Column()
  actorId: number;

  @CreateDateColumn()
  createdAt: Date;
}
