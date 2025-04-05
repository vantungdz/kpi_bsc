import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KpiValue } from '../entities/kpi-value.entity';

@Injectable()
export class KpiValuesService {
  constructor(
    @InjectRepository(KpiValue)
    private kpiValuesRepository: Repository<KpiValue>,
  ) {}

  async findAll(): Promise<KpiValue[]> {
    return await this.kpiValuesRepository.find({
      relations: [
        'kpi', // KPI liên quan
        'kpi.assignedTo', // Người được giao KPI
        'user', // Người nhập giá trị
      ],
    });
  }

  async findOne(id: number ): Promise<KpiValue> {
    const data = await this.kpiValuesRepository.findOne({
      where: { id },
      relations: [
        'kpi',
        'kpi.assignedTo',
        'user',
      ],
    });

    if (!data) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return data;
  }

  async create(kpiValue: Partial<KpiValue>): Promise<KpiValue> {
    const newKpiValue = this.kpiValuesRepository.create(kpiValue);
    return this.kpiValuesRepository.save(newKpiValue);
  }

  async update(id: number, update: Partial<KpiValue>): Promise<KpiValue> {
    await this.kpiValuesRepository.update(id, update);
    return this.findOne(id);
  }

  async delete(id: number): Promise<void> {
    await this.kpiValuesRepository.delete(id);
  }
}
