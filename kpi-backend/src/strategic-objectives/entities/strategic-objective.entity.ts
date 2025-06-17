import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { Perspective } from '../../perspective/entities/perspective.entity';
import { Kpi } from '../../kpis/entities/kpi.entity';

/**
 * Entity đại diện cho Strategic Objective (mục tiêu chiến lược)
 * Mỗi mục tiêu chiến lược thuộc về một Perspective và có thể có nhiều KPI
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
   * Perspective mà mục tiêu chiến lược này thuộc về
   */
  @ManyToOne(() => Perspective, perspective => perspective.strategicObjectives, { nullable: false })
  perspective: Perspective;

  /**
   * Danh sách KPI thuộc mục tiêu chiến lược này
   */
  @OneToMany(() => Kpi, kpi => kpi.strategicObjective)
  kpis: Kpi[];

  @Column({ type: 'date', nullable: true })
  startDate?: Date;

  @Column({ type: 'date', nullable: true })
  endDate?: Date;

  @Column({ default: true })
  isActive: boolean;
}
