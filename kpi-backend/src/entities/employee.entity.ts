import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { KpiValue } from './kpi-value.entity';
import { KpiEvaluation } from './kpi-evaluation.entity';
import { Department } from './department.entity';
import { Section } from './section.entity';
import { Team } from './team.entity';
import { Notification } from './notification.entity';
import { KpiReview } from './kpi-review.entity';
import { Permission } from './permission.entity';
import { Policy } from './policy.entity';
import { Role } from './role.entity';

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

  @ManyToMany(() => Role, { eager: true })
  @JoinTable({
    name: 'employee_roles',
    joinColumn: { name: 'employee_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: Role[];

  @Column({ nullable: true })
  first_name: string;

  @Column({ nullable: true })
  last_name: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ default: false })
  isDeleted: boolean;

  @Column({ nullable: true, name: 'departmentId' })
  departmentId: number;

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];

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

  @OneToMany(() => KpiReview, (review) => review.reviewedBy)
  kpiReviews: KpiReview[];
}
