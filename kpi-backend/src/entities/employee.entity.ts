// src/entities/employee.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn, // <== Import JoinColumn
} from 'typeorm';
import { KpiValue } from './kpi-value.entity';
import { KpiEvaluation } from './kpi-evaluation.entity';
import { Department } from './department.entity';
import { Section } from './section.entity';
import { Team } from './team.entity';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column({ unique: true })
  email: string;

  @Column({
    type: 'varchar',
    length: 50,
    enum: ['admin', 'manager', 'leader', 'employee'],
  })
  role: string;

  @Column({ nullable: true })
  first_name: string;

  @Column({ nullable: true })
  last_name: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  // === ĐỊNH NGHĨA TƯỜNG MINH CỘT departmentId (CHÍNH XÁC NHƯ TRONG DB) ===
  @Column({ nullable: true, name: 'departmentId' }) // name: 'departmentId' là tường minh tên cột
  departmentId: number; // <== Property name

  @ManyToOne(() => Department, (department) => department.employees)
  @JoinColumn({ name: 'departmentId' }) // <== Liên kết với cột 'departmentId'
  department: Department; // <== Property name cho object quan hệ
  // === KẾT THÚC ĐỊNH NGHĨA TƯỜNG MINH ===

  // === ĐỊNH NGHĨA TƯỜNG MINH CỘT sectionId (CHÍNH XÁC NHƯ TRONG DB) ===
  @Column({ nullable: true, name: 'sectionId' }) // name: 'sectionId' là tường minh tên cột
  sectionId: number; // <== Property name

  @ManyToOne(() => Section, (section) => section.employees, { nullable: true })
  @JoinColumn({ name: 'sectionId' }) // <== Liên kết với cột 'sectionId'
  section?: Section; // <== Property name cho object quan hệ
  // === KẾT THÚC ĐỊNH NGHĨA TƯỜNG MINH ===

  // === ĐỊNH NGHĨA TƯỜNG MINH CỘT teamId (CHÍNH XÁC NHƯ TRONG DB) ===
  @Column({ nullable: true, name: 'teamId' }) // name: 'teamId' là tường minh tên cột
  teamId: number; // <== Property name

  @ManyToOne(() => Team, (team) => team.employees, { nullable: true })
  @JoinColumn({ name: 'teamId' }) // <== Liên kết với cột 'teamId'
  team?: Team; // <== Property name cho object quan hệ
  // === KẾT THÚC ĐỊNH NGHĨA TƯỜNG MINH ===

}
