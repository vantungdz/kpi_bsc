import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Competency } from '../competency/entities/competency.entity';
import { CreateCompetencyDto, UpdateCompetencyDto } from './dto/competency.dto';

@Injectable()
export class CompetencyService {
  constructor(
    @InjectRepository(Competency)
    private readonly competencyRepository: Repository<Competency>,
  ) {}

  async create(dto: CreateCompetencyDto): Promise<Competency> {
    const competency = this.competencyRepository.create(dto);
    return this.competencyRepository.save(competency);
  }

  async findAll(): Promise<Competency[]> {
    return this.competencyRepository.find();
  }

  async findOne(id: number): Promise<Competency> {
    const competency = await this.competencyRepository.findOne({ where: { id } });
    if (!competency) throw new NotFoundException('Competency not found');
    return competency;
  }

  async update(id: number, dto: UpdateCompetencyDto): Promise<Competency> {
    await this.competencyRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.competencyRepository.delete(id);
  }
}
