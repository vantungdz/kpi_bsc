// src/departments/department.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Department } from 'src/entities/department.entity';
import { Employee } from 'src/entities/employee.entity';
import { Repository } from 'typeorm';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {}

  async create(createDepartmentDto: any): Promise<Department> {
    const created = this.departmentRepository.create(createDepartmentDto);
    const department = Array.isArray(created) ? created[0] : created;
    if (createDepartmentDto.managerId) {
      department.manager = { id: createDepartmentDto.managerId } as Employee; // Sửa ở đây
    }
    return this.departmentRepository.save(department);
  }

  async findAll(): Promise<Department[]> {
    const departments = await this.departmentRepository.find({
      relations: ['manager'],
    });
    // Auto-populate manager if missing, by finding employee with role 'department' and departmentId = department.id
    for (const department of departments) {
      if (!department.managerId) {
        // Sửa: dùng QueryBuilder join với roles
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
}
