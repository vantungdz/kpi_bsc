import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
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

  @Column({ nullable: true, name: 'departmentId' })
  departmentId: number;

  @ManyToOne(() => Department, (department) => department.employees)
  @JoinColumn({ name: 'departmentId' })
  department: Department;

  @Column({ nullable: true, name: 'sectionId' })
  sectionId: number;

  @ManyToOne(() => Section, (section) => section.employees, { nullable: true })
  @JoinColumn({ name: 'sectionId' })
  section?: Section;

  @Column({ nullable: true, name: 'teamId' })
  teamId: number;

  @ManyToOne(() => Team, (team) => team.employees, { nullable: true })
  @JoinColumn({ name: 'teamId' })
  team?: Team;
}
