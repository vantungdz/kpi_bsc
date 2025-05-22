import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { KPIAssignment } from './kpi-assignment.entity';
import { Employee } from './employee.entity';

@Entity('kpi_review')
export class KpiReview {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32 })
  cycleId: string;

  @Index()
  @Column()
  assignmentId: number;

  @ManyToOne(() => KPIAssignment, (assignment) => assignment.reviews)
  @JoinColumn({ name: 'assignmentId' })
  assignment: KPIAssignment;

  @Column({ type: 'text', nullable: true })
  managerComment: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  managerScore: number | null;

  @Column({ type: 'text', nullable: true })
  selfComment: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  selfScore: number | null;

  @Index()
  @Column()
  reviewedById: number;

  @ManyToOne(() => Employee, (employee) => employee.kpiReviews)
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: Employee;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
