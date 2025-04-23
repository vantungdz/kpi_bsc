import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Section } from './section.entity';
import { Employee } from './employee.entity';

@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @OneToMany(() => Section, (section) => section.department)
  sections: Section[];

  @OneToMany(() => Employee, (employee) => employee.department)
  employees: Employee[];
}
