import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Perspective } from '../../perspective/entities/perspective.entity';
import { KPIAssignment } from '../../kpi-assessments/entities/kpi-assignment.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { KpiFormula } from '../../kpi-formula/entities/kpi-formula.entity';
import { StrategicObjective } from '../../strategic-objectives/entities/strategic-objective.entity';

export enum KpiDefinitionStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  NEEDS_REVISION = 'NEEDS_REVISION',
}

@Entity('kpis')
export class Kpi {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  type: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 50 })
  unit: string;

  @Column('numeric')
  target: number;

  @Column({
    type: 'varchar',
    length: 20,
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
  })
  frequency: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  weight: number;

  @Column({ nullable: true })
  perspective_id: number;

  @ManyToOne(() => Perspective, (perspective) => perspective.kpis, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true,
  })
  @JoinColumn({ name: 'perspective_id' })
  perspective: Perspective;

  @Column({ type: 'date', nullable: true })
  start_date: string;

  @Column({ type: 'date', nullable: true })
  end_date: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  memo: string;

  @Column({
    type: 'enum',
    enum: KpiDefinitionStatus,
    default: KpiDefinitionStatus.DRAFT,
    nullable: false,
  })
  status: KpiDefinitionStatus;

  @Column({
    type: 'numeric', 
    nullable: true, 
    default: null, 
  })
  actual_value: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  created_by_type: 'company' | 'department' | 'section' | 'employee';

  @Column({ nullable: true })
  created_by: number;

  @ManyToOne(() => Employee, { nullable: true, eager: false })
  @JoinColumn({ name: 'created_by' })
  createdBy?: Employee;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ nullable: true })
  deleted_by: number;

  @DeleteDateColumn()
  deleted_at?: Date;

  @OneToMany(() => KPIAssignment, (assignment) => assignment.kpi, {
    eager: true,
  })
  assignments: KPIAssignment[];

  @ManyToOne(() => KpiFormula, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'formula_id' })
  formula?: KpiFormula;

  @Column({ nullable: true })
  formula_id?: number;

  @ManyToOne(() => StrategicObjective, (so) => so.kpis, { nullable: true, onDelete: 'SET NULL' })
  strategicObjective: StrategicObjective;
}
