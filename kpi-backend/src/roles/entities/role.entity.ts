import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Permission } from '../../common/entities/permission.entity';

/**
 * Entity đại diện cho vai trò (Role) trong hệ thống
 * Mỗi role có thể có nhiều quyền (Permission)
 */
@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, unique: true })
  name: string; // e.g. 'admin', 'manager', ...

  @Column({ nullable: true })
  description?: string;

  /**
   * Danh sách quyền của role này
   */
  @ManyToMany(() => Permission, { cascade: true })
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
  })
  permissions: Permission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
