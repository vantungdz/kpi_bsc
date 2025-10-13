import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common'; // Import Logger
import { Employee } from 'src/employees/entities/employee.entity';
import { userHasPermission } from '../common/utils/permission.utils';
import { Role } from 'src/roles/entities/role.entity';
import { Department } from 'src/departments/entities/department.entity';
import { Section } from 'src/sections/entities/section.entity';
import {
  Repository,
  FindManyOptions,
  DeepPartial,
  DataSource,
  IsNull,
  Equal,
  In,
} from 'typeorm';
import * as XLSX from 'xlsx';
import * as bcrypt from 'bcrypt';
import {
  EmployeePerformanceHistoryDto,
  EmployeePerformanceYearDto,
} from './dto/employee-performance-history.dto';
import { KPIAssignment } from 'src/kpi-assessments/entities/kpi-assignment.entity';
import {
  KpiValue,
  KpiValueStatus,
} from 'src/kpi-values/entities/kpi-value.entity';
import { KpiReview } from 'src/evaluation/entities/kpi-review.entity';
import { Kpi } from 'src/kpis/entities/kpi.entity';
import { EmployeeSkill } from 'src/employee-skill/entities/employee-skill.entity';
import { Competency } from 'src/competency/entities/competency.entity';

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
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly dataSource: DataSource,
    @InjectRepository(EmployeeSkill)
    private readonly employeeSkillRepo: Repository<EmployeeSkill>,
    @InjectRepository(Competency)
    private readonly competencyRepo: Repository<Competency>,
  ) {}

  private userHasPermission(
    user: Employee,
    action: string,
    resource: string,
    scope?: string,
  ): boolean {
    return userHasPermission(user, action, resource, scope);
  }

  async create(
    createEmployeeDto: Partial<Employee & { roles?: string[] | number[] }>,
    actor?: { id?: number; username?: string }, // Add actor information if available
  ): Promise<Employee> {
    const {
      username,
      email,
      password,
      roles: roleNamesOrIds,
      ...restOfDto
    } = createEmployeeDto;

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

    // Get list of role entities
    let roleEntities: Role[] = [];
    if (roleNamesOrIds && Array.isArray(roleNamesOrIds)) {
      roleEntities = await this.roleRepository.find({
        where: roleNamesOrIds.every((r) => typeof r === 'number')
          ? roleNamesOrIds.map((id) => ({ id }))
          : roleNamesOrIds.map((name) => ({ name: String(name) })),
      });
      if (roleEntities.length !== roleNamesOrIds.length) {
        throw new BadRequestException('One or more roles do not exist.');
      }
    }

    const employee = this.employeeRepository.create({
      username,
      email,
      password,
      ...restOfDto,
      roles: roleEntities,
    } as DeepPartial<Employee>);
    const saved = await this.employeeRepository.save(employee);
    return saved;
  }

  // Helper: get all role names of user
  private getUserRoleNames(user: Employee): string[] {
    if (!user.roles) return [];
    return user.roles
      .map((r) => (typeof r === 'string' ? r : r?.name))
      .filter(Boolean);
  }

  async findAll(
    filterOptions: EmployeeFilterOptions = {},
    loggedInUser?: Employee,
  ): Promise<Employee[]> {
    const findOptions: FindManyOptions<Employee> = {
      where: { isDeleted: false },
      relations: ['department', 'section', 'team', 'roles'],
    };

    // Check employee view permissions by scope from high to low
    if (loggedInUser) {
      // Load permissions for loggedInUser if not available
      if (
        !loggedInUser.roles ||
        loggedInUser.roles.some((role) => !role.permissions)
      ) {
        const userWithPermissions = await this.employeeRepository.findOne({
          where: { id: loggedInUser.id },
          relations: ['roles', 'roles.permissions'],
        });
        if (userWithPermissions) {
          loggedInUser.roles = userWithPermissions.roles;
        }
      }

      if (this.userHasPermission(loggedInUser, 'view', 'employee', 'company')) {
        // Admin/HR Manager: View all employees
        // No restrictions needed
      } else if (
        this.userHasPermission(loggedInUser, 'view', 'employee', 'department')
      ) {
        // Department Manager: Only view employees in department
        if (!loggedInUser.departmentId) {
          this.logger.warn(
            `Department user ${loggedInUser.id} has no departmentId, returning no employees.`,
          );
          return [];
        }
        (findOptions.where as any).departmentId = loggedInUser.departmentId;
      } else if (
        this.userHasPermission(loggedInUser, 'view', 'employee', 'section')
      ) {
        // Section Manager: Only view employees in section
        if (!loggedInUser.sectionId) {
          this.logger.warn(
            `Section user ${loggedInUser.id} has no sectionId, returning no employees.`,
          );
          return [];
        }
        (findOptions.where as any).sectionId = loggedInUser.sectionId;
        if (
          filterOptions.departmentId &&
          loggedInUser.departmentId &&
          filterOptions.departmentId !== loggedInUser.departmentId
        ) {
          this.logger.warn(
            `Section user ${loggedInUser.id} (dept ${loggedInUser.departmentId}) tried to filter by department ${filterOptions.departmentId}. Query will be restricted to user's section ${loggedInUser.sectionId}.`,
          );
        }
      } else if (
        this.userHasPermission(loggedInUser, 'view', 'employee', 'personal')
      ) {
        // Employee: Only view own information
        (findOptions.where as any).id = loggedInUser.id;
      } else {
        // No permission to view employees
        this.logger.warn(
          `User ${loggedInUser.id} has no permission to view employees.`,
        );
        return [];
      }
    } else {
      // No logged in user, apply filter options
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

    // Apply filter options regardless of user permissions (for API filtering)
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

    // Debug logging
    console.log('EmployeesService.findAll - filterOptions:', filterOptions);
    console.log(
      'EmployeesService.findAll - findOptions.where:',
      findOptions.where,
    );

    const result = await this.employeeRepository.find(findOptions);
    console.log('EmployeesService.findAll - result count:', result.length);
    if (result.length > 0) {
      console.log('EmployeesService.findAll - first user:', {
        id: result[0].id,
        username: result[0].username,
        sectionId: result[0].sectionId,
        departmentId: result[0].departmentId,
      });
    }

    return result;
  }

  async findOne(id: number): Promise<Employee> {
    let user = await this.employeeRepository.findOne({
      where: { id, isDeleted: false },
      relations: ['department', 'section', 'team', 'roles'],
    });
    if (!user) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }
    return user;
  }

  async findOneWithPermissions(id: number): Promise<any> {
    const user = await this.employeeRepository.findOne({
      where: { id },
      relations: ['roles', 'department', 'section', 'team'],
    });
    if (!user) return null;
    let permissions: Array<{ action: string; resource: string }> = [];
    if (user.roles && user.roles.length > 0) {
      const roleIds = user.roles.map((r) => (typeof r === 'object' ? r.id : r));
      const roles = await this.roleRepository.find({
        where: roleIds.map((id) => ({ id })),
        relations: ['permissions'],
      });
      permissions = roles.flatMap((role) =>
        (role.permissions || []).map((p) => ({
          action: p.action,
          resource: p.resource,
          scope: p.scope, // Add this line
        })),
      );
    }
    // Return user with permissions (not directly assigned to entity)
    return { ...user, permissions };
  }

  async findOneByUsernameOrEmailForAuth(
    usernameOrEmail: string,
  ): Promise<Employee | undefined> {
    const foundUser = await this.employeeRepository.findOne({
      where: [{ email: usernameOrEmail }, { username: usernameOrEmail }],
      relations: ['department', 'section', 'team', 'roles'],
      select: [
        'id',
        'username',
        'email',
        'password',
        'departmentId',
        'sectionId',
        'teamId',
        'first_name',
        'last_name',
      ],
    });
    return foundUser || undefined;
  }

  async findLeaderOfSection(sectionId: number): Promise<Employee | null> {
    if (!sectionId) {
      return null;
    }
    // Find employee with 'section' role in this section
    return this.employeeRepository
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.roles', 'role')
      .where('employee.sectionId = :sectionId', { sectionId })
      .andWhere('role.name = :roleName', { roleName: 'section' })
      .getOne();
  }

  async findAllAdmins(): Promise<Employee[]> {
    // Find all employees with 'admin' role
    return this.employeeRepository
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.roles', 'role')
      .where('role.name = :roleName', { roleName: 'admin' })
      .getMany();
  }

  async findManagerOfDepartment(
    departmentId: number,
  ): Promise<Employee | null> {
    if (!departmentId) {
      return null;
    }
    // Find employee with 'manager' role in this department
    return this.employeeRepository
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.roles', 'role')
      .where('employee.departmentId = :departmentId', { departmentId })
      .andWhere('role.name = :roleName', { roleName: 'manager' })
      .getOne();
  }

  async remove(
    id: number,
    actor?: { id?: number; username?: string },
  ): Promise<void> {
    const employee = await this.employeeRepository.findOneBy({ id });
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }
    employee.isDeleted = true;
    await this.employeeRepository.save(employee);
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
      const roleRepo = transactionalEntityManager.getRepository(Role);

      for (const [index, row] of data.entries()) {
        const username = row['Username']?.toString().trim();
        const email = row['Email']?.toString().trim();
        const password = row['Password']?.toString().trim();
        // Allow multiple roles, separated by comma
        let roleNames =
          row['Role']
            ?.toString()
            ?.split(',')
            .map((r: string) => r.trim())
            .filter(Boolean) || [];

        // If no role specified, leave empty (no automatic role assignment)
        const firstName = row['First Name']?.toString().trim();
        const lastName = row['Last Name']?.toString().trim();

        // Handle Department - support both ID and Name
        let departmentId = row['Department ID'];
        let departmentError = '';
        const departmentName = row['Department Name'] || row['Department'];
        if (!departmentId && departmentName) {
          const departmentRepo =
            transactionalEntityManager.getRepository(Department);
          const department = await departmentRepo.findOne({
            where: { name: departmentName.toString().trim() },
          });
          if (department) {
            departmentId = department.id;
          } else {
            departmentError = `Department '${departmentName.toString().trim()}' not found`;
          }
        } else if (departmentId) {
          // Validate Department ID exists
          const departmentRepo =
            transactionalEntityManager.getRepository(Department);
          const department = await departmentRepo.findOne({
            where: { id: departmentId },
          });
          if (!department) {
            departmentError = `Department ID '${departmentId}' not found`;
          }
        }

        // Handle Section - support both ID and Name
        let sectionId = row['Section ID'];
        let sectionError = '';
        const sectionName = row['Section Name'] || row['Section'];
        if (!sectionId && sectionName) {
          const sectionRepo = transactionalEntityManager.getRepository(Section);
          const section = await sectionRepo.findOne({
            where: { name: sectionName.toString().trim() },
          });
          if (section) {
            sectionId = section.id;
          } else {
            sectionError = `Section '${sectionName.toString().trim()}' not found`;
          }
        } else if (sectionId) {
          // Validate Section ID exists
          const sectionRepo = transactionalEntityManager.getRepository(Section);
          const section = await sectionRepo.findOne({
            where: { id: sectionId },
          });
          if (!section) {
            sectionError = `Section ID '${sectionId}' not found`;
          }
        }

        const teamId = row['Team ID'];

        if (!username || !email) {
          results.errors.push({
            rowNumber: index + 2,
            rowData: row,
            error: 'Missing required fields: Username or Email',
          });
          continue;
        }

        // Check for department/section errors
        if (departmentError || sectionError) {
          const errors = [departmentError, sectionError].filter(Boolean);
          results.errors.push({
            rowNumber: index + 2,
            rowData: row,
            error: errors.join('; '),
          });
          continue;
        }

        try {
          // Check for existing username (including deleted ones)
          const existingEmployee = await employeeRepo.findOneBy({ username });
          if (existingEmployee) {
            if (!existingEmployee.isDeleted) {
              results.errors.push({
                rowNumber: index + 2,
                rowData: row,
                error: `Username '${username}' already exists.`,
              });
              continue;
            } else {
              // Employee exists but is deleted - restore it instead of creating new
              existingEmployee.isDeleted = false;
              existingEmployee.email = email;
              existingEmployee.password = await bcrypt.hash(
                password ? password : 'default_password',
                10,
              );

              // Only update fields that have values (preserve existing data for empty fields)
              if (firstName) existingEmployee.first_name = firstName;
              if (lastName) existingEmployee.last_name = lastName;
              if (departmentId !== undefined && departmentId !== null) {
                existingEmployee.departmentId = departmentId;
              }
              if (sectionId !== undefined && sectionId !== null) {
                existingEmployee.sectionId = sectionId;
              }
              if (teamId !== undefined && teamId !== null) {
                existingEmployee.teamId = teamId;
              }

              // Update roles only if specified
              if (roleNames && roleNames.length > 0) {
                const roleEntities = await roleRepo.find({
                  where: roleNames.map((name) => ({ name })),
                });
                if (roleEntities.length !== roleNames.length) {
                  const foundRoleNames = roleEntities.map((r) => r.name);
                  const missingRoles = roleNames.filter(
                    (name) => !foundRoleNames.includes(name),
                  );
                  results.errors.push({
                    rowNumber: index + 2,
                    rowData: row,
                    error: `Roles not found: ${missingRoles.join(', ')}`,
                  });
                  continue;
                }
                existingEmployee.roles = roleEntities;
              } else {
                // If no roles specified in Excel, clear existing roles
                existingEmployee.roles = [];
              }

              await employeeRepo.save(existingEmployee);
              results.successCount++;
              continue;
            }
          }

          // Check for existing email (only if username is different)
          const existingEmail = await employeeRepo.findOneBy({ email });
          if (existingEmail && !existingEmail.isDeleted) {
            results.errors.push({
              rowNumber: index + 2,
              rowData: row,
              error: `Email '${email}' already exists.`,
            });
            continue;
          }

          const hashedPassword = await bcrypt.hash(
            password ? password : 'default_password',
            10,
          );

          // Get list of role entities
          let roleEntities: Role[] = [];
          if (roleNames && roleNames.length > 0) {
            roleEntities = await roleRepo.find({
              where: roleNames.map((name) => ({ name })),
            });
            if (roleEntities.length !== roleNames.length) {
              const foundRoleNames = roleEntities.map((r) => r.name);
              const missingRoles = roleNames.filter(
                (name) => !foundRoleNames.includes(name),
              );
              results.errors.push({
                rowNumber: index + 2,
                rowData: row,
                error: `Roles not found: ${missingRoles.join(', ')}`,
              });
              continue;
            }
          }
          // If no roles specified, roleEntities will be empty array (no roles assigned)

          const employeeData: DeepPartial<Employee> = {
            username,
            email,
            password: hashedPassword,
            roles: roleEntities,
            first_name: firstName,
            last_name: lastName,
            departmentId,
            sectionId,
            teamId,
          };

          const newEmployee = employeeRepo.create(employeeData);
          await employeeRepo.save(newEmployee);
          results.successCount++;
        } catch (error) {
          results.errors.push({
            rowNumber: index + 2,
            rowData: row,
            error: `Failed to save employee: ${error.message || 'Unknown error'}`,
          });
        }
      }
    });

    // Keep this console.warn if you want internal logging, or remove it
    // because the returned message is already detailed enough.
    if (
      results.successCount === 0 &&
      data.length > 0 &&
      results.errors.length > 0
    ) {
      console.warn('No employees were saved.');
    }

    let message = 'No employees were saved.';
    if (results.successCount > 0 && results.errors.length === 0) {
      message = `Successfully imported ${results.successCount} employees.`;
    } else if (results.successCount > 0 && results.errors.length > 0) {
      message = `Successfully imported ${results.successCount} employees with ${results.errors.length} errors.`;
    } else if (results.successCount === 0 && results.errors.length > 0) {
      message = `Import failed. Found ${results.errors.length} errors.`;
    } else if (
      data.length === 0 &&
      results.successCount === 0 &&
      results.errors.length === 0
    ) {
      message = 'The provided file is empty or contains no data rows.';
    }

    return {
      message,
      successCount: results.successCount,
      errors: results.errors,
    };
  }

  async updateRoles(
    id: number,
    roleNamesOrIds: (string | number)[],
  ): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({ where: { id } });
    if (!employee) throw new NotFoundException('Employee not found');
    let roleEntities: Role[] = [];
    if (roleNamesOrIds && Array.isArray(roleNamesOrIds)) {
      roleEntities = await this.roleRepository.find({
        where: roleNamesOrIds.every((r) => typeof r === 'number')
          ? roleNamesOrIds.map((id) => ({ id }))
          : roleNamesOrIds.map((name) => ({ name: String(name) })),
      });
      if (roleEntities.length !== roleNamesOrIds.length) {
        throw new BadRequestException('One or more roles do not exist.');
      }
    }
    employee.roles = roleEntities;
    await this.employeeRepository.save(employee);
    return employee;
  }

  async resetPassword(id: number, newPassword?: string): Promise<Employee> {
    const employee = await this.employeeRepository.findOneBy({ id });
    if (!employee) throw new NotFoundException('Employee not found');
    // If no newPassword provided, create random or use default
    const password = newPassword || Math.random().toString(36).slice(-8);
    const hashed = await bcrypt.hash(password, 10);
    employee.password = hashed;
    await this.employeeRepository.save(employee);
    return employee;
  }

  /**
   * Add a role to an employee if missing (by name or id), preserving existing roles.
   */
  async addRoleIfMissing(
    employee: Employee,
    roleNameOrId: string | number,
  ): Promise<Employee> {
    await this.employeeRepository.findOneOrFail({
      where: { id: employee.id },
      relations: ['roles'],
    });
    let role: Role | undefined;
    if (typeof roleNameOrId === 'number') {
      const found = await this.roleRepository.findOneBy({ id: roleNameOrId });
      role = found === null ? undefined : found;
    } else {
      const found = await this.roleRepository.findOneBy({
        name: String(roleNameOrId),
      });
      role = found === null ? undefined : found;
    }
    if (!role) throw new NotFoundException('Role not found');
    if (!employee.roles) employee.roles = [];
    const hasRole = employee.roles.some(
      (r) =>
        (typeof r === 'string' ? r : r?.name) === role.name ||
        r?.id === role.id,
    );
    if (!hasRole) {
      employee.roles.push(role);
      await this.employeeRepository.save(employee);
    }
    return employee;
  }

  /**
   * Update employee, optionally merging roles instead of replacing.
   * If updateDto._mergeRoles is true, will add any roles in updateDto.roles that are missing, but keep existing roles.
   */
  async updateEmployee(
    id: number,
    updateDto: Partial<
      Employee & { roles?: (string | number)[]; _mergeRoles?: boolean }
    >,
    actor?: { id?: number; username?: string },
  ): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({
      where: { id },
      relations: ['roles'],
    });
    if (!employee) throw new NotFoundException('Employee not found');
    // Do not allow duplicate username/email
    if (updateDto.username && updateDto.username !== employee.username) {
      const exist = await this.employeeRepository.findOneBy({
        username: updateDto.username,
      });
      if (exist) throw new ConflictException('Username already exists');
    }
    if (updateDto.email && updateDto.email !== employee.email) {
      const exist = await this.employeeRepository.findOneBy({
        email: updateDto.email,
      });
      if (exist) throw new ConflictException('Email already exists');
    }
    // If new password provided, hash it again
    if (updateDto.password) {
      updateDto.password = await bcrypt.hash(updateDto.password, 10);
    } else {
      delete updateDto.password;
    }
    // If roles field (array), get role entity
    if (updateDto.roles && Array.isArray(updateDto.roles)) {
      const roleEntities = await this.roleRepository.find({
        where: updateDto.roles.every((r) => typeof r === 'number')
          ? updateDto.roles.map((id) => ({ id }))
          : updateDto.roles.map((name) => ({ name: String(name) })),
      });
      if (roleEntities.length !== updateDto.roles.length) {
        throw new NotFoundException('One or more roles not found');
      }
      if (updateDto._mergeRoles) {
        // Merge: add any missing roles, keep existing
        const existingRoles = employee.roles || [];
        const existingRoleNames = existingRoles.map((r) => r.name);
        const mergedRoles = [...existingRoles];
        for (const role of roleEntities) {
          if (!existingRoleNames.includes(role.name)) {
            mergedRoles.push(role);
          }
        }
        employee.roles = mergedRoles;
      } else {
        // Replace
        employee.roles = roleEntities;
      }
      delete updateDto.roles;
      delete updateDto._mergeRoles;
    }
    // Remove object fields department, section, team if present in payload
    delete (updateDto as any).department;
    delete (updateDto as any).section;
    delete (updateDto as any).team;

    // Explicitly handle clearing departmentId/sectionId
    if ('departmentId' in updateDto && updateDto.departmentId === null) {
      employee.departmentId = null as any;
      employee.department = null as any;
    }
    if ('sectionId' in updateDto && updateDto.sectionId === null) {
      employee.sectionId = null as any;
      employee.section = null as any;
    }

    console.log(
      `[EmployeesService] updateEmployee: id=${id}, updateDto=${JSON.stringify(updateDto)}`,
    );
    Object.assign(employee, updateDto);
    await this.employeeRepository.save(employee);
    console.log(
      `[EmployeesService] updateEmployee result: id=${employee.id}, departmentId=${employee.departmentId}, sectionId=${employee.sectionId}, roles=${JSON.stringify(employee.roles)}`,
    );
    return employee;
  }

  async getEmployeePerformanceHistory(
    employeeId: number,
    fromYear?: number,
    toYear?: number,
  ): Promise<EmployeePerformanceHistoryDto> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId },
      relations: ['department'],
    });
    if (!employee) throw new NotFoundException('Employee not found');
    // Get all assignments of employee
    const assignmentRepo = this.dataSource.getRepository(KPIAssignment);
    const valueRepo = this.dataSource.getRepository(KpiValue);
    const reviewRepo = this.dataSource.getRepository(KpiReview);
    const kpiRepo = this.dataSource.getRepository(Kpi);

    // Get all assignments of employee
    const assignments = await assignmentRepo.find({
      where: { employee: { id: employeeId } },
      relations: ['kpi'],
    });
    if (!assignments.length) {
      return {
        employeeId,
        fullName:
          `${employee.first_name || ''} ${employee.last_name || ''}`.trim(),
        department: employee.department?.name,
        years: [],
      };
    }
    // Get all APPROVED values of these assignments
    const assignmentIds = assignments.map((a) => a.id);
    const values = await valueRepo.find({
      where: {
        ...(assignmentIds.length
          ? { kpi_assigment_id: In(assignmentIds) }
          : {}),
        status: KpiValueStatus.APPROVED,
      },
      order: { timestamp: 'ASC' },
    });
    // Group by year
    const yearMap: Record<number, { values: KpiValue[]; kpis: Set<number> }> =
      {};
    for (const v of values) {
      const year = v.timestamp.getFullYear();
      if (fromYear && year < fromYear) continue;
      if (toYear && year > toYear) continue;
      if (!yearMap[year]) yearMap[year] = { values: [], kpis: new Set() };
      yearMap[year].values.push(v);
      yearMap[year].kpis.add(v.kpi_assigment_id);
    }
    // Calculate each year
    const years: EmployeePerformanceYearDto[] = [];
    for (const year of Object.keys(yearMap).map(Number).sort()) {
      const yearData = yearMap[year];
      // Calculate average score by completion rate (%)
      const kpiScores = yearData.values.map((v) => {
        const assignment = assignments.find((a) => a.id === v.kpi_assigment_id);
        const target = assignment?.kpi?.target;
        if (target && Number(target) > 0) {
          return (Number(v.value) / Number(target)) * 100;
        }
        return 0;
      });
      const averageKpiScore = kpiScores.length
        ? parseFloat(
            (kpiScores.reduce((a, b) => a + b, 0) / kpiScores.length).toFixed(
              2,
            ),
          )
        : 0;
      // Count achieved KPIs (>= target) and not achieved
      let achievedCount = 0;
      let notAchievedCount = 0;
      for (const v of yearData.values) {
        // Get KPI target
        const assignment = assignments.find((a) => a.id === v.kpi_assigment_id);
        const target = assignment?.kpi?.target;
        if (target !== undefined && target !== null) {
          if (Number(v.value) >= Number(target)) achievedCount++;
          else notAchievedCount++;
        }
      }
      const total = achievedCount + notAchievedCount;
      const achievedRate =
        total > 0 ? parseFloat(((achievedCount / total) * 100).toFixed(2)) : 0;
      const notAchievedRate =
        total > 0
          ? parseFloat(((notAchievedCount / total) * 100).toFixed(2))
          : 0;
      // Get outstanding comments (manager review)
      const reviews = await reviewRepo.find({
        where: {
          employee: { id: employeeId },
          cycle: String(year),
        },
        order: { id: 'ASC' },
      });
      const highlightComments = reviews
        .map((r) => r.managerComment)
        .filter(Boolean);
      years.push({
        year,
        averageKpiScore,
        achievedCount,
        notAchievedCount,
        achievedRate,
        notAchievedRate,
        highlightComments,
      });
    }
    return {
      employeeId,
      fullName:
        `${employee.first_name || ''} ${employee.last_name || ''}`.trim(),
      department: employee.department?.name,
      years,
    };
  }

  async getEmployeeSkillsWithLevel(employeeId: number) {
    // Get all skills of employee with competency
    const skills = await this.employeeSkillRepo.find({
      where: { employee: { id: employeeId } },
      relations: ['competency'],
    });
    return skills.map((s) => ({
      skillId: s.competency?.id,
      skillName: s.competency?.name,
      group: s.competency?.group,
      level: s.level,
      note: s.note,
    }));
  }
}
