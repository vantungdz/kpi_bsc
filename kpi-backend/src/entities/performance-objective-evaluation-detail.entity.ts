import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PerformanceObjectiveEvaluation } from './performance-objective-evaluation.entity';
import { Exclude } from 'class-transformer'; // Import Exclude
import { Kpi } from './kpi.entity'; 

@Entity('performance_objective_evaluation_details')
export class PerformanceObjectiveEvaluationDetail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  evaluation_id: number;

  @ManyToOne(
    () => PerformanceObjectiveEvaluation,
    (evaluation) => evaluation.details,
  )
  @JoinColumn({ name: 'evaluation_id' })
  @Exclude() // Exclude this property from serialization
  evaluation: PerformanceObjectiveEvaluation;

  @Column()
  performance_objective_id: number; 

  @ManyToOne(() => Kpi) 
  @JoinColumn({ name: 'performance_objective_id' })
  performanceObjective: Kpi; 

  @Column('decimal', { nullable: true })
  score: number | null; 

  @Column({ type: 'text', nullable: true })
  note: string | null; 
}
