import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Department } from './department.entity';
import { Team } from './team.entity';
import { Kpi } from './kpi.entity';
import { UserOrganizationalUnit } from './user-organizational-unit.entity';

@Entity('sections')
export class Section {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToOne(() => Department, (department) => department.sections, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column()
  department_id: number;

  @OneToMany(() => Team, (team) => team.section)
  teams: Team[];

  @OneToMany(() => Kpi, (kpi) => kpi.section)
  kpis: Kpi[];

  @OneToMany(() => UserOrganizationalUnit, (unit) => unit.section)
  userUnits: UserOrganizationalUnit[];
}
