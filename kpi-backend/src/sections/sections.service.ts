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

  async create(createSectionDto: any): Promise<Section | { warning: string, employee: any }> {
    const created = this.sectionRepository.create(createSectionDto);
    const section = Array.isArray(created) ? created[0] : created;
    if (createSectionDto.departmentId) {
      section.department = { id: createSectionDto.departmentId } as Department;
    }
    if (createSectionDto.managerId) {
      section.managerId = createSectionDto.managerId;
      const manager = await this.employeesService.findOne(createSectionDto.managerId);
      const hasOtherSection = !!manager.sectionId;
      // Nếu forceUpdateManager thì luôn cho phép tạo section, bỏ qua warning
      if (hasOtherSection && !createSectionDto.forceUpdateManager) {
        return {
          warning: `Nhân viên này đã là quản lý section khác. Nếu tiếp tục, section cũ sẽ bị thay đổi.`,
          employee: manager
        };
      }
    }
    // Lưu section khi không có warning hoặc đã force
    const savedSection = await this.sectionRepository.save(section);
    // Nếu có manager, cập nhật lại thông tin manager
    if (createSectionDto.managerId) {
      const manager = await this.employeesService.findOne(createSectionDto.managerId);
      // Nếu manager đã có sectionId (section cũ), cập nhật section cũ về managerId = null
      if (manager.sectionId && manager.sectionId !== savedSection.id) {
        const oldSection = await this.sectionRepository.findOne({ where: { id: manager.sectionId } });
        if (oldSection && oldSection.managerId === manager.id) {
          oldSection.managerId = null;
          await this.sectionRepository.save(oldSection);
        }
      }
      await this.employeesService.updateEmployee(createSectionDto.managerId, {
        departmentId: savedSection.department?.id,
        sectionId: savedSection.id,
        roles: ['manager' as any],
        _mergeRoles: true
      });
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

  async update(id: number, updateSectionDto: any): Promise<Section | { warning: string, employee: any }> {
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
      // Kiểm tra trạng thái manager
      const manager = await this.employeesService.findOne(updateSectionDto.managerId);
      const hasOtherSection = manager.sectionId && manager.sectionId !== section.id;
      if (hasOtherSection && !updateSectionDto.forceUpdateManager) {
        return {
          warning: `Nhân viên này đã là quản lý section khác. Nếu tiếp tục, section cũ sẽ bị thay đổi.`,
          employee: manager
        };
      }
      // Nếu forceUpdateManager hoặc chưa có section, cập nhật lại
      console.log(`[SectionService] Gọi updateEmployee cho managerId=${manager.id} với departmentId=${section.department?.id}, sectionId=${section.id}, roles=['manager']`);
      const updatedManager = await this.employeesService.updateEmployee(manager.id, {
        departmentId: section.department?.id,
        sectionId: section.id,
        roles: ['manager' as any],
        _mergeRoles: true
      });
      console.log(`[SectionService] Kết quả updateEmployee: managerId=${updatedManager.id}, departmentId=${updatedManager.departmentId}, sectionId=${updatedManager.sectionId}, roles=${JSON.stringify(updatedManager.roles)}`);
    }
    const saved = await this.sectionRepository.save(section);
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
