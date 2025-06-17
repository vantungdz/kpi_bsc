import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Kpi } from '../../kpis/entities/kpi.entity';
import { StrategicObjective } from '../../strategic-objectives/entities/strategic-objective.entity';

/**
 * Entity đại diện cho một Perspective (góc nhìn chiến lược)
 * Mỗi perspective có thể chứa nhiều KPI và nhiều StrategicObjective
 */
@Entity('perspectives')
export class Perspective {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  /**
   * Danh sách các KPI thuộc perspective này
   */
  @OneToMany(() => Kpi, (kpi) => kpi.perspective)
  kpis: Kpi[];

  /**
   * Danh sách các mục tiêu chiến lược thuộc perspective này
   */
  @OneToMany(() => StrategicObjective, (so) => so.perspective)
  strategicObjectives: StrategicObjective[];
}
