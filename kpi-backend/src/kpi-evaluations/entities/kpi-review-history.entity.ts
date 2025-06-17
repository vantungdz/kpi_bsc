import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('kpi_review_history')
export class KpiReviewHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  kpiId: number;

  @Column()
  employeeId: number;

  @Column()
  cycle: string;

  @Column()
  status: string;

  @Column({ type: 'float', nullable: true })
  score: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ nullable: true })
  reviewedBy: number;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @CreateDateColumn()
  createdAt: Date;
}
