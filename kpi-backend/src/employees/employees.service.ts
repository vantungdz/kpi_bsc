// src/employees/employee.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Employee } from 'src/entities/employee.entity';
import { Repository, FindManyOptions } from 'typeorm';

import * as bcrypt from 'bcrypt';

interface EmployeeFilterOptions {
  departmentId?: number;
  sectionId?: number;
  teamId?: number;
}

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
  ) {}

  async create(createEmployeeDto: Employee): Promise<Employee> {
    const employee = this.employeeRepository.create(createEmployeeDto);
    return this.employeeRepository.save(employee);
  }

  async findAll(filterOptions: EmployeeFilterOptions = {},): Promise<Employee[]> {
    console.log(
      'EmployeesService findAll: received filterOptions:',
      filterOptions,
    ); // <== THÊM LOG NÀY

    const findOptions: FindManyOptions<Employee> = {
      where: {}, // Khởi tạo where clause
    };

    // Áp dụng filter departmentId
    if (
      filterOptions.departmentId !== undefined &&
      filterOptions.departmentId !== null
    ) {
      // Lọc theo cột departmentId
      (findOptions.where as any).departmentId = filterOptions.departmentId;
    }

    // Áp dụng filter sectionId
    if (
      filterOptions.sectionId !== undefined &&
      filterOptions.sectionId !== null
    ) {
      // Lọc theo cột sectionId
      (findOptions.where as any).sectionId = filterOptions.sectionId;
    }

    return this.employeeRepository.find(findOptions); // Thực hiện query với where clause
  }

  async findOne(id: number): Promise<Employee> {
    const user = await this.employeeRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async findOneBy(
    usernameOrEmail: string,
    password: string,
  ): Promise<Employee | undefined> {
    const foundUser = await this.employeeRepository.findOne({
      where: [{ email: usernameOrEmail }, { username: usernameOrEmail }],
    });

    if (!foundUser) {
      return undefined;
    }

    // Compare the password
    let isPasswordValid: boolean;
    try {
      isPasswordValid = await bcrypt.compare(password, foundUser.password);
    } catch (error) {
      console.error('Error comparing passwords:', error);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return foundUser;
  }

  async remove(id: number): Promise<void> {
    await this.employeeRepository.delete(id);
  }
}
