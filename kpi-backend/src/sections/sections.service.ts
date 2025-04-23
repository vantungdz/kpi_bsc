// src/sections/section.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { KPIAssignment } from 'src/entities/kpi-assignment.entity';
import { Section } from 'src/entities/section.entity';
import { IsNull, Not, Repository } from 'typeorm';

@Injectable()
export class SectionsService {
  constructor(
    @InjectRepository(Section)
    private readonly sectionRepository: Repository<Section>,
    @InjectRepository(KPIAssignment)
    private readonly kpiAssignmentRepository: Repository<KPIAssignment>,
  ) {}

  async create(createSectionDto: Section): Promise<Section> {
    const section = this.sectionRepository.create(createSectionDto);

    if (!section) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return section;
  }

  async findAll(): Promise<Section[]> {
    return this.sectionRepository.find();
  }

  async findOne(id: number): Promise<Section> {
    const user = await this.sectionRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async getFilteredSections(
    kpiId?: number,
    departmentId?: number,
  ): Promise<Section[]> {
    let sections: Section[] = [];

    if (kpiId) {
      // Fetch sections assigned to the KPI
      const assignments = await this.kpiAssignmentRepository.find({
        where: {
          kpi: { id: kpiId },
          assigned_to_section: Not(IsNull()),
        },
        relations: ['section', 'section.department'], // include department for filtering
      });

      const rawSections = assignments
        .map((a) => a.section)
        .filter((section) => section !== null);

      // Deduplicate sections
      const uniqueSections = Array.from(
        new Map(rawSections.map((s) => [s.id, s])).values(),
      );

      // If departmentId is also provided, filter further
      if (departmentId) {
        sections = uniqueSections.filter(
          (section) => section.department?.id === departmentId,
        );
      } else {
        sections = uniqueSections;
      }
    } else if (departmentId) {
      // Only department filter
      sections = await this.sectionRepository.find({
        where: { department: { id: departmentId } },
        relations: ['department'],
      });
    } else {
      // No filters
      sections = await this.sectionRepository.find();
    }

    return sections;
  }
}
