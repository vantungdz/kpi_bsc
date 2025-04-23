import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Department } from './department.entity';
import { Team } from './team.entity';
import { Employee } from './employee.entity';

@Entity('sections')
export class Section {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToOne(() => Department, (department) => department.sections)
  department: Department;

  @OneToMany(() => Team, (team) => team.section)
  teams: Team[];

  @OneToMany(() => Employee, (employee) => employee.section)
  employees: Employee[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
