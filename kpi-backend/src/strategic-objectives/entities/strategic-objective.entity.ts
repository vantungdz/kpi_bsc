import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Perspective } from '../../perspective/entities/perspective.entity';
import { Kpi } from '../../kpis/entities/kpi.entity';

/**
 * Entity representing Strategic Objective (strategic goal)
 * Each strategic objective belongs to one Perspective and can have multiple KPIs
 */
@Entity()
export class StrategicObjective {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column('text', { nullable: true })
  description?: string;

  /**
   * Perspective that this strategic objective belongs to
   */
  @ManyToOne(
    () => Perspective,
    (perspective) => perspective.strategicObjectives,
    { nullable: false },
  )
  perspective: Perspective;

  /**
   * Danh sách KPI thuộc mục tiêu chiến lược này
   */
  @OneToMany(() => Kpi, (kpi) => kpi.strategicObjective)
  kpis: Kpi[];

  @Column({ type: 'date', nullable: true })
  startDate?: Date;

  @Column({ type: 'date', nullable: true })
  endDate?: Date;

  @Column({ default: true })
  isActive: boolean;
}
