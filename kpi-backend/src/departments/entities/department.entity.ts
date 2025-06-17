import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne } from 'typeorm';
import { Section } from 'src/sections/entities/section.entity';
import { Employee } from 'src/employees/entities/employee.entity';

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

  @ManyToOne(() => Employee, { nullable: true })
  manager: Employee;

  @Column({ nullable: true })
  managerId: number | null;
}
