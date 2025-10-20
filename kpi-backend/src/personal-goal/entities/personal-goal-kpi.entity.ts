import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PersonalGoal } from './personal-goal.entity';
import { Kpi } from '../../kpis/entities/kpi.entity';

/**
 * Entity linking PersonalGoal and KPI
 * Each record represents a KPI belonging to a personal goal (PersonalGoal)
 */
@Entity('personal_goal_kpis')
export class PersonalGoalKpi {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  personalGoalId: number;

  /**
   * Link to PersonalGoal, deleting PersonalGoal will also delete these links
   */
  @ManyToOne(() => PersonalGoal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'personalGoalId' })
  personalGoal: PersonalGoal;

  @Column()
  kpiId: number;

  /**
   * Link to KPI, deleting KPI will also delete these links
   */
  @ManyToOne(() => Kpi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kpiId' })
  kpi: Kpi;
}
