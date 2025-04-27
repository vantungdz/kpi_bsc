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

  async findAll(
    filterOptions: EmployeeFilterOptions = {},
  ): Promise<Employee[]> {
    console.log(
      'EmployeesService findAll: received filterOptions:',
      filterOptions,
    );

    const findOptions: FindManyOptions<Employee> = {
      where: {},
    };

    if (
      filterOptions.departmentId !== undefined &&
      filterOptions.departmentId !== null
    ) {
      (findOptions.where as any).departmentId = filterOptions.departmentId;
    }

    if (
      filterOptions.sectionId !== undefined &&
      filterOptions.sectionId !== null
    ) {
      (findOptions.where as any).sectionId = filterOptions.sectionId;
    }

    return this.employeeRepository.find(findOptions);
  }

  async findOne(id: number): Promise<Employee> {
    const user = await this.employeeRepository.findOne({
      where: { id }, // <<< THÊM relations để tải thông tin Department và Section >>>
      relations: ['department', 'section'],
    }); // Lưu ý: Trong chiến lược JWT validate, nếu user không tìm thấy, validate nên trả về undefined.
    // Ném UnauthorizedException ở đây có thể không phải lúc nào cũng là hành vi mong muốn trong service.
    // Tuy nhiên, giữ lại theo code gốc cho hiện tại.

    if (!user) {
      throw new UnauthorizedException('User not found'); // Đổi message cho rõ ràng
    }

    return user; // Trả về object Employee với relations Department và Section đã tải
  }

  async findOneBy(
    usernameOrEmail: string,
    password: string,
  ): Promise<Employee | undefined> {
    const foundUser = await this.employeeRepository.findOne({
      where: [{ email: usernameOrEmail }, { username: usernameOrEmail }], // <<< THÊM relations để tải thông tin Department và Section >>>
      // Cần thiết nếu frontend muốn hiển thị thông tin Department/Section ngay sau login
      relations: ['department', 'section'],
    });

    if (!foundUser) {
      return undefined; // Trả về undefined nếu không tìm thấy user
    }

    let isPasswordValid: boolean;
    try {
      isPasswordValid = await bcrypt.compare(password, foundUser.password);
    } catch (error) {
      console.error('Error comparing passwords:', error);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!isPasswordValid) {
      // Ném UnauthorizedException nếu mật khẩu sai
      throw new UnauthorizedException('Invalid credentials');
    }

    return foundUser; // Trả về object Employee với relations Department và Section đã tải
  }

  async remove(id: number): Promise<void> {
    await this.employeeRepository.delete(id);
  }
}
