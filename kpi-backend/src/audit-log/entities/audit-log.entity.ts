import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false })
  action: string; 

  @Column({ nullable: false })
  resource: string; 

  @Column({ type: 'int', nullable: true })
  userId: number; 

  @Column({ nullable: true })
  username: string; 

  @Column({ type: 'json', nullable: true })
  data: any; 

  @Column({ nullable: true })
  ip: string;

  @CreateDateColumn()
  createdAt: Date;
}
