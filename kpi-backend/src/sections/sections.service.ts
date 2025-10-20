import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Section } from 'src/sections/entities/section.entity';
import { Department } from 'src/departments/entities/department.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { EmployeesService } from '../employees/employees.service';
import { Repository } from 'typeorm';

@Injectable()
export class SectionsService {
  constructor(
    @InjectRepository(Section)
    private readonly sectionRepository: Repository<Section>,
    private readonly employeesService: EmployeesService,
  ) {}

  /**
   * Create a new section.
   * If manager already manages another section, return warning (unless forceUpdateManager).
   * If there is a manager, update manager info and old section (if any).
   * @param createSectionDto Section creation data
   * @returns Created section or warning if manager already manages another section
   */
  async create(
    createSectionDto: any,
  ): Promise<Section | { warning: string; employee: any }> {
    const created = this.sectionRepository.create(createSectionDto);
    const section = Array.isArray(created) ? created[0] : created;
    if (createSectionDto.departmentId) {
      section.department = { id: createSectionDto.departmentId } as Department;
    }
    if (createSectionDto.managerId) {
      section.managerId = createSectionDto.managerId;
      const manager = await this.employeesService.findOne(
        createSectionDto.managerId,
      );
      const hasOtherSection = !!manager.sectionId;

      if (hasOtherSection && !createSectionDto.forceUpdateManager) {
        return {
          warning: `This employee is already managing another section. If you continue, the old section will be changed.`,
          employee: manager,
        };
      }
    }

    const savedSection = await this.sectionRepository.save(section);

    if (createSectionDto.managerId) {
      const manager = await this.employeesService.findOne(
        createSectionDto.managerId,
      );

      if (manager.sectionId && manager.sectionId !== savedSection.id) {
        const oldSection = await this.sectionRepository.findOne({
          where: { id: manager.sectionId },
        });
        if (oldSection && oldSection.managerId === manager.id) {
          oldSection.managerId = null;
          await this.sectionRepository.save(oldSection);
        }
      }
      // Use flexible management permission assignment instead of hard-coded 'manager' role
      await this.employeesService.assignManagementPermissions(
        createSectionDto.managerId,
        {
          type: 'section',
          resourceId: savedSection.id,
          scope: 'section',
        },
      );
    }
    return savedSection;
  }

  /**
   * Get all sections with related department information.
   * @returns List of sections
   */
  async findAll(): Promise<Section[]> {
    return this.sectionRepository.find({ relations: ['department'] });
  }

  /**
   * Get section information by id with department information.
   * @param id Section id
   * @returns Section or throw NotFoundException if not found
   */
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
   * Get list of sections, optionally filtered by departmentId.
   * Always loads related department and manager information.
   * If manager is missing, automatically find employee with role 'section' and corresponding sectionId.
   * @param departmentId Department ID to filter by (optional)
   * @returns List of sections with department and manager information
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

    for (const section of sections) {
      if (!section.managerId) {
        const manager = await this.sectionRepository.manager
          .getRepository(Employee)
          .createQueryBuilder('employee')
          .leftJoinAndSelect('employee.roles', 'role')
          .where('employee.sectionId = :sectionId', { sectionId: section.id })
          .andWhere('role.name = :roleName', { roleName: 'manager' })
          .getOne();
        if (manager) {
          section.manager = manager;
          section.managerId = manager.id;
        }
      }
    }
    return sections;
  }

  /**
   * Update section information.
   * If changing manager, check manager status and update related information.
   * @param id Section id
   * @param updateSectionDto Update data
   * @returns Updated section or warning if manager already manages another section
   */
  async update(
    id: number,
    updateSectionDto: any,
  ): Promise<Section | { warning: string; employee: any }> {
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

      const manager = await this.employeesService.findOne(
        updateSectionDto.managerId,
      );
      const hasOtherSection =
        manager.sectionId && manager.sectionId !== section.id;
      if (hasOtherSection && !updateSectionDto.forceUpdateManager) {
        return {
          warning: `This employee is already managing another section. If you continue, the old section will be changed.`,
          employee: manager,
        };
      }
    }
    const saved = await this.sectionRepository.save(section);

    // Assign management permissions AFTER saving section (so section.id exists)
    if (updateSectionDto.managerId) {
      const manager = await this.employeesService.findOne(
        updateSectionDto.managerId,
      );
      if (manager) {
        await this.employeesService.assignManagementPermissions(manager.id, {
          type: 'section',
          resourceId: saved.id,
          scope: 'section',
        });
      }
    }

    return saved;
  }

  /**
   * Delete section if no employees belong to this section.
   * If there are still employees, throw BadRequestException.
   * @param id Section id
   */
  async remove(id: number): Promise<void> {
    const employeeCount = await this.sectionRepository.manager
      .getRepository(Employee)
      .count({ where: { sectionId: id } });
    if (employeeCount > 0) {
      throw new BadRequestException(
        'Cannot delete section: there are still employees belonging to this section.',
      );
    }
    await this.sectionRepository.delete(id);
  }
}
