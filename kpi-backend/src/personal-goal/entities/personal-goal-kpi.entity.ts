import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { PersonalGoal } from './personal-goal.entity';
import { Kpi } from '../../kpis/entities/kpi.entity';

/**
 * Entity liên kết giữa PersonalGoal và KPI
 * Mỗi bản ghi đại diện cho một KPI thuộc về một mục tiêu cá nhân (PersonalGoal)
 */
@Entity('personal_goal_kpis')
export class PersonalGoalKpi {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  personalGoalId: number;

  /**
   * Liên kết tới PersonalGoal, xóa PersonalGoal sẽ xóa luôn các liên kết này
   */
  @ManyToOne(() => PersonalGoal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'personalGoalId' })
  personalGoal: PersonalGoal;

  @Column()
  kpiId: number;

  /**
   * Liên kết tới KPI, xóa KPI sẽ xóa luôn các liên kết này
   */
  @ManyToOne(() => Kpi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kpiId' })
  kpi: Kpi;
}
