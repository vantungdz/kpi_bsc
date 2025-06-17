import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KpiEvaluation } from './entities/kpi-evaluation.entity';

@Injectable()
export class KpiEvaluationsService {
  constructor(
    @InjectRepository(KpiEvaluation)
    private kpiEvaluationsRepository: Repository<KpiEvaluation>,
  ) {}

  async findAll(): Promise<KpiEvaluation[]> {
    return await this.kpiEvaluationsRepository.find({});
  }

  async findOne(id: number): Promise<KpiEvaluation> {
    const relationsDta = await this.kpiEvaluationsRepository.findOne({
      where: { id },
    });

    if (!relationsDta) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return relationsDta;
  }

  async create(evaluation: Partial<KpiEvaluation>): Promise<KpiEvaluation> {
    const newEvaluation = this.kpiEvaluationsRepository.create(evaluation);
    return this.kpiEvaluationsRepository.save(newEvaluation);
  }

  async update(
    id: number,
    update: Partial<KpiEvaluation>,
  ): Promise<KpiEvaluation> {
    await this.kpiEvaluationsRepository.update(id, update);
    return this.findOne(id);
  }

  async delete(id: number): Promise<void> {
    await this.kpiEvaluationsRepository.delete(id);
  }

  
}
