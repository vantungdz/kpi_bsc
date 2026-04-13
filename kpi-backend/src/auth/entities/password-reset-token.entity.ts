import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';

@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 64 })
  @Index({ unique: true })
  token: string;

  @Column({ name: 'userId' })
  userId: number;

  @ManyToOne(() => Employee, (employee) => employee.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Employee;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ default: false })
  used: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
