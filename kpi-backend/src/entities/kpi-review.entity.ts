import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from './employee.entity';
import { Department } from './department.entity';
import { Section } from './section.entity';
import { Kpi } from './kpi.entity';
import { KPIAssignment } from './kpi-assignment.entity';

export enum ReviewStatus {
  PENDING = 'PENDING',
  SELF_REVIEWED = 'SELF_REVIEWED',
  SECTION_REVIEWED = 'SECTION_REVIEWED',
  DEPARTMENT_REVIEWED = 'DEPARTMENT_REVIEWED',
  MANAGER_REVIEWED = 'MANAGER_REVIEWED',
  EMPLOYEE_FEEDBACK = 'EMPLOYEE_FEEDBACK',
  COMPLETED = 'COMPLETED',
  DEPARTMENT_REVIEW_PENDING = 'DEPARTMENT_REVIEW_PENDING',
}

@Entity('kpi_review')
export class KpiReview {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Kpi)
  kpi: Kpi;

  @ManyToOne(() => Employee, { nullable: true })
  employee: Employee;

  @ManyToOne(() => Department, { nullable: true })
  department: Department;

  @ManyToOne(() => Section, { nullable: true })
  section: Section;

  @ManyToOne(() => KPIAssignment, (assignment) => assignment.reviews, {
    nullable: true,
  })
  assignment: KPIAssignment;

  @Column()
  cycle: string;

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
  sectionComment: string;

  @Column({ type: 'float', nullable: true })
  departmentScore: number;

  @Column({ type: 'text', nullable: true })
  departmentComment: string;

  @Column({ type: 'float', nullable: true })
  managerScore: number;

  @Column({ type: 'text', nullable: true })
  managerComment: string;
}
