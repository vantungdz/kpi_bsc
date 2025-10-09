import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Department } from 'src/departments/entities/department.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { Repository } from 'typeorm';
import { EmployeesService } from '../employees/employees.service';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    private readonly employeesService: EmployeesService,
  ) {}

  async create(
    createDepartmentDto: any,
  ): Promise<Department | { warning: string; employee: any }> {
    const created = this.departmentRepository.create(createDepartmentDto);
    const department = Array.isArray(created) ? created[0] : created;
    if (createDepartmentDto.managerId) {
      department.manager = { id: createDepartmentDto.managerId } as Employee;
    }

    if (createDepartmentDto.managerId) {
      const manager = await this.employeesService.findOne(
        createDepartmentDto.managerId,
      );
      const hasOtherDepartment =
        manager.departmentId && manager.departmentId !== department.id;
      const hasSection = manager.sectionId != null;
      let sectionNotInDepartment = false;
      if (
        hasSection &&
        manager.section?.department?.id &&
        manager.section.department.id !== department.id
      ) {
        sectionNotInDepartment = true;
      }
      if (
        (hasOtherDepartment || sectionNotInDepartment) &&
        !createDepartmentDto.forceUpdateManager
      ) {
        return {
          warning: 'MANAGER_HAS_OTHER_DEPARTMENT_OR_SECTION',
          employee: manager,
        };
      }

      await this.employeesService.updateEmployee(manager.id, {
        departmentId: department.id,
        sectionId: undefined,
        roles: ['manager' as any],
        _mergeRoles: true,
      });
    }
    const savedDepartment = await this.departmentRepository.save(department);
    return savedDepartment;
  }

  async findAll(): Promise<Department[]> {
    const departments = await this.departmentRepository.find({
      relations: ['manager'],
    });

    for (const department of departments) {
      if (!department.managerId) {
        const manager = await this.departmentRepository.manager
          .getRepository(Employee)
          .createQueryBuilder('employee')
          .leftJoinAndSelect('employee.roles', 'role')
          .where('employee.departmentId = :departmentId', {
            departmentId: department.id,
          })
          .andWhere('role.name = :roleName', { roleName: 'department' })
          .getOne();
        if (manager) {
          department.manager = manager;
          department.managerId = manager.id;
        }
      }
    }
    return departments;
  }

  async findOne(id: number): Promise<Department> {
    const user = await this.departmentRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async update(
    id: number,
    updateDepartmentDto: any,
  ): Promise<Department | { warning: string; employee: any }> {
    const department = await this.departmentRepository.findOne({
      where: { id },
    });
    if (!department) {
      throw new UnauthorizedException('Department not found');
    }
    if (updateDepartmentDto.name !== undefined) {
      department.name = updateDepartmentDto.name;
    }
    if (updateDepartmentDto.managerId !== undefined) {
      department.manager = { id: updateDepartmentDto.managerId } as Employee;

      const manager = await this.employeesService.findOne(
        updateDepartmentDto.managerId,
      );
      const hasOtherDepartment =
        manager.departmentId && manager.departmentId !== department.id;
      const hasSection = manager.sectionId != null;
      let sectionNotInDepartment = false;
      if (
        hasSection &&
        manager.section?.department?.id &&
        manager.section.department.id !== department.id
      ) {
        sectionNotInDepartment = true;
      }
      if (
        (hasOtherDepartment || sectionNotInDepartment) &&
        !updateDepartmentDto.forceUpdateManager
      ) {
        return {
          warning: 'MANAGER_HAS_OTHER_DEPARTMENT_OR_SECTION',
          employee: manager,
        };
      }

      if (hasOtherDepartment) {
        const oldDepartment = await this.departmentRepository.findOne({
          where: { id: manager.departmentId },
        });
        if (oldDepartment && oldDepartment.managerId === manager.id) {
          oldDepartment.managerId = null;
          await this.departmentRepository.save(oldDepartment);
        }
      }

      const sections = await this.departmentRepository.manager
        .getRepository('Section')
        .find({ where: { department: { id: department.id } } });
      for (const section of sections) {
        section.managerId = updateDepartmentDto.managerId;
        await this.departmentRepository.manager
          .getRepository('Section')
          .save(section);
      }
      await this.employeesService.updateEmployee(manager.id, {
        departmentId: department.id,
        sectionId: undefined,
        roles: ['manager' as any],
        _mergeRoles: true,
      });
    }
    const saved = await this.departmentRepository.save(department);
    return saved;
  }

  async remove(id: number): Promise<void> {
    const sectionCount = await this.departmentRepository.manager
      .getRepository('Section')
      .count({ where: { department: { id } } });
    if (sectionCount > 0) {
      throw new BadRequestException(
        'Không thể xóa phòng ban: vẫn còn section thuộc phòng ban này.',
      );
    }

    const employeeCount = await this.departmentRepository.manager
      .getRepository('Employee')
      .count({ where: { department: { id } } });
    if (employeeCount > 0) {
      throw new BadRequestException(
        'Không thể xóa phòng ban: vẫn còn nhân viên thuộc phòng ban này.',
      );
    }
    await this.departmentRepository.delete(id);
  }
}
