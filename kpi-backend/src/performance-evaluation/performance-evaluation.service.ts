import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PerformanceEvaluation } from 'src/entities/performance-evaluation.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PerformanceEvaluationService {
  constructor(
    @InjectRepository(PerformanceEvaluation)
    private readonly performanceEvaluationRepository: Repository<PerformanceEvaluation>,
  ) {}

  private calculateScores(performanceEvaluation: PerformanceEvaluation): void {
    const totalWeight = 160;

    performanceEvaluation.total_score =
      (performanceEvaluation.a1_supervisor_evaluation_score || 0) *
        performanceEvaluation.a1_weight +
      (performanceEvaluation.a2_supervisor_evaluation_score || 0) *
        performanceEvaluation.a2_weight +
      (performanceEvaluation.a3_supervisor_evaluation_score || 0) *
        performanceEvaluation.a3_weight +
      (performanceEvaluation.a4_supervisor_evaluation_score || 0) *
        performanceEvaluation.a4_weight +
      (performanceEvaluation.a5_supervisor_evaluation_score || 0) *
        performanceEvaluation.a5_weight +
      (performanceEvaluation.a6_supervisor_evaluation_score || 0) *
        performanceEvaluation.a6_weight +
      (performanceEvaluation.a7_supervisor_evaluation_score || 0) *
        performanceEvaluation.a7_weight +
      (performanceEvaluation.a8_supervisor_evaluation_score || 0) *
        performanceEvaluation.a8_weight +
      (performanceEvaluation.b1_supervisor_evaluation_score || 0) *
        performanceEvaluation.b1_weight +
      (performanceEvaluation.b2_supervisor_evaluation_score || 0) *
        performanceEvaluation.b2_weight +
      (performanceEvaluation.b3_supervisor_evaluation_score || 0) *
        performanceEvaluation.b3_weight;

    performanceEvaluation.average_score =
      totalWeight > 0
        ? Number((performanceEvaluation.total_score / totalWeight).toFixed(2))
        : 0.0;
  }

  async create(
    performanceEvaluation: Partial<PerformanceEvaluation>,
  ): Promise<PerformanceEvaluation> {
    const newEvaluation = this.performanceEvaluationRepository.create(
      performanceEvaluation,
    );
    this.calculateScores(newEvaluation);
    return this.performanceEvaluationRepository.save(newEvaluation);
  }

  async findAll(): Promise<PerformanceEvaluation[]> {
    return this.performanceEvaluationRepository.find();
  }

  async findOne(id: number): Promise<PerformanceEvaluation> {
    const data = await this.performanceEvaluationRepository.findOneBy({ id });
    if (!data) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return data;
  }

  async update(
    id: number,
    updateData: Partial<PerformanceEvaluation>,
  ): Promise<PerformanceEvaluation> {
    const evaluation = await this.findOne(id);
    if (!evaluation) {
      throw new Error('Performance evaluation not found');
    }
    Object.assign(evaluation, updateData);
    this.calculateScores(evaluation);
    return this.performanceEvaluationRepository.save(evaluation);
  }

  async remove(id: number): Promise<void> {
    await this.performanceEvaluationRepository.delete(id);
  }
}
