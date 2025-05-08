import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common'; // Import Logger
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
  private readonly logger = new Logger(EmployeesService.name); // Instantiate Logger
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
    loggedInUser?: Employee,
  ): Promise<Employee[]> {
    const findOptions: FindManyOptions<Employee> = {
      where: {},
      relations: ['department', 'section', 'team'],
    };

    if (loggedInUser && loggedInUser.role === 'section') {
        if (!loggedInUser.sectionId) {
            this.logger.warn(`Section user ${loggedInUser.id} has no sectionId, returning no employees.`);
            return [];
        }
        // Force filter by user's sectionId
        (findOptions.where as any).sectionId = loggedInUser.sectionId;

        // If departmentId is passed and it's different from the user's department, log a warning.
        // The sectionId filter will take precedence for data retrieval.
        if (filterOptions.departmentId && loggedInUser.departmentId && filterOptions.departmentId !== loggedInUser.departmentId) {
            this.logger.warn(`Section user ${loggedInUser.id} (dept ${loggedInUser.departmentId}) tried to filter by department ${filterOptions.departmentId}. Query will be restricted to user's section ${loggedInUser.sectionId}.`);
        }
        // Remove other potentially conflicting filters if a section user is making the request
        // delete filterOptions.departmentId; // Or ensure it matches loggedInUser.departmentId if set
    } else {
        // For admin, manager, or other roles, apply filters as they come
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
    }
    // Apply teamId filter regardless of role, if provided
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
        role: 'section',
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
    errors: { rowNumber: number; rowData: any; error: string }[];
    message?: string;
  }> {
    const results = {
      successCount: 0,
      errors: [] as { rowNumber: number; rowData: any; error: string }[],
    };

    await this.dataSource.transaction(async (transactionalEntityManager) => {
      const employeeRepo = transactionalEntityManager.getRepository(Employee);

      for (const [index, row] of data.entries()) {
        const username = row['Username']?.trim();
        const email = row['Email']?.trim();
        const password = row['Password']?.trim();
        const role = row['Role']?.toLowerCase() || 'employee';
        const firstName = row['First Name']?.trim();
        const lastName = row['Last Name']?.trim();
        const departmentId = row['Department ID'];
        const sectionId = row['Section ID'];
        const teamId = row['Team ID'];

        if (!username || !email) {
          console.warn('Skipping row due to missing fields:', row);
          results.errors.push({
            rowNumber: index + 2, // Dòng 1 là header, index 0 là dòng dữ liệu đầu tiên (dòng 2 Excel)
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
              rowNumber: index + 2,
              rowData: row,
              error: `Username '${username}' already exists.`,
            });
            continue;
          }

          const existingEmail = await employeeRepo.findOneBy({ email });
          if (existingEmail) {
            console.warn(`Email '${email}' already exists.`);
            results.errors.push({
              rowNumber: index + 2,
              rowData: row,
              error: `Email '${email}' already exists.`,
            });
            continue;
          }

          const hashedPassword = await bcrypt.hash(password ? password : 'default_password', 10);

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
            rowNumber: index + 2,
            rowData: row,
            error: `Failed to save employee: ${error.message || 'Unknown error'}`,
          });
        }
      }
    });

    // Giữ lại console.warn này nếu bạn muốn log nội bộ, hoặc có thể bỏ đi
    // vì message trả về đã đủ chi tiết.
    if (results.successCount === 0 && data.length > 0 && results.errors.length > 0) {
      console.warn('No employees were saved.');
    }

    let message = 'No employees were saved.';
    if (results.successCount > 0 && results.errors.length === 0) {
      message = `Successfully imported ${results.successCount} employees.`;
    } else if (results.successCount > 0 && results.errors.length > 0) {
      message = `Successfully imported ${results.successCount} employees with ${results.errors.length} errors.`;
    } else if (results.successCount === 0 && results.errors.length > 0) {
      message = `Import failed. Found ${results.errors.length} errors.`;
    } else if (data.length === 0 && results.successCount === 0 && results.errors.length === 0) {
      message = 'The provided file is empty or contains no data rows.';
    }

    return {
      message,
      successCount: results.successCount,
      errors: results.errors,
    };
  }
}
