import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from '../entities/department.entity';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private departmentsRepository: Repository<Department>,
  ) {}

  async findAll(): Promise<Department[]> {
    return await this.departmentsRepository.find({
      relations: [
        'parent', // Phòng ban cha
        'children', // Các phòng ban con
        'sections', // Các bộ phận trong phòng ban
        'sections.kpis', // KPI của các bộ phận
        'kpis', // Các KPI trực tiếp thuộc phòng ban
        'kpis.assignedTo', // Người được giao KPI
        'kpis.evaluations', // Đánh giá của KPI
        'userUnits', // Người dùng thuộc phòng ban
        'userUnits.user',
      ],
    });
  }

  async findOne(id: number): Promise<Department> {
    const user = await this.departmentsRepository.findOne({
      where: { id },
      relations: [
        'parent',
        'children',
        'sections',
        'sections.kpis',
        'kpis',
        'kpis.assignedTo',
        'kpis.evaluations',
        'userUnits', // Người dùng thuộc phòng ban
        'userUnits.user',
      ],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async create(department: Partial<Department>): Promise<Department> {
    const newDepartment = this.departmentsRepository.create(department);
    return this.departmentsRepository.save(newDepartment);
  }
}
