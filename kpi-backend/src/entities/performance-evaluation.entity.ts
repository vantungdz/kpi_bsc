import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

@Entity('performance_evaluation')
export class PerformanceEvaluation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  rank: number;

  @Column({ type: 'date', nullable: true })
  target_date: Date;

  @Column({ default: 0 })
  total_score: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0.0 })
  average_score: number;

  @Column({ type: 'text', nullable: true })
  employee_comment: string;

  @Column({ type: 'text', nullable: true })
  supervisor_comment: string;

  @Column({ default: false })
  employee_confirmation: boolean;

  @Column({ default: false })
  supervisor_confirmation: boolean;

  // A1
  @Column({ type: 'text', nullable: true })
  a1_objective_description: string;

  @Column({ nullable: true })
  a1_target_standard: string;

  @Column({ type: 'text', nullable: true })
  a1_how_to_achieve: string;

  @Column({ type: 'text', nullable: true })
  a1_actual_result: string;

  @Column({ default: 0 })
  a1_weight: number;

  @Column({ default: 0 })
  a1_self_evaluation_score: number;

  @Column({ default: 0 })
  a1_supervisor_evaluation_score: number;

  // A2
  @Column({ type: 'text', nullable: true })
  a2_objective_description: string;

  @Column({ nullable: true })
  a2_target_standard: string;

  @Column({ type: 'text', nullable: true })
  a2_how_to_achieve: string;

  @Column({ type: 'text', nullable: true })
  a2_actual_result: string;

  @Column({ default: 0 })
  a2_weight: number;

  @Column({ default: 0 })
  a2_self_evaluation_score: number;

  @Column({ default: 0 })
  a2_supervisor_evaluation_score: number;

  // A3
  @Column({ type: 'text', nullable: true })
  a3_objective_description: string;

  @Column({ nullable: true })
  a3_target_standard: string;

  @Column({ type: 'text', nullable: true })
  a3_how_to_achieve: string;

  @Column({ type: 'text', nullable: true })
  a3_actual_result: string;

  @Column({ default: 0 })
  a3_weight: number;

  @Column({ default: 0 })
  a3_self_evaluation_score: number;

  @Column({ default: 0 })
  a3_supervisor_evaluation_score: number;

  // A4
  @Column({ type: 'text', nullable: true })
  a4_objective_description: string;

  @Column({ nullable: true })
  a4_target_standard: string;

  @Column({ type: 'text', nullable: true })
  a4_how_to_achieve: string;

  @Column({ type: 'text', nullable: true })
  a4_actual_result: string;

  @Column({ default: 0 })
  a4_weight: number;

  @Column({ default: 0 })
  a4_self_evaluation_score: number;

  @Column({ default: 0 })
  a4_supervisor_evaluation_score: number;

  // A5
  @Column({ type: 'text', nullable: true })
  a5_objective_description: string;

  @Column({ nullable: true })
  a5_target_standard: string;

  @Column({ type: 'text', nullable: true })
  a5_how_to_achieve: string;

  @Column({ type: 'text', nullable: true })
  a5_actual_result: string;

  @Column({ default: 0 })
  a5_weight: number;

  @Column({ default: 0 })
  a5_self_evaluation_score: number;

  @Column({ default: 0 })
  a5_supervisor_evaluation_score: number;

  // A6
  @Column({ type: 'text', nullable: true })
  a6_objective_description: string;

  @Column({ nullable: true })
  a6_target_standard: string;

  @Column({ type: 'text', nullable: true })
  a6_how_to_achieve: string;

  @Column({ type: 'text', nullable: true })
  a6_actual_result: string;

  @Column({ default: 0 })
  a6_weight: number;

  @Column({ default: 0 })
  a6_self_evaluation_score: number;

  @Column({ default: 0 })
  a6_supervisor_evaluation_score: number;

  // A7
  @Column({ type: 'text', nullable: true })
  a7_objective_description: string;

  @Column({ nullable: true })
  a7_target_standard: string;

  @Column({ type: 'text', nullable: true })
  a7_how_to_achieve: string;

  @Column({ type: 'text', nullable: true })
  a7_actual_result: string;

  @Column({ default: 0 })
  a7_weight: number;

  @Column({ default: 0 })
  a7_self_evaluation_score: number;

  @Column({ default: 0 })
  a7_supervisor_evaluation_score: number;

  // A8
  @Column({ type: 'text', nullable: true })
  a8_objective_description: string;

  @Column({ nullable: true })
  a8_target_standard: string;

  @Column({ type: 'text', nullable: true })
  a8_how_to_achieve: string;

  @Column({ type: 'text', nullable: true })
  a8_actual_result: string;

  @Column({ default: 0 })
  a8_weight: number;

  @Column({ default: 0 })
  a8_self_evaluation_score: number;

  @Column({ default: 0 })
  a8_supervisor_evaluation_score: number;

  // B1
  @Column({ type: 'text', nullable: true })
  b1_objective_description: string;

  @Column({ nullable: true })
  b1_target_standard: string;

  @Column({ type: 'text', nullable: true })
  b1_how_to_achieve: string;

  @Column({ type: 'text', nullable: true })
  b1_actual_result: string;

  @Column({ default: 0 })
  b1_weight: number;

  @Column({ default: 0 })
  b1_self_evaluation_score: number;

  @Column({ default: 0 })
  b1_supervisor_evaluation_score: number;

  // B2
  @Column({ type: 'text', nullable: true })
  b2_objective_description: string;

  @Column({ nullable: true })
  b2_target_standard: string;

  @Column({ type: 'text', nullable: true })
  b2_how_to_achieve: string;

  @Column({ type: 'text', nullable: true })
  b2_actual_result: string;

  @Column({ default: 0 })
  b2_weight: number;

  @Column({ default: 0 })
  b2_self_evaluation_score: number;

  @Column({ default: 0 })
  b2_supervisor_evaluation_score: number;

  // B3
  @Column({ type: 'text', nullable: true })
  b3_objective_description: string;

  @Column({ nullable: true })
  b3_target_standard: string;

  @Column({ type: 'text', nullable: true })
  b3_how_to_achieve: string;

  @Column({ type: 'text', nullable: true })
  b3_actual_result: string;

  @Column({ default: 0 })
  b3_weight: number;

  @Column({ default: 0 })
  b3_self_evaluation_score: number;

  @Column({ default: 0 })
  b3_supervisor_evaluation_score: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  // Logic tính toán trước khi insert hoặc update
  @BeforeInsert()
  @BeforeUpdate()
  calculateScores() {
    const totalWeight = 160; // Tổng trọng số

    // Tính IE = Ʃ (IEi x Wi) / Ʃ (Wi)
    const ieNumerator =
      (this.a1_supervisor_evaluation_score || 0) * this.a1_weight +
      (this.a2_supervisor_evaluation_score || 0) * this.a2_weight +
      (this.a3_supervisor_evaluation_score || 0) * this.a3_weight +
      (this.a4_supervisor_evaluation_score || 0) * this.a4_weight +
      (this.a5_supervisor_evaluation_score || 0) * this.a5_weight +
      (this.a6_supervisor_evaluation_score || 0) * this.a6_weight +
      (this.a7_supervisor_evaluation_score || 0) * this.a7_weight +
      (this.a8_supervisor_evaluation_score || 0) * this.a8_weight +
      (this.b1_supervisor_evaluation_score || 0) * this.b1_weight +
      (this.b2_supervisor_evaluation_score || 0) * this.b2_weight +
      (this.b3_supervisor_evaluation_score || 0) * this.b3_weight;

    const ieDenominator =
      this.a1_weight +
      this.a2_weight +
      this.a3_weight +
      this.a4_weight +
      this.a5_weight +
      this.a6_weight +
      this.a7_weight +
      this.a8_weight +
      this.b1_weight +
      this.b2_weight +
      this.b3_weight;

    const ie = ieDenominator > 0 ? ieNumerator / ieDenominator : 0;
    this.a1_supervisor_evaluation_score = Math.round(ie); // Gán IE vào a1_supervisor_evaluation_score

    // Tính total_score
    this.total_score =
      (this.a1_supervisor_evaluation_score || 0) * this.a1_weight +
      (this.a2_supervisor_evaluation_score || 0) * this.a2_weight +
      (this.a3_supervisor_evaluation_score || 0) * this.a3_weight +
      (this.a4_supervisor_evaluation_score || 0) * this.a4_weight +
      (this.a5_supervisor_evaluation_score || 0) * this.a5_weight +
      (this.a6_supervisor_evaluation_score || 0) * this.a6_weight +
      (this.a7_supervisor_evaluation_score || 0) * this.a7_weight +
      (this.a8_supervisor_evaluation_score || 0) * this.a8_weight +
      (this.b1_supervisor_evaluation_score || 0) * this.b1_weight +
      (this.b2_supervisor_evaluation_score || 0) * this.b2_weight +
      (this.b3_supervisor_evaluation_score || 0) * this.b3_weight;

    // Tính average_score
    this.average_score =
      totalWeight > 0
        ? Number((this.total_score / totalWeight).toFixed(2))
        : 0.0;
  }
}
