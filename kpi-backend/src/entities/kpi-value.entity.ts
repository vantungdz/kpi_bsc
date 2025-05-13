import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { KPIAssignment } from './kpi-assignment.entity';

export enum KpiValueStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  PENDING_SECTION_APPROVAL = 'PENDING_SECTION_APPROVAL',
  PENDING_DEPT_APPROVAL = 'PENDING_DEPT_APPROVAL',
  PENDING_MANAGER_APPROVAL = 'PENDING_MANAGER_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED_BY_SECTION = 'REJECTED_BY_SECTION',
  REJECTED_BY_DEPT = 'REJECTED_BY_DEPT',
  REJECTED_BY_MANAGER = 'REJECTED_BY_MANAGER',
  RESUBMITTED = 'RESUBMITTED' // New state for resubmitting rejected reviews
}

@Entity('kpi_values')
export class KpiValue {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => KPIAssignment, (kpiAssignment) => kpiAssignment.id, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'kpi_assigment_id' })
  kpiAssignment: KPIAssignment;

  @Column()
  kpi_assigment_id: number;

  @Column('numeric')
  value: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({
    type: 'enum',
    enum: KpiValueStatus,
    default: KpiValueStatus.SUBMITTED,
    nullable: false,
  })
  status: KpiValueStatus;

  @Column({
    type: 'enum',
    enum: KpiValueStatus,
    nullable: true,
  })
  status_before: KpiValueStatus;

  @Column({
    type: 'enum',
    enum: KpiValueStatus,
    nullable: true,
  })
  status_after: KpiValueStatus;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true, onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ type: 'jsonb', nullable: true })
  project_details: object;
}
