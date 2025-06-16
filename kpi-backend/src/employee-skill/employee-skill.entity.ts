import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Employee } from '../entities/employee.entity';
import { Competency } from '../entities/competency.entity';

@Entity('employee_skills')
export class EmployeeSkill {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Employee, (employee) => employee.skills, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @ManyToOne(() => Competency, (competency) => competency.employeeSkills, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competency_id' })
  competency: Competency;

  @Column({ type: 'float', default: 3 })
  level: number;

  @Column({ nullable: true })
  note: string;
}
