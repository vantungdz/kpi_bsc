import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { Department } from '../../departments/entities/department.entity';
import { Section } from '../../sections/entities/section.entity';
import { Kpi } from '../../kpis/entities/kpi.entity';
import { KPIAssignment } from '../../kpi-assessments/entities/kpi-assignment.entity';

export enum ReviewStatus {
  PENDING = 'PENDING',
  SELF_REVIEWED = 'SELF_REVIEWED',
  SECTION_REVIEWED = 'SECTION_REVIEWED',
  DEPARTMENT_REVIEWED = 'DEPARTMENT_REVIEWED',
  MANAGER_REVIEWED = 'MANAGER_REVIEWED',
  EMPLOYEE_FEEDBACK = 'EMPLOYEE_FEEDBACK',
  COMPLETED = 'COMPLETED',
  SECTION_REJECTED = 'SECTION_REJECTED',
  DEPARTMENT_REJECTED = 'DEPARTMENT_REJECTED',
  MANAGER_REJECTED = 'MANAGER_REJECTED',
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

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;
}
