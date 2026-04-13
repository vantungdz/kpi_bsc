import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';

@Entity('user_sessions')
export class UserSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ unique: true })
  sessionId: string;

  @Column()
  deviceInfo: string;

  @Column()
  ipAddress: string;

  @Column()
  userAgent: string;

  @CreateDateColumn()
  loginTime: Date;

  @UpdateDateColumn()
  lastActivity: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  logoutTime: Date;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'userId' })
  user: Employee;
}
