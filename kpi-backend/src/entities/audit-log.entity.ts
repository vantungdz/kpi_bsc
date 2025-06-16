import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false })
  action: string; // Tên thao tác (CREATE, UPDATE, DELETE, LOGIN, EXPORT, ...)

  @Column({ nullable: false })
  resource: string; // Đối tượng thao tác (bảng, module, ...)

  @Column({ type: 'int', nullable: true })
  userId: number; // ID người thao tác

  @Column({ nullable: true })
  username: string; // Tên đăng nhập

  @Column({ type: 'json', nullable: true })
  data: any; // Dữ liệu liên quan (trước/sau, params, ...)

  @Column({ nullable: true })
  ip: string;

  @CreateDateColumn()
  createdAt: Date;
}
