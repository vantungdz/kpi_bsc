import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { KPIAssignment } from './kpi-assignment.entity';

@Entity('kpi_values')
export class KpiValue {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => KPIAssignment, (kpiAssignment) => kpiAssignment.id, {
    nullable: true,
    onDelete: 'SET NULL',
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
    type: 'varchar',
    enum: ['draft', 'submitted', 'approved'],
    default: 'draft',
  })
  status: string; //

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true, onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ nullable: true })
  project_details: string;
}
