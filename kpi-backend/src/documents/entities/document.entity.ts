import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';

@Entity()
export class Document {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 255 })
  filePath: string;

  @Column({ length: 50, default: 'general' })
  type: string; // e.g. 'guide', 'policy', 'template', ...

  @ManyToOne(() => Employee, { nullable: true })
  createdBy: Employee;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
