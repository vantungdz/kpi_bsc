import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  DeleteDateColumn,
  TreeParent,
  Tree,
} from 'typeorm';
import { User } from './user.entity';
import { KpiValue } from './kpi-value.entity';
import { KpiEvaluation } from './kpi-evaluation.entity';
import { Department } from './department.entity';
import { Section } from './section.entity';
import { Team } from './team.entity';
import { Perspective } from './perspective.entity';

@Entity('kpis')
@Tree('materialized-path')
export class Kpi {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

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

  @Column('numeric', { precision: 5, scale: 2, default: 0 })
  weight: number;

  @ManyToOne(() => User, (user) => user.assignedKpis)
  @JoinColumn({ name: 'assigned_to_id' }) // Ánh xạ rõ ràng với cột trong schema
  assignedTo: User;

  @Column({ nullable: true })
  assigned_to_id: number;

  @ManyToOne(() => Kpi, (kpi) => kpi.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id' })
  @TreeParent({ onDelete: 'SET NULL' })
  parent: Kpi;

  @Column({ nullable: true })
  parent_id: number;

  @Column({ type: 'ltree', nullable: true })
  path: string;

  @ManyToOne(() => Department, (department) => department.kpis, {
    nullable: true,
  })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ nullable: true })
  department_id: number;

  @ManyToOne(() => Section, (section) => section.kpis, { nullable: true })
  @JoinColumn({ name: 'section_id' })
  section: Section;

  @Column({ nullable: true })
  section_id: number;

  @ManyToOne(() => Team, (team) => team.kpis, { nullable: true })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @ManyToOne(() => Perspective, (perspective) => perspective.kpis, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'perspective_id' })
  perspective: Perspective;

  @Column({ nullable: true })
  perspective_id: number;

  @Column({ nullable: true })
  team_id: number;

  @Column({ type: 'date', nullable: true })
  start_date: string;

  @Column({ type: 'date', nullable: true })
  end_date: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'Active',
    enum: ['Active', 'Inactive'],
  })
  status: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @OneToMany(() => Kpi, (kpi) => kpi.parent)
  @TreeParent({ onDelete: 'SET NULL' })
  children: Kpi[];

  @OneToMany(() => KpiEvaluation, (evaluation) => evaluation.kpi)
  evaluations: KpiEvaluation[];

  @OneToMany(() => KpiValue, (value) => value.kpi)
  values: KpiValue[];

  @DeleteDateColumn()
  deletedAt?: Date;
}
