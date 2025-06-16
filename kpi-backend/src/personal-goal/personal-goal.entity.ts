import { entities } from './../entities/index';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Employee } from '../entities/employee.entity';
import { PersonalGoalKpi } from './personal-goal-kpi.entity';

export enum PersonalGoalStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('personal_goals')
export class PersonalGoal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  employeeId: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  employee: Employee;

  @Column({ nullable: false })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

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
