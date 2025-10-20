import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Department } from '../../departments/entities/department.entity';
import { Team } from '../../teams/entities/team.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { Notification } from '../../notification/entities/notification.entity';

/**
 * Entity representing Section (department/sub-department)
 * Section belongs to one Department, can have multiple Teams, Employees, Notifications
 */
@Entity('sections')
export class Section {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  /**
   * Danh sách notification thuộc section này
   */
  @OneToMany(() => Notification, (notification) => notification.section)
  notifications: Notification[];

  /**
   * Section belongs to a department
   */
  @ManyToOne(() => Department, (department) => department.sections)
  department: Department;

  /**
   * Danh sách team thuộc section này
   */
  @OneToMany(() => Team, (team) => team.section)
  teams: Team[];

  /**
   * Danh sách nhân viên thuộc section này
   */
  @OneToMany(() => Employee, (employee) => employee.section)
  employees: Employee[];

  /**
   * Manager of the section
   */
  @ManyToOne(() => Employee, { nullable: true })
  manager: Employee;

  @Column({ nullable: true })
  managerId: number | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
