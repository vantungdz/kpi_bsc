import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { PersonalGoal } from '../personal-goal/personal-goal.entity';
import { Kpi } from '../entities/kpi.entity';

@Entity('personal_goal_kpis')
export class PersonalGoalKpi {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  personalGoalId: number;

  @ManyToOne(() => PersonalGoal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'personalGoalId' })
  personalGoal: PersonalGoal;

  @Column()
  kpiId: number;

  @ManyToOne(() => Kpi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kpiId' })
  kpi: Kpi;
}
