// e:\project\kpi-backend\src\entities\kpi-review.entity.ts
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
import { Employee } from './employee.entity'; // The reviewer
// Assuming you have a Cycle entity or similar concept
// import { ReviewCycle } from './review-cycle.entity';

@Entity('kpi_review')
export class KpiReview {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, nullable: false }) // Adjust length as needed
  cycleId: string;

  @Column()
  assignmentId: number; // Foreign key to KPIAssignment

  @ManyToOne(() => KPIAssignment, (assignment) => assignment.reviews)
  @JoinColumn({ name: 'assignmentId' })
  assignment: KPIAssignment;

  // How you link to the cycle depends on your cycle management
  // @Column()
  // cycleId: string; // Or number

  // @ManyToOne(() => ReviewCycle, cycle => cycle.kpiReviews)
  // @JoinColumn({ name: 'cycleId' })
  // cycle: ReviewCycle;

  @Column({ type: 'text', nullable: true })
  managerComment: string | null;

  @Column({ type: 'numeric', nullable: true })
  managerScore: number | null; // If using scores

  @Column()
  reviewedById: number; // The employee who performed the review

  @ManyToOne(() => Employee, (employee) => employee.kpiReviews) // Add 'kpiReviews' relation to Employee entity
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: Employee;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // You might also need fields for overall review if not stored separately
  // overallComment: string;
  // overallScore: number;
}
