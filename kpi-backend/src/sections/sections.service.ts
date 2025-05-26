import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Section } from 'src/entities/section.entity';
import { Department } from 'src/entities/department.entity';
import { Employee } from 'src/entities/employee.entity';

import { Repository } from 'typeorm';

@Injectable()
export class SectionsService {
  constructor(
    @InjectRepository(Section)
    private readonly sectionRepository: Repository<Section>,
  ) {}

  async create(createSectionDto: any): Promise<Section> {
    const created = this.sectionRepository.create(createSectionDto);
    const section = Array.isArray(created) ? created[0] : created;
    if (createSectionDto.departmentId) {
      section.department = { id: createSectionDto.departmentId } as Department;
    }
    if (createSectionDto.managerId) {
      section.managerId = createSectionDto.managerId;
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
    const relationsToLoad = ['department', 'manager'];

    if (departmentId) {
      sections = await this.sectionRepository.find({
        where: { department: { id: departmentId } },
        relations: relationsToLoad,
      });
    } else {
      sections = await this.sectionRepository.find({
        relations: relationsToLoad,
      });
    }

    // Auto-populate manager if missing, by finding employee with role 'section' and sectionId = section.id
    for (const section of sections) {
      if (!section.managerId) {
        const manager = await this.sectionRepository.manager
          .getRepository(Employee)
          .findOne({
            where: {
              sectionId: section.id,
              role: { name: 'section' },
            },
            relations: ['role'],
          });
        if (manager) {
          section.manager = manager;
          section.managerId = manager.id;
        }
      }
    }
    return sections;
  }
}
