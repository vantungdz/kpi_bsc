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
import { Role } from 'src/entities/role.entity';
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
import { EmployeePerformanceHistoryDto, EmployeePerformanceYearDto } from './dto/employee-performance-history.dto';
import { KPIAssignment } from '../entities/kpi-assignment.entity';
import { KpiValue, KpiValueStatus } from '../entities/kpi-value.entity';
import { KpiReview } from '../entities/kpi-review.entity';
import { Kpi } from '../entities/kpi.entity';
import { EmployeeSkill } from '../employee-skill/employee-skill.entity';
import { Competency } from '../entities/competency.entity';

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

  async create(
    createEmployeeDto: Partial<Employee & { roles?: string[] | number[] }>,
    actor?: { id?: number; username?: string } // Thêm thông tin người thao tác nếu có
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

    // Lấy danh sách role entity
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

    if (
      loggedInUser &&
      this.getUserRoleNames(loggedInUser).includes('section')
    ) {
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
    } else {
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
    if (filterOptions.teamId !== undefined && filterOptions.teamId !== null) {
      (findOptions.where as any).teamId = filterOptions.teamId;
    }
    return this.employeeRepository.find(findOptions);
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
          scope: p.scope, // Thêm dòng này
        })),
      );
    }
    // Trả về user kèm permissions (không gán trực tiếp vào entity)
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
    // Tìm nhân viên có role là 'section' trong section này
    return this.employeeRepository
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.roles', 'role')
      .where('employee.sectionId = :sectionId', { sectionId })
      .andWhere('role.name = :roleName', { roleName: 'section' })
      .getOne();
  }

  async findAllAdmins(): Promise<Employee[]> {
    // Tìm tất cả nhân viên có role là 'admin'
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
    // Tìm nhân viên có role là 'manager' trong department này
    return this.employeeRepository
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.roles', 'role')
      .where('employee.departmentId = :departmentId', { departmentId })
      .andWhere('role.name = :roleName', { roleName: 'manager' })
      .getOne();
  }

  async remove(id: number, actor?: { id?: number; username?: string }): Promise<void> {
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
        const username = row['Username']?.trim();
        const email = row['Email']?.trim();
        const password = row['Password']?.trim();
        // Cho phép nhiều role, phân tách bởi dấu phẩy
        const roleNames = (
          row['Role']
            ?.split(',')
            .map((r: string) => r.trim().toLowerCase()) || ['employee']
        ).filter(Boolean);
        const firstName = row['First Name']?.trim();
        const lastName = row['Last Name']?.trim();
        const departmentId = row['Department ID'];
        const sectionId = row['Section ID'];
        const teamId = row['Team ID'];

        if (!username || !email) {
          results.errors.push({
            rowNumber: index + 2,
            rowData: row,
            error: 'Missing required fields: Username or Email',
          });
          continue;
        }

        try {
          const existingEmployee = await employeeRepo.findOneBy({ username });
          if (existingEmployee) {
            results.errors.push({
              rowNumber: index + 2,
              rowData: row,
              error: `Username '${username}' already exists.`,
            });
            continue;
          }

          const existingEmail = await employeeRepo.findOneBy({ email });
          if (existingEmail) {
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

          // Lấy danh sách role entity
          let roleEntities: Role[] = [];
          if (roleNames && roleNames.length > 0) {
            roleEntities = await roleRepo.find({
              where: roleNames.map((name) => ({ name })),
            });
            if (roleEntities.length !== roleNames.length) {
              throw new BadRequestException(
                `One or more roles do not exist: ${roleNames.join(', ')}`,
              );
            }
          }

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

    // Giữ lại console.warn này nếu bạn muốn log nội bộ, hoặc có thể bỏ đi
    // vì message trả về đã đủ chi tiết.
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
    // Nếu không truyền newPassword thì tạo random hoặc dùng mặc định
    const password = newPassword || Math.random().toString(36).slice(-8);
    const hashed = await bcrypt.hash(password, 10);
    employee.password = hashed;
    await this.employeeRepository.save(employee);
    return employee;
  }

  /**
   * Add a role to an employee if missing (by name or id), preserving existing roles.
   */
  async addRoleIfMissing(employee: Employee, roleNameOrId: string | number): Promise<Employee> {
    await this.employeeRepository.findOneOrFail({ where: { id: employee.id }, relations: ['roles'] });
    let role: Role | undefined;
    if (typeof roleNameOrId === 'number') {
      const found = await this.roleRepository.findOneBy({ id: roleNameOrId });
      role = found === null ? undefined : found;
    } else {
      const found = await this.roleRepository.findOneBy({ name: String(roleNameOrId) });
      role = found === null ? undefined : found;
    }
    if (!role) throw new NotFoundException('Role not found');
    if (!employee.roles) employee.roles = [];
    const hasRole = employee.roles.some(r => (typeof r === 'string' ? r : r?.name) === role.name || r?.id === role.id);
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
    updateDto: Partial<Employee & { roles?: (string | number)[], _mergeRoles?: boolean }>,
    actor?: { id?: number; username?: string }
  ): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({ where: { id }, relations: ['roles'] });
    if (!employee) throw new NotFoundException('Employee not found');
    // Không cho update username/email trùng
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
    // Nếu có password mới thì hash lại
    if (updateDto.password) {
      updateDto.password = await bcrypt.hash(updateDto.password, 10);
    } else {
      delete updateDto.password;
    }
    // Nếu có trường roles (mảng), lấy entity role
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
        const existingRoleNames = existingRoles.map(r => r.name);
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
    // Xóa các trường object department, section, team nếu có trong payload
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

    console.log(`[EmployeesService] updateEmployee: id=${id}, updateDto=${JSON.stringify(updateDto)}`);
    Object.assign(employee, updateDto);
    await this.employeeRepository.save(employee);
    console.log(`[EmployeesService] updateEmployee result: id=${employee.id}, departmentId=${employee.departmentId}, sectionId=${employee.sectionId}, roles=${JSON.stringify(employee.roles)}`);
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
    // Lấy tất cả assignment của employee
    const assignmentRepo = this.dataSource.getRepository(KPIAssignment);
    const valueRepo = this.dataSource.getRepository(KpiValue);
    const reviewRepo = this.dataSource.getRepository(KpiReview);
    const kpiRepo = this.dataSource.getRepository(Kpi);

    // Lấy tất cả assignment của employee
    const assignments = await assignmentRepo.find({
      where: { employee: { id: employeeId } },
      relations: ['kpi'],
    });
    if (!assignments.length) {
      return {
        employeeId,
        fullName: `${employee.first_name || ''} ${employee.last_name || ''}`.trim(),
        department: employee.department?.name,
        years: [],
      };
    }
    // Lấy tất cả value đã APPROVED của các assignment này
    const assignmentIds = assignments.map(a => a.id);
    const values = await valueRepo.find({
      where: {
        ...(assignmentIds.length ? { kpi_assigment_id: In(assignmentIds) } : {}),
        status: KpiValueStatus.APPROVED,
      },
      order: { timestamp: 'ASC' },
    });
    // Gom theo năm
    const yearMap: Record<number, { values: KpiValue[]; kpis: Set<number> }> = {};
    for (const v of values) {
      const year = v.timestamp.getFullYear();
      if (fromYear && year < fromYear) continue;
      if (toYear && year > toYear) continue;
      if (!yearMap[year]) yearMap[year] = { values: [], kpis: new Set() };
      yearMap[year].values.push(v);
      yearMap[year].kpis.add(v.kpi_assigment_id);
    }
    // Tính toán từng năm
    const years: EmployeePerformanceYearDto[] = [];
    for (const year of Object.keys(yearMap).map(Number).sort()) {
      const yearData = yearMap[year];
      // Tính điểm trung bình theo tỷ lệ hoàn thành (%)
      const kpiScores = yearData.values.map(v => {
        const assignment = assignments.find(a => a.id === v.kpi_assigment_id);
        const target = assignment?.kpi?.target;
        if (target && Number(target) > 0) {
          return (Number(v.value) / Number(target)) * 100;
        }
        return 0;
      });
      const averageKpiScore = kpiScores.length
        ? parseFloat((kpiScores.reduce((a, b) => a + b, 0) / kpiScores.length).toFixed(2))
        : 0;
      // Đếm số KPI đạt (>= target) và chưa đạt
      let achievedCount = 0;
      let notAchievedCount = 0;
      for (const v of yearData.values) {
        // Lấy target của KPI
        const assignment = assignments.find(a => a.id === v.kpi_assigment_id);
        const target = assignment?.kpi?.target;
        if (target !== undefined && target !== null) {
          if (Number(v.value) >= Number(target)) achievedCount++;
          else notAchievedCount++;
        }
      }
      const total = achievedCount + notAchievedCount;
      const achievedRate = total > 0 ? parseFloat(((achievedCount / total) * 100).toFixed(2)) : 0;
      const notAchievedRate = total > 0 ? parseFloat(((notAchievedCount / total) * 100).toFixed(2)) : 0;
      // Lấy nhận xét nổi bật (manager review)
      const reviews = await reviewRepo.find({
        where: {
          employee: { id: employeeId },
          cycle: String(year),
        },
        order: { id: 'ASC' },
      });
      const highlightComments = reviews.map(r => r.managerComment).filter(Boolean);
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
      fullName: `${employee.first_name || ''} ${employee.last_name || ''}`.trim(),
      department: employee.department?.name,
      years,
    };
  }

  async getEmployeeSkillsWithLevel(employeeId: number) {
    // Lấy tất cả kỹ năng của nhân viên kèm competency
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
