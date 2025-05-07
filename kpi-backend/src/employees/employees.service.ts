import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Employee } from 'src/entities/employee.entity';
import { Repository, FindManyOptions, DeepPartial, DataSource } from 'typeorm';
import * as XLSX from 'xlsx';
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
    private readonly dataSource: DataSource,
  ) {}

  async create(createEmployeeDto: Partial<Employee>): Promise<Employee> {
    const { username, email, password, ...restOfDto } = createEmployeeDto;

    if (!username) {
      throw new BadRequestException('Username is required.');
    }
    if (!email) {
      throw new BadRequestException('Email is required.');
    }
    if (!password) {
      throw new BadRequestException('Password is required for new employee.');
    }

    let existingEmployee = await this.employeeRepository.findOneBy({
      username,
    });
    if (existingEmployee) {
      throw new ConflictException(`Username '${username}' already exists.`);
    }
    existingEmployee = await this.employeeRepository.findOneBy({ email });
    if (existingEmployee) {
      throw new ConflictException(`Email '${email}' already exists.`);
    }

    const employee = this.employeeRepository.create({
      username,
      email,
      password,
      ...restOfDto,
      role: createEmployeeDto.role || 'employee',
    } as DeepPartial<Employee>);
    return this.employeeRepository.save(employee);
  }

  async findAll(
    filterOptions: EmployeeFilterOptions = {},
  ): Promise<Employee[]> {
    const findOptions: FindManyOptions<Employee> = {
      where: {},
      relations: ['department', 'section', 'team'],
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
      relations: ['department', 'section', 'team'],
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
      relations: ['department', 'section', 'team'],
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
      ],
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
        section: { id: sectionId },
        role: 'leader',
      },
    });
  }

  async findAllAdmins(): Promise<Employee[]> {
    return this.employeeRepository.find({ where: { role: 'admin' } });
  }

  async findManagerOfDepartment(
    departmentId: number,
  ): Promise<Employee | null> {
    if (!departmentId) {
      return null;
    }

    return this.employeeRepository.findOne({
      where: {
        department: { id: departmentId },
        role: 'manager',
      },
    });
  }

  async saveEmployeeData(data: any[]): Promise<{
    successCount: number;
    errors: { rowData: any; error: string }[];
    message?: string;
  }> {
    const results = {
      successCount: 0,
      errors: [] as { rowData: any; error: string }[],
    };

    await this.dataSource.transaction(async (transactionalEntityManager) => {
      const employeeRepo = transactionalEntityManager.getRepository(Employee);

      for (const row of data) {
        const username = row['Username']?.trim();
        const email = row['Email']?.trim();
        const role = row['Role']?.toLowerCase() || 'employee';
        const firstName = row['First Name']?.trim();
        const lastName = row['Last Name']?.trim();
        const departmentId = row['Department ID'];
        const sectionId = row['Section ID'];
        const teamId = row['Team ID'];

        if (!username || !email) {
          console.warn('Skipping row due to missing fields:', row);
          results.errors.push({
            rowData: row,
            error: 'Missing required fields: Username or Email',
          });
          continue;
        }

        try {
          const existingEmployee = await employeeRepo.findOneBy({ username });
          if (existingEmployee) {
            console.warn(`Username '${username}' already exists.`);
            results.errors.push({
              rowData: row,
              error: `Username '${username}' already exists.`,
            });
            continue;
          }

          const existingEmail = await employeeRepo.findOneBy({ email });
          if (existingEmail) {
            console.warn(`Email '${email}' already exists.`);
            results.errors.push({
              rowData: row,
              error: `Email '${email}' already exists.`,
            });
            continue;
          }

          const hashedPassword = await bcrypt.hash('default_password', 10);

          const employeeData: DeepPartial<Employee> = {
            username,
            email,
            password: hashedPassword,
            role,
            first_name: firstName,
            last_name: lastName,
            departmentId,
            sectionId,
            teamId,
          };

          const newEmployee = employeeRepo.create(employeeData);
          await employeeRepo.save(newEmployee);
          console.log('Employee saved:', newEmployee);
          results.successCount++;
        } catch (error) {
          console.error('Error saving employee:', error.message || error);
          results.errors.push({
            rowData: row,
            error: `Failed to save employee: ${error.message || 'Unknown error'}`,
          });
        }
      }
    });

    if (results.successCount === 0) {
      console.warn('No employees were saved.');
    }

    return {
      message:
        results.successCount > 0
          ? 'Some employees were saved with errors.'
          : 'No employees were saved.',
      successCount: results.successCount,
      errors: results.errors,
    };
  }
}
