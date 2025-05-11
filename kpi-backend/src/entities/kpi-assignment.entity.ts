import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  OneToMany,
  DeleteDateColumn,
} from 'typeorm';
import { Kpi } from './kpi.entity';
import { Employee } from './employee.entity';
import { Department } from './department.entity';
import { Section } from './section.entity';
import { Team } from './team.entity';
import { KpiValue } from './kpi-value.entity';
import { KpiReview } from './kpi-review.entity';

@Entity('kpi_assignment')
export class KPIAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  kpi_id: number;

  @ManyToOne(() => Kpi, (kpi) => kpi.assignments, { nullable: false })
  @JoinColumn({ name: 'kpi_id' })
  kpi: Kpi;

  @Column({ nullable: true })
  assignedFrom: string;

  @Column({ type: 'numeric', nullable: true })
  assigned_to_department: number | null;

  @ManyToOne(() => Department, {
    onDelete: 'SET NULL',
    nullable: true,
    eager: false,
  })
  @JoinColumn({ name: 'assigned_to_department' })
  department: Department | null;

  @Column({ type: 'numeric', nullable: true })
  assigned_to_section: number | null;

  @ManyToOne(() => Section, {
    onDelete: 'SET NULL',
    nullable: true,
    eager: false,
  })
  @JoinColumn({ name: 'assigned_to_section' })
  section: Section | null;

  @Column({ type: 'numeric', nullable: true })
  assigned_to_team: number | null;

  @ManyToOne(() => Team, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'assigned_to_team' })
  team: Team | null;

  @Column({ type: 'numeric', nullable: true })
  assigned_to_employee: number | null;

  @ManyToOne(() => Employee, {
    onDelete: 'SET NULL',
    nullable: true,
    eager: false,
  })
  @JoinColumn({ name: 'assigned_to_employee' })
  employee: Employee | null;

  @Column({ type: 'numeric', nullable: true })
  employee_id: number | null;

  @Column({
    type: 'varchar',
    length: 50,
    enum: ['DRAFT', 'APPROVED'],
    default: 'DRAFT',
  })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  submitted_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewed_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updated_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'numeric', nullable: true })
  targetValue: number | null;

  @CreateDateColumn()
  assignedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'start_date' })
  startDate: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'end_date' })
  endDate: Date | null;

  @Column({ nullable: true })
  assignedBy: number;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at?: Date;

  @OneToMany(() => KpiValue, (kpiValue) => kpiValue.kpiAssignment)
  kpiValues: KpiValue[];

  @OneToMany(() => KpiReview, (review) => review.assignment)
  reviews: KpiReview[];
}
