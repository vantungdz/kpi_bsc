import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Section } from './section.entity';
import { UserOrganizationalUnit } from './user-organizational-unit.entity';
import { Kpi } from './kpi.entity';

@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToOne(() => Department, (department) => department.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  parent: Department;

  @Column({ nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent_id: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @OneToMany(() => Department, (department) => department.parent)
  children: Department[];

  @OneToMany(() => Section, (section) => section.department)
  sections: Section[];

  @OneToMany(() => Kpi, (kpi) => kpi.department)
  kpis: Kpi[];

  @OneToMany(() => UserOrganizationalUnit, (unit) => unit.department)
  userUnits: UserOrganizationalUnit[];
}
