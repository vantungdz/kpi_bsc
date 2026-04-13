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
  ) { }

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
    // Get max sort_order and set new section's sort_order to max + 1
    const maxSortOrder = await this.sectionRepository
      .createQueryBuilder('section')
      .select('MAX(section.sort_order)', 'max')
      .getRawOne();

    const nextSortOrder = (maxSortOrder?.max || 0) + 1;

    console.log("nextSortOrder", nextSortOrder);

    const created = this.sectionRepository.create({
      ...createSectionDto,
      sort_order: nextSortOrder,
    });
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
   * @returns List of sections sorted by sort_order ASC
   */
  async findAll(): Promise<Section[]> {
    return this.sectionRepository
      .createQueryBuilder('section')
      .leftJoinAndSelect('section.department', 'department')
      .orderBy('section.sort_order', 'ASC')  // ← Explicitly use 'section.sort_order'
      .getMany();
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
   * Always loads related department and manager information from the section record itself.
   * @param departmentId Department ID to filter by (optional)
   * @returns List of sections with department and manager information, sorted by sort_order ASC
   */
  async getFilteredSections(departmentId?: number): Promise<Section[]> {
    const queryBuilder = this.sectionRepository
      .createQueryBuilder('section')
      .leftJoinAndSelect('section.department', 'department')
      .leftJoinAndSelect('section.manager', 'manager')
      .orderBy('section.sort_order', 'ASC');  // ← Explicitly use 'section.sort_order'

    if (departmentId) {
      queryBuilder.where('department.id = :departmentId', { departmentId });
    }

    return queryBuilder.getMany();
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

    // Capture old manager ID
    const oldManagerId = section.managerId;

    if (updateSectionDto.name !== undefined) {
      section.name = updateSectionDto.name;
    }
    if (updateSectionDto.departmentId !== undefined) {
      section.department = { id: updateSectionDto.departmentId } as Department;
    }
    if (updateSectionDto.managerId !== undefined) {
      // Only check for warning if managerId is actually changing
      const isManagerChanging = oldManagerId !== updateSectionDto.managerId;
      
      section.managerId = updateSectionDto.managerId;

      // Only validate manager if managerId is actually changing
      if (updateSectionDto.managerId && isManagerChanging) {
        const manager = await this.employeesService.findOne(
          updateSectionDto.managerId,
        );
        const hasOtherSection =
          manager.sectionId && manager.sectionId !== section.id;

        if (hasOtherSection) {
          if (!updateSectionDto.forceUpdateManager) {
            return {
              warning: `This employee is already managing another section. If you continue, the old section will be changed.`,
              employee: manager,
            };
          } else {
            // Force update: Clear the old section's manager
            const oldSection = await this.sectionRepository.findOne({
              where: { id: manager.sectionId },
            });
            if (oldSection && oldSection.managerId === manager.id) {
              oldSection.managerId = null;
              await this.sectionRepository.save(oldSection);
            }
          }
        }
      }
    }
    const saved = await this.sectionRepository.save(section);

    // CRITICAL FIX: Handle consistency for the OLD manager
    // If manager ID changed, the previous manager should no longer be linked to this section
    if (
      oldManagerId &&
      updateSectionDto.managerId !== undefined &&
      oldManagerId !== updateSectionDto.managerId
    ) {
      const oldManager = await this.employeesService.findOne(oldManagerId);
      // If the old manager is still linked to this section in their record, clear it
      if (oldManager && oldManager.sectionId === saved.id) {
        await this.employeesService.updateEmployee(oldManager.id, {
          sectionId: null,
        } as any);
      }
    }

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

  /**
   * Update sort order for multiple sections in bulk.
   * Validates input data and performs bulk update for performance.
   * @param sections Array of {id, sort_order} objects
   * @returns Success response or error message
   */
  async updateSortOrder(
    sections: Array<{ id: number; sort_order: number }>,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      // Validate that all IDs exist
      const sectionIds = sections.map((s) => s.id);
      const existingSections = await this.sectionRepository.findByIds(sectionIds);

      if (existingSections.length !== sectionIds.length) {
        const existingIds = existingSections.map((s) => s.id);
        const missingIds = sectionIds.filter((id) => !existingIds.includes(id));
        return {
          success: false,
          message: `Section(s) with ID(s) ${missingIds.join(', ')} not found`,
        };
      }

      // Validate that all sort_order values are positive integers
      for (const section of sections) {
        if (!Number.isInteger(section.sort_order) || section.sort_order <= 0) {
          return {
            success: false,
            message: `Sort order must be a positive integer. Invalid value for section ID ${section.id}`,
          };
        }
      }

      // Perform bulk update using query builder for better performance
      await this.sectionRepository.manager.transaction(
        async (transactionalEntityManager) => {
          for (const section of sections) {
            await transactionalEntityManager
              .createQueryBuilder()
              .update(Section)
              .set({ sort_order: section.sort_order })
              .where('id = :id', { id: section.id })
              .execute();
          }
        },
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update sort order: ${error.message}`,
      };
    }
  }
}
