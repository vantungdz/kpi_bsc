import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewCycle } from '../entities/review-cycle.entity';

@Injectable()
export class ReviewCycleService {
  constructor(
    @InjectRepository(ReviewCycle)
    private readonly reviewCycleRepository: Repository<ReviewCycle>,
  ) {}

  async findAll(): Promise<ReviewCycle[]> {
    return this.reviewCycleRepository.find({ order: { name: 'ASC' } });
  }

  async create(
    name: string,
    startDate: string,
    endDate: string,
  ): Promise<ReviewCycle> {
    const cycle = this.reviewCycleRepository.create({
      name,
      startDate,
      endDate,
    });
    return this.reviewCycleRepository.save(cycle);
  }

  async update(
    id: number,
    name: string,
    startDate: string,
    endDate: string,
  ): Promise<ReviewCycle> {
    const cycle = await this.reviewCycleRepository.findOneBy({ id });
    if (!cycle) throw new Error('Review cycle not found');
    cycle.name = name;
    cycle.startDate = new Date(startDate);
    cycle.endDate = new Date(endDate);
    return this.reviewCycleRepository.save(cycle);
  }

  async remove(id: string): Promise<void> {
    await this.reviewCycleRepository.delete(id);
  }
}
