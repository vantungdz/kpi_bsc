import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { Department } from '../../departments/entities/department.entity';
import { Section } from '../../sections/entities/section.entity';
import { Kpi } from '../../kpis/entities/kpi.entity';
import { KPIAssignment } from '../../kpi-assessments/entities/kpi-assignment.entity';

export enum EvaluationPhase {
  MID_YEAR = 'MID_YEAR',
  YEAR_END = 'YEAR_END',
}

export enum ReviewStatus {
  PENDING = 'PENDING',
  SELF_REVIEWED = 'SELF_REVIEWED',
  SECTION_REVIEWED = 'SECTION_REVIEWED',
  DEPARTMENT_REVIEWED = 'DEPARTMENT_REVIEWED',
  MANAGER_REVIEWED = 'MANAGER_REVIEWED',
  EMPLOYEE_FEEDBACK = 'EMPLOYEE_FEEDBACK',
  PENDING_MANAGER_APPROVAL = 'PENDING_MANAGER_APPROVAL',
  COMPLETED = 'COMPLETED',
  SECTION_REJECTED = 'SECTION_REJECTED',
  DEPARTMENT_REJECTED = 'DEPARTMENT_REJECTED',
  MANAGER_REJECTED = 'MANAGER_REJECTED',
}

@Entity('kpi_review')
@Unique('UQ_kpi_review_assignment_cycle_phase', [
  'assignment',
  'cycle',
  'evaluationPhase',
])
export class KpiReview {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Kpi)
  @JoinColumn({ name: 'kpiId' })
  kpi: Kpi;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'departmentId' })
  department: Department;

  @ManyToOne(() => Section, { nullable: true })
  @JoinColumn({ name: 'sectionId' })
  section: Section;

  @ManyToOne(() => KPIAssignment, (assignment) => assignment.reviews, {
    nullable: true,
  })
  @JoinColumn({ name: 'assignmentId' })
  assignment: KPIAssignment;

  @Column()
  cycle: string;

  @Column({
    type: 'enum',
    enum: EvaluationPhase,
  })
  evaluationPhase: EvaluationPhase;

  @Column('float')
  targetValue: number;

  @Column('float')
  actualValue: number;

  @Column({ type: 'float', nullable: true })
  score: number;

  @Column({ type: 'text', nullable: true })
  actionPlan: string;

  @Column({ type: 'text', nullable: true })
  employeeFeedback: string;

  @Column({ type: 'enum', enum: ReviewStatus, default: ReviewStatus.PENDING })
  status: ReviewStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Employee, (employee) => employee.kpiReviews, {
    nullable: true,
  })
  reviewedBy: Employee;

  @Column({ type: 'float', nullable: true })
  selfScore: number;

  @Column({ type: 'text', nullable: true })
  selfComment: string;

  @Column({ type: 'float', nullable: true })
  sectionScore: number;

  @Column({ type: 'text', nullable: true })
  sectionComment: string | null;

  @Column({ type: 'float', nullable: true })
  departmentScore: number;

  @Column({ type: 'text', nullable: true })
  departmentComment: string | null;

  @Column({ type: 'float', nullable: true })
  managerScore: number;

  @Column({ type: 'text', nullable: true })
  managerComment: string | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;
}
