import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Section } from 'src/entities/section.entity';
import { Department } from 'src/entities/department.entity';
import { Employee } from 'src/entities/employee.entity';
import { EmployeesService } from '../employees/employees.service';

import { Repository } from 'typeorm';

@Injectable()
export class SectionsService {
  constructor(
    @InjectRepository(Section)
    private readonly sectionRepository: Repository<Section>,
    private readonly employeesService: EmployeesService, // Inject EmployeesService
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
    const savedSection = await this.sectionRepository.save(section);
    // Update manager's roles if managerId exists
    if (createSectionDto.managerId) {
      const manager = await this.employeesService.findOne(createSectionDto.managerId);
      const currentRoles = manager.roles?.map(r => typeof r === 'string' ? r : r.name) || [];
      if (!currentRoles.includes('section')) {
        await this.employeesService.updateRoles(manager.id, [...currentRoles, 'section']);
      }
    }
    return savedSection;
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
        // Tìm employee có roles chứa 'section' và sectionId = section.id
        const manager = await this.sectionRepository.manager
          .getRepository(Employee)
          .createQueryBuilder('employee')
          .leftJoinAndSelect('employee.roles', 'role')
          .where('employee.sectionId = :sectionId', { sectionId: section.id })
          .andWhere('role.name = :roleName', { roleName: 'section' })
          .getOne();
        if (manager) {
          section.manager = manager;
          section.managerId = manager.id;
        }
      }
    }
    return sections;
  }

  async update(id: number, updateSectionDto: any): Promise<Section> {
    const section = await this.sectionRepository.findOne({ where: { id } });
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    if (updateSectionDto.name !== undefined) {
      section.name = updateSectionDto.name;
    }
    if (updateSectionDto.departmentId !== undefined) {
      section.department = { id: updateSectionDto.departmentId } as Department;
    }
    if (updateSectionDto.managerId !== undefined) {
      section.managerId = updateSectionDto.managerId;
    }
    const saved = await this.sectionRepository.save(section);
    // Update manager's roles nếu cần
    if (updateSectionDto.managerId) {
      const manager = await this.employeesService.findOne(updateSectionDto.managerId);
      const currentRoles = manager.roles?.map(r => typeof r === 'string' ? r : r.name) || [];
      if (!currentRoles.includes('section')) {
        await this.employeesService.updateRoles(manager.id, [...currentRoles, 'section']);
      }
    }
    return saved;
  }

  async remove(id: number): Promise<void> {
    // Kiểm tra còn nhân viên nào thuộc section này không
    const employeeCount = await this.sectionRepository.manager
      .getRepository(Employee)
      .count({ where: { sectionId: id } });
    if (employeeCount > 0) {
      throw new BadRequestException('Không thể xóa section: vẫn còn nhân viên thuộc section này.');
    }
    await this.sectionRepository.delete(id);
  }
}
