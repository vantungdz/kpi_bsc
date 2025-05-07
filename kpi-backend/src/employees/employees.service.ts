import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Employee } from 'src/entities/employee.entity';
import { Repository, FindManyOptions, DeepPartial } from 'typeorm';

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
    const employee = this.employeeRepository.create(
      createEmployeeDto as DeepPartial<Employee>,
    );
    return this.employeeRepository.save(employee);
  }

  async findAll(
    filterOptions: EmployeeFilterOptions = {},
  ): Promise<Employee[]> {
    const findOptions: FindManyOptions<Employee> = {
      where: {},
      relations: ['department', 'section', 'team'], // Add relations if needed
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

    if (filterOptions.teamId !== undefined && filterOptions.teamId !== null) {
      (findOptions.where as any).teamId = filterOptions.teamId;
    }

    return this.employeeRepository.find(findOptions);
  }

  async findOne(id: number): Promise<Employee> {
    const user = await this.employeeRepository.findOne({
      where: { id },
      relations: ['department', 'section', 'team'], // Load relations
    });

    if (!user) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }
    return user;
  }

  async findOneByUsernameOrEmailForAuth(
    usernameOrEmail: string,
  ): Promise<Employee | undefined> {
    const foundUser = await this.employeeRepository.findOne({
      where: [{ email: usernameOrEmail }, { username: usernameOrEmail }],
      relations: ['department', 'section', 'team'], // Load relations
      select: [
        'id',
        'username',
        'email',
        'password',
        'role',
        'departmentId',
        'sectionId',
        'teamId',
        'first_name',
        'last_name',
      ], // Select necessary fields including password
    });
    return foundUser || undefined;
  }

  async remove(id: number): Promise<void> {
    const result = await this.employeeRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }
  }

  async findLeaderOfSection(sectionId: number): Promise<Employee | null> {
    if (!sectionId) {
      return null;
    }
    return this.employeeRepository.findOne({
      where: {
        section: { id: sectionId }, // Assuming Employee entity has a 'section' relation
        role: 'leader', // Adjust 'leader' to match your role system
      },
    });
  }

  async findAllAdmins(): Promise<Employee[]> {
    // Giả sử vai trò admin được lưu là 'admin'
    return this.employeeRepository.find({ where: { role: 'admin' } });
  }

  async findManagerOfDepartment(
    departmentId: number,
  ): Promise<Employee | null> {
    if (!departmentId) {
      return null;
    }
    // Adjust 'manager' and the way department is linked if your structure is different
    return this.employeeRepository.findOne({
      where: {
        department: { id: departmentId }, // Assuming Employee has a 'department' relation
        role: 'manager', // Or your specific role for department heads
      },
    });
  }
}
