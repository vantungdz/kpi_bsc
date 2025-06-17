import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';

@Entity('policies')
export class Policy {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string; // e.g. 'can_approve_kpi', 'can_export_employee', ...

  @Column({ type: 'json', nullable: true })
  conditions?: any; // JSON: { departmentId: 1, ... } hoặc rule động

  @Column({ nullable: true })
  role?: string;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: Employee;

  @Column({ nullable: true })
  userId?: number;

  @Column({ default: true })
  enabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
