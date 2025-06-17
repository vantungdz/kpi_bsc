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
 * Entity đại diện cho Section (bộ phận/phòng ban nhỏ)
 * Section thuộc về một Department, có thể có nhiều Team, Employee, Notification
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
   * Section thuộc về một department
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
   * Quản lý (manager) của section
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
