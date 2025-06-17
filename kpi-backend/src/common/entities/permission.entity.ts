import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  action: string; // e.g. 'view', 'edit', 'delete', 'export', ...

  @Column({ length: 100 })
  resource: string; // e.g. 'employee', 'kpi', 'department', ...

  @Column({ nullable: true })
  resourceId?: number; // optional: for resource-level permission

  @Column({ default: true })
  enabled: boolean;

  @Column({ nullable: true })
  role?: string; // e.g. 'admin', 'manager', ...

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: Employee;

  @Column({ nullable: true })
  userId?: number;

  @Column({ length: 50, nullable: true })
  scope?: string; // e.g. 'company', 'department', 'section', 'manager', 'admin'

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
