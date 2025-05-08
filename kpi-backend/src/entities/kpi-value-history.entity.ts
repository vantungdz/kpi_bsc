import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { KpiValue, KpiValueStatus } from './kpi-value.entity'; // Import KpiValueStatus
import { Employee } from './employee.entity';
import { KPIAssignment } from './kpi-assignment.entity';

@Entity('kpi_value_history')
export class KpiValueHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => KpiValue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kpi_value_id' })
  kpiValue: KpiValue;

  @Column()
  kpi_value_id: number;

  @ManyToOne(() => KPIAssignment, (kpiAssignment) => kpiAssignment.id, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'kpi_assigment_id' })
  kpiAssignment: KPIAssignment;

  @Column()
  kpi_assigment_id: number;

  @Column()
  kpi_id: number;

  @Column('numeric')
  value: number;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({
    type: 'enum',
    enum: KpiValueStatus,
    nullable: true,
    name: 'status_before',
  })
  status_before: KpiValueStatus;

  @Column({
    type: 'enum',
    enum: KpiValueStatus,
    nullable: true,
    name: 'status_after',
  })
  status_after: KpiValueStatus;

  @Column()
  action: string; // 'CREATE', 'UPDATE', 'DELETE'

  @Column()
  changed_by: number;

  @ManyToOne(() => Employee, { nullable: true, eager: false })
  @JoinColumn({ name: 'changed_by' })
  changedByUser: Employee;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  changed_at: Date;
}
