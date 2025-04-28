// kpi-assignment.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
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

export type AssignmentType = 'department' | 'section' | 'team' | 'employee';

@Entity('kpi_assignment')
export class KPIAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  kpi_id: number;

  @ManyToOne(() => Kpi, (kpi) => kpi.assignments)
  @JoinColumn({ name: 'kpi_id' })
  kpi: Kpi;

  @Column()
  assignedFrom: string;

  @Column({ type: 'numeric', nullable: true })
  assigned_to_department: number;

  @ManyToOne(() => Department, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'assigned_to_department' })
  department: Department;

  @Column({ type: 'numeric', nullable: true })
  assigned_to_section: number;

  @ManyToOne(() => Section, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'assigned_to_section' })
  section: Section;

  @Column({ type: 'numeric', nullable: true })
  assigned_to_team: number;

  @ManyToOne(() => Team, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'assigned_to_team' })
  team: Team;

  @Column({ type: 'numeric', nullable: true })
  assigned_to_employee: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'assigned_to_employee' })
  employee: Employee;

  @Column({ type: 'numeric', nullable: true })
  employee_id: number;

  @Column({
    type: 'varchar',
    enum: ['draft', 'submitted', 'approved'],
    default: 'draft',
  })
  status: string;

  @Column({
    type: 'timestamp',

    default: () => 'CURRENT_TIMESTAMP',
  })
  submitted_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  reviewed_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  approved_at: Date;

  @Column()
  targetValue: number;

  @CreateDateColumn()
  assignedAt: Date;

  @Column()
  assignedBy: number;

  @Column({ type: 'timestamp', nullable: true })
  @DeleteDateColumn()
  deleted_at: Date;

  @OneToMany(() => KpiValue, (value) => value.kpiAssignment)
  kpiValues: KpiValue[];
}
