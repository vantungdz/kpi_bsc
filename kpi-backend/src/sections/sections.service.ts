import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Section } from 'src/entities/section.entity';
import { Department } from 'src/entities/department.entity';

import { Repository } from 'typeorm';

@Injectable()
export class SectionsService {
  constructor(
    @InjectRepository(Section)
    private readonly sectionRepository: Repository<Section>,
  ) {}

  async create(createSectionDto: Section): Promise<Section> {
    const section = this.sectionRepository.create(createSectionDto);

    if (!section) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.sectionRepository.save(section);
  }

  async findAll(): Promise<Section[]> {
    return this.sectionRepository.find({ relations: ['department'] });
  }

  async findOne(id: number): Promise<Section> {
    const section = await this.sectionRepository.findOne({
      where: { id },
      relations: ['department'],
    });

    if (!section) {
      throw new NotFoundException(`Section with ID ${id} not found`);
    }
    return section;
  }

  /**
   * Lấy danh sách sections, có thể lọc theo departmentId.
   * Luôn tải kèm thông tin department liên quan.
   * @param departmentId ID của department để lọc (tùy chọn)
   * @returns Promise<Section[]> Danh sách sections kèm thông tin department
   */
  async getFilteredSections(departmentId?: number): Promise<Section[]> {
    let sections: Section[] = [];
    const relationsToLoad = ['department'];

    if (departmentId) {
      console.log(
        `[SectionsService] Finding sections with departmentId: ${departmentId}`,
      );
      sections = await this.sectionRepository.find({
        where: { department: { id: departmentId } },
        relations: relationsToLoad,
      });
    } else {
      console.log(`[SectionsService] Finding all sections`);
      sections = await this.sectionRepository.find({
        relations: relationsToLoad,
      });
    }

    console.log(`[SectionsService] Returning ${sections.length} sections.`);

    return sections;
  }
}
