
import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';
import { PerformanceObjectiveEvaluation } from './performance-objective-evaluation.entity'; 

@Entity('review_cycles') 
export class ReviewCycle {
  @PrimaryColumn() 
  id: string; 

  @Column()
  name: string;

  
  @OneToMany(
    () => PerformanceObjectiveEvaluation,
    (evaluation) => evaluation.reviewCycle,
  )
  objectiveEvaluations: PerformanceObjectiveEvaluation[];

  
}
