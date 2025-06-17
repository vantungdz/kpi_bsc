import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { PersonalGoalKpi } from './personal-goal-kpi.entity';

/**
 * Trạng thái của mục tiêu cá nhân
 */
export enum PersonalGoalStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/**
 * Entity đại diện cho một mục tiêu cá nhân của nhân viên
 */
@Entity('personal_goals')
export class PersonalGoal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  employeeId: number;

  /**
   * Liên kết tới nhân viên sở hữu mục tiêu này
   */
  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  employee: Employee;

  @Column({ nullable: false })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  /**
   * Danh sách các KPI liên kết với mục tiêu cá nhân này
   */
  @OneToMany(() => PersonalGoalKpi, (pgk) => pgk.personalGoal, { cascade: true })
  kpiLinks: PersonalGoalKpi[];

  @Column({ type: 'float', nullable: true })
  targetValue: number;

  @Column({ type: 'float', nullable: true })
  currentValue: number;

  @Column({ type: 'date', nullable: true })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column({ type: 'enum', enum: PersonalGoalStatus, default: PersonalGoalStatus.NOT_STARTED })
  status: PersonalGoalStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
