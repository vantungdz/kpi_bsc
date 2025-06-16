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
import { Notification } from './notification.entity'; // Added import

@Entity('sections')
export class Section {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @OneToMany(() => Notification, (notification) => notification.section) // Changed from notification.user to notification.section
  notifications: Notification[]; // This section can have many notifications

  @ManyToOne(() => Department, (department) => department.sections)
  department: Department;

  @OneToMany(() => Team, (team) => team.section)
  teams: Team[];

  @OneToMany(() => Employee, (employee) => employee.section)
  employees: Employee[];

  @ManyToOne(() => Employee, { nullable: true })
  manager: Employee;

  @Column({ nullable: true })
  managerId: number | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
