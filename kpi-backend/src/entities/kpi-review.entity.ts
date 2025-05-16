import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { KPIAssignment } from './kpi-assignment.entity';
import { Employee } from './employee.entity';

@Entity('kpi_review')
export class KpiReview {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, nullable: false })
  cycleId: string;

  @Column()
  assignmentId: number;

  @ManyToOne(() => KPIAssignment, (assignment) => assignment.reviews)
  @JoinColumn({ name: 'assignmentId' })
  assignment: KPIAssignment;

  @Column({ type: 'text', nullable: true })
  managerComment: string | null;

  @Column({ type: 'numeric', nullable: true })
  managerScore: number | null;

  @Column({ type: 'text', nullable: true })
  selfComment: string | null;

  @Column({ type: 'numeric', nullable: true })
  selfScore: number | null;

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
