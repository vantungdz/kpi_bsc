import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { Employee } from '../entities/employee.entity';
import { EmployeeSkill } from '../employee-skill/employee-skill.entity';

@Entity()
export class Competency {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  group: string;

  @ManyToMany(() => Employee, (employee) => employee.competencies)
  @JoinTable()
  employees: Employee[];

  @OneToMany(() => EmployeeSkill, (es) => es.competency)
  employeeSkills: EmployeeSkill[];
}
