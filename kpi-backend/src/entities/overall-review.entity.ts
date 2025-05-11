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

@Entity('overall_reviews')
@Index(['targetId', 'targetType', 'cycleId', 'reviewedById'], { unique: true }) // Ensure one overall review per target, cycle, reviewer
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

  @Column()
  reviewedById: number;

  @ManyToOne(() => Employee, { nullable: false })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: Employee;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
