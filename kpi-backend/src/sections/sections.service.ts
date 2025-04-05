import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Section } from '../entities/section.entity';

@Injectable()
export class SectionsService {
  constructor(
    @InjectRepository(Section)
    private sectionsRepository: Repository<Section>,
  ) {}

  async findAll(): Promise<Section[]> {
    return await this.sectionsRepository.find({
      relations: [
        'department', // Phòng ban chứa section
        'teams', // Các team trong section
        'teams.kpis', // KPI của các team
        'kpis', // KPI trực tiếp thuộc section
        'kpis.assignedTo', // Người được giao KPI
        'kpis.evaluations', // Đánh giá của KPI
        'userUnits', // Người dùng thuộc section
        'userUnits.user',
      ],
    });
  }

  async findOne(id: number): Promise<Section> {
    const relationsDtaa = await this.sectionsRepository.findOne({
      where: { id },
      relations: [
        'department', // Phòng ban chứa section
        'teams', // Các team trong section
        'teams.kpis', // KPI của các team
        'kpis', // KPI trực tiếp thuộc section
        'kpis.assignedTo', // Người được giao KPI
        'kpis.evaluations', // Đánh giá của KPI
        'userUnits', // Người dùng thuộc section
        'userUnits.user',
      ],
    });

    if (!relationsDtaa) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return relationsDtaa;
  }

  async create(section: Partial<Section>): Promise<Section> {
    const newSection = this.sectionsRepository.create(section);
    return this.sectionsRepository.save(newSection);
  }

  async update(id: number, update: Partial<Section>): Promise<Section> {
    await this.sectionsRepository.update(id, update);
    return this.findOne(id);
  }

  async delete(id: number): Promise<void> {
    await this.sectionsRepository.delete(id);
  }
}
