import { plainToInstance } from 'class-transformer';
import { KPIAssignment } from 'src/kpi-assessments/entities/kpi-assignment.entity';
import { Employee } from '../employees/entities/employee.entity';
import { userHasPermission } from '../common/utils/permission.utils';
import { KpiValueStatus } from 'src/kpi-values/entities/kpi-value.entity';
import { Kpi, KpiDefinitionStatus } from 'src/kpis/entities/kpi.entity';
import {
  Brackets,
  DataSource,
  DeepPartial,
  IsNull,
  Not,
  Repository,
} from 'typeorm';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateKpiDto } from './dto/create_kpi_dto';
import { KpiFilterDto } from './dto/filter-kpi.dto';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { RBAC_ACTIONS, RBAC_RESOURCES } from '../common/rbac/rbac.constants';
import { evaluate } from 'mathjs';

interface AssignmentWithLatestValue extends KPIAssignment {
  latest_actual_value?: number | null;
  latest_value_timestamp?: Date | null;
}

interface KpiWithSectionActuals extends Kpi {
  actuals_by_section_id?: { [sectionId: number]: number | null };
  latest_value_timestamp?: Date | null;
}

interface KpiDetailWithProcessedAssignments extends Kpi {
  assignments: AssignmentWithLatestValue[];
}

@Injectable()
export class KpisService {
  private readonly logger = new Logger(KpisService.name);
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Kpi)
    private readonly kpisRepository: Repository<Kpi>,
    @InjectRepository(KPIAssignment)
    private readonly kpiAssignmentRepository: Repository<KPIAssignment>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    private eventEmitter: EventEmitter2,
  ) {}

  private async checkPermission(
    userId: number,
    action: string,
    resource: string,
  ) {
    const user = await this.employeeRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });
    if (!user) throw new UnauthorizedException('User not found.');

    const allPermissions = Array.isArray(user.roles)
      ? user.roles.flatMap((role: any) =>
          Array.isArray(role.permissions) ? role.permissions : [],
        )
      : [];
    const hasPermission = allPermissions.some(
      (p: any) => p.action === action && p.resource === resource,
    );
    if (!hasPermission)
      throw new UnauthorizedException(`No permission: ${action} ${resource}`);
  }

  private userHasPermission(
    user: Employee,
    resource: string,
    action: string,
    scope?: string,
  ): boolean {
    return userHasPermission(user, action, resource, scope);
  }

  async getKpisByEmployeeId(
    employeeId: number,
    userId: number,
  ): Promise<Kpi[]> {
    return this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.assignments', 'assignment')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.department', 'department')
      .leftJoinAndSelect('assignment.team', 'team')
      .leftJoinAndSelect('section.department', 'departmentOfSection')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue')
      .where('kpi.deleted_at IS NULL')
      .andWhere('assignment.deleted_at IS NULL')
      .andWhere('assignment.assigned_to_employee = :id', { id: employeeId })
      .getMany();
  }

  async findAll(
    filterDto: KpiFilterDto,
    userId: number,
  ): Promise<{
    data: Kpi[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  }> {
    const { page = 1, limit = 15 } = filterDto;

    const query = this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.assignments', 'assignment')
      .leftJoinAndSelect('assignment.department', 'department')
      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.team', 'team')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('section.department', 'departmentOfSection')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue')
      .leftJoinAndSelect('kpi.createdBy', 'createdBy')
      .leftJoinAndSelect('kpi.formula', 'formula')
      .where('kpi.deleted_at IS NULL');
    query.andWhere('assignment.deleted_at IS NULL');
    if (filterDto.name) {
      query.andWhere('kpi.name ILIKE :name', {
        name: `%${filterDto.name}%`,
      });
    }

    if (filterDto.perspectiveId) {
      query.andWhere('kpi.perspective_id = :perspectiveId', {
        perspectiveId: filterDto.perspectiveId,
      });
    }

    if (filterDto.departmentId) {
      query.andWhere(
        '(assignment.assigned_to_department = :departmentId AND assignment.deleted_at IS NULL) OR assignment.id IS NULL',
        {
          departmentId: filterDto.departmentId,
        },
      );
    }

    if (filterDto.sectionId) {
      query.andWhere(
        '(assignment.assigned_to_section = :sectionId AND assignment.deleted_at IS NULL) OR assignment.id IS NULL',
        {
          sectionId: filterDto.sectionId,
        },
      );
    }

    if (filterDto.teamId) {
      query.andWhere(
        '(assignment.assigned_to_team = :teamId AND assignment.deleted_at IS NULL) OR assignment.id IS NULL',
        {
          teamId: filterDto.teamId,
        },
      );
    }

    if (filterDto.assignedToId) {
      query.andWhere(
        '(assignment.assigned_to_employee = :assignedToId AND assignment.deleted_at IS NULL) OR assignment.id IS NULL',
        {
          assignedToId: filterDto.assignedToId,
        },
      );
    }

    if (filterDto.status) {
      query.andWhere('kpi.status = :status', {
        status: filterDto.status,
      });
    }

    if (filterDto.scope) {
      query.andWhere('kpi.created_by_type = :scope', {
        scope: filterDto.scope,
      });
    }

    if (filterDto.startDate) {
      query.andWhere('kpi.start_date >= :startDate', {
        startDate: filterDto.startDate,
      });
    }

    if (filterDto.endDate) {
      query.andWhere('kpi.end_date <= :endDate', {
        endDate: filterDto.endDate,
      });
    }

    query.distinct(true);

    const validSortColumns = ['name', 'created_at'];
    const sortBy = validSortColumns.includes(filterDto.sortBy ?? '')
      ? filterDto.sortBy!
      : 'created_at';
    const sortOrder = filterDto.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    query.orderBy(`kpi.${sortBy}`, sortOrder);

    const [data, totalItems] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const dataWithActualValue = data.map((kpi) => {
      const activeAssignments = kpi.assignments.filter(
        (assignment) =>
          assignment.deleted_at === null || assignment.deleted_at === undefined,
      );
      const allValues = activeAssignments
        .flatMap((assignment) => assignment.kpiValues)
        .map((value) => Number(value.value) || 0);
      const allTargets = activeAssignments.map(
        (a) => Number(a.targetValue) || 0,
      );
      let actual_value = 0;
      if (kpi.formula && kpi.formula.expression) {
        try {
          const scope = {
            values: allValues,
            targets: allTargets,
            target: Number(kpi.target) || 0,
            weight: Number(kpi.weight) || 0,
          };
          const result = evaluate(kpi.formula.expression, scope);
          actual_value =
            typeof result === 'number' && !isNaN(result)
              ? parseFloat(result.toFixed(2))
              : 0;
        } catch (err) {
          actual_value = 0;
        }
      } else {
        actual_value =
          allValues.length > 0
            ? allValues.reduce((sum, val) => sum + val, 0) / allValues.length
            : 0;
      }

      const validityStatus = getKpiStatus(kpi.start_date, kpi.end_date);
      return { ...kpi, actual_value, validityStatus };
    });

    const pagination = {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      itemsPerPage: limit,
    };

    return { data: dataWithActualValue, pagination };
  }

  async getDepartmentKpis(
    departmentId: number,
    filterDto: KpiFilterDto,
    loggedInUser: Employee,
  ): Promise<{
    data: Kpi[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  }> {
    const { page = 1, limit = 15 } = filterDto;
    let effectiveDepartmentId: number | null = departmentId;

    if (this.userHasPermission(loggedInUser, 'kpi', 'view', 'department')) {
      effectiveDepartmentId = loggedInUser.departmentId;
    } else if (this.userHasPermission(loggedInUser, 'kpi', 'view', 'section')) {
      effectiveDepartmentId = loggedInUser.department?.id || null;
    }

    const query = this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.assignments', 'assignment')
      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.team', 'team')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue')
      .leftJoinAndSelect('section.department', 'departmentOfSection')
      .where('kpi.deleted_at IS NULL')
      .andWhere('assignment.deleted_at IS NULL');

    if (effectiveDepartmentId !== null && effectiveDepartmentId !== 0) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where(
            'kpi.created_by_type = :createdType AND kpi.created_by = :deptId',
            {
              createdType: 'department',
              deptId: effectiveDepartmentId,
            },
          )
            .orWhere('assignment.assigned_to_department = :deptId', {
              deptId: effectiveDepartmentId,
            })
            .orWhere('departmentOfSection.id = :deptId', {
              deptId: effectiveDepartmentId,
            })
            .orWhere('employee.departmentId = :deptId', {
              deptId: effectiveDepartmentId,
            });
        }),
      );
    } else if (
      !this.userHasPermission(loggedInUser, 'kpi', 'view', 'admin') &&
      !this.userHasPermission(loggedInUser, 'kpi', 'view', 'manager')
    ) {
      return {
        data: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: limit,
        },
      };
    }

    if (filterDto.name) {
      query.andWhere('kpi.name ILIKE :name', {
        name: `%${filterDto.name}%`,
      });
    }

    if (filterDto.perspectiveId) {
      query.andWhere('kpi.perspective_id = :perspectiveId', {
        perspectiveId: filterDto.perspectiveId,
      });
    }

    if (filterDto.sectionId) {
      query.andWhere('assignment.assigned_to_section = :sectionId', {
        sectionId: filterDto.sectionId,
      });
    }

    if (filterDto.teamId) {
      query.andWhere('assignment.assigned_to_team = :teamId', {
        teamId: filterDto.teamId,
      });
    }

    if (filterDto.assignedToId) {
      query.andWhere('assignment.assigned_to_employee = :assignedToId', {
        assignedToId: filterDto.assignedToId,
      });
    }

    if (filterDto.status) {
      query.andWhere('kpi.status = :status', {
        status: filterDto.status,
      });
    }

    if (filterDto.startDate) {
      query.andWhere('kpi.start_date >= :startDate', {
        startDate: filterDto.startDate,
      });
    }

    if (filterDto.endDate) {
      query.andWhere('kpi.end_date <= :endDate', {
        endDate: filterDto.endDate,
      });
    }

    query.distinct(true);

    const validSortColumns = ['name', 'created_at'];
    const sortBy = validSortColumns.includes(filterDto.sortBy ?? '')
      ? filterDto.sortBy!
      : 'created_at';
    const sortOrder = filterDto.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    query.orderBy(`kpi.${sortBy}`, sortOrder);

    const [data, totalItems] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const dataWithActualValue = data.map((kpi) => {
      const activeAssignments = kpi.assignments.filter(
        (assignment) =>
          assignment.deleted_at === null || assignment.deleted_at === undefined,
      );
      const employeeLatestApprovedValues = new Map<number, number>();
      activeAssignments.forEach((assignment) => {
        if (
          assignment.assigned_to_employee &&
          assignment.kpiValues &&
          assignment.kpiValues.length > 0
        ) {
          const approvedValues = assignment.kpiValues
            .filter((kv) => kv.status === 'APPROVED')
            .sort(
              (a, b) =>
                new Date(b.updated_at || b.timestamp).getTime() -
                new Date(a.updated_at || a.timestamp).getTime(),
            );
          if (approvedValues.length > 0) {
            const latestValue = Number(approvedValues[0].value) || 0;
            employeeLatestApprovedValues.set(
              assignment.assigned_to_employee,
              latestValue,
            );
          }
        }
      });
      const allValues = Array.from(employeeLatestApprovedValues.values());
      const allTargets = activeAssignments.map(
        (a) => Number(a.targetValue) || 0,
      );
      let actual_value = 0;
      if (kpi.formula && kpi.formula.expression) {
        try {
          const scope = {
            values: allValues,
            targets: allTargets,
            target: Number(kpi.target) || 0,
            weight: Number(kpi.weight) || 0,
          };
          const result = evaluate(kpi.formula.expression, scope);
          actual_value =
            typeof result === 'number' && !isNaN(result)
              ? parseFloat(result.toFixed(2))
              : 0;
        } catch (err) {
          actual_value = 0;
        }
      } else {
        actual_value =
          allValues.length > 0
            ? allValues.reduce((sum, val) => sum + val, 0) / allValues.length
            : 0;
      }
      const validityStatus = getKpiStatus(kpi.start_date, kpi.end_date);
      return { ...kpi, actual_value: actual_value ?? 0, validityStatus };
    });

    const pagination = {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      itemsPerPage: limit,
    };

    return { data: dataWithActualValue, pagination };
  }

  async getAllKpiAssignedToDepartments(userId: number): Promise<Kpi[]> {
    return this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('kpi.assignments', 'assignment')
      .leftJoinAndSelect('assignment.department', 'department')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.team', 'team')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValues')
      .leftJoinAndSelect('section.department', 'departmentOfSection')
      .where('assignment.assigned_to_department IS NOT NULL')
      .andWhere('assignment.deleted_at IS NULL')
      .andWhere('kpi.deleted_at IS NULL')
      .getMany();
  }

  async getAllKpiAssignedToSections(userId: number): Promise<Kpi[]> {
    return this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('kpi.assignments', 'assignment')
      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('assignment.department', 'department')
      .leftJoinAndSelect('assignment.team', 'team')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValues')
      .leftJoinAndSelect('section.department', 'departmentOfSection')
      .where('assignment.assigned_to_section IS NOT NULL')
      .andWhere('assignment.deleted_at IS NULL')
      .andWhere('kpi.deleted_at IS NULL')
      .getMany();
  }

  async getKpiComparisonData(userId: number): Promise<{ data: any[] }> {
    const kpis = await this.kpisRepository.find({
      where: {},
      relations: [
        'assignments',
        'assignments.department',
        'assignments.kpiValues',
        'formula',
      ],
    });
    const result: any[] = [];
    for (const kpi of kpis) {
      const departmentAssignment = (kpi.assignments || []).find(
        (a) => a.department && a.department.name,
      );
      const departmentName = departmentAssignment?.department?.name || 'N/A';
      const activeAssignments = (kpi.assignments || []).filter(
        (a) => !a.deleted_at,
      );
      const allValues = activeAssignments
        .flatMap((a) => a.kpiValues || [])
        .map((v) => Number(v.value) || 0);
      const allTargets = activeAssignments.map(
        (a) => Number(a.targetValue) || 0,
      );
      let actual_value = 0;
      if (kpi.formula && kpi.formula.expression) {
        actual_value = this.evaluateFormulaExpression(kpi.formula.expression, {
          values: allValues,
          targets: allTargets,
          target: kpi.target,
          weight: kpi.weight,
        });
      }
      result.push({
        department_name: departmentName,
        kpi_name: kpi.name,
        target: kpi.target,
        actual_value,
      });
    }
    return { data: result };
  }

  async getSectionKpis(
    sectionIdParam: number | string,
    filterDto: KpiFilterDto,
    loggedInUser: Employee,
  ): Promise<{
    data: KpiWithSectionActuals[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  }> {
    if (
      !loggedInUser.roles ||
      !Array.isArray(loggedInUser.roles) ||
      loggedInUser.roles.some((role: any) => !role.permissions)
    ) {
      const userWithRoles = await this.employeeRepository.findOne({
        where: { id: loggedInUser.id },
        relations: ['roles', 'roles.permissions'],
      });
      if (userWithRoles) {
        loggedInUser.roles = userWithRoles.roles;
      }
    }

    console.log(
      '[KPI][getSectionKpis] User:',
      loggedInUser?.id,
      loggedInUser?.username,
      'Roles:',
      loggedInUser?.roles,
    );
    const { page = 1, limit = 15 } = filterDto;
    let effectiveSectionId: number | null = Number(sectionIdParam);
    let effectiveDepartmentId: number | null = filterDto.departmentId ?? null;

    const query = this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.assignments', 'assignment')
      .leftJoinAndSelect('assignment.department', 'department')
      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.team', 'team')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('section.department', 'departmentOfSection')
      .leftJoinAndSelect('employee.section', 'employeeSection')
      .leftJoinAndSelect(
        'employeeSection.department',
        'departmentOfEmployeeSection',
      )
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue')
      .where('kpi.deleted_at IS NULL')
      .andWhere('assignment.deleted_at IS NULL');

    if (effectiveDepartmentId !== null && effectiveDepartmentId !== 0) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('departmentOfSection.id = :deptId', {
            deptId: effectiveDepartmentId,
          }).orWhere('departmentOfEmployeeSection.id = :deptId', {
            deptId: effectiveDepartmentId,
          });
        }),
      );
    }

    if (effectiveSectionId !== null && effectiveSectionId !== 0) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('assignment.assigned_to_section = :sid', {
            sid: effectiveSectionId,
          }).orWhere('employee.sectionId = :sid', { sid: effectiveSectionId });
        }),
      );
    } else {
      if (
        this.userHasPermission(loggedInUser, 'kpi', 'view', 'company') ||
        this.userHasPermission(loggedInUser, 'kpi', 'view', 'department') ||
        this.userHasPermission(loggedInUser, 'kpi', 'view', 'section')
      ) {
        query.andWhere(
          new Brackets((qb) => {
            qb.where('assignment.assigned_to_section IS NOT NULL').orWhere(
              'employee.sectionId IS NOT NULL',
            );
          }),
        );
      } else {
        return {
          data: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: limit,
          },
        };
      }
    }

    if (filterDto.name) {
      query.andWhere('kpi.name ILIKE :name', { name: `%${filterDto.name}%` });
    }
    if (filterDto.perspectiveId) {
      query.andWhere('kpi.perspective_id = :perspectiveId', {
        perspectiveId: filterDto.perspectiveId,
      });
    }

    if (filterDto.teamId) {
      query.andWhere('assignment.assigned_to_team = :teamId', {
        teamId: filterDto.teamId,
      });
    }
    if (filterDto.status) {
      query.andWhere('kpi.status = :status', { status: filterDto.status });
    }
    if (filterDto.startDate) {
      query.andWhere('kpi.start_date >= :startDate', {
        startDate: filterDto.startDate,
      });
    }
    if (filterDto.endDate) {
      query.andWhere('kpi.end_date <= :endDate', {
        endDate: filterDto.endDate,
      });
    }

    query.distinct(true);

    const validSortColumns = ['name', 'created_at'];
    const sortBy = validSortColumns.includes(filterDto.sortBy ?? '')
      ? filterDto.sortBy!
      : 'created_at';
    const sortOrder = filterDto.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    query.orderBy(`kpi.${sortBy}`, sortOrder);

    const [data, totalItems] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const totalAssignments = data.reduce(
      (sum, kpi) =>
        sum + (Array.isArray(kpi.assignments) ? kpi.assignments.length : 0),
      0,
    );
    console.log(
      '[KPI][getSectionKpis] Query assignments count:',
      totalAssignments,
      'KPI count:',
      data.length,
    );

    const dataWithSectionActuals = data.map((kpi) => {
      const actuals_by_section_id: { [sectionId: number]: number | null } = {};
      const employee_values_by_section: {
        [sectionId: number]: { values: number[]; targets: number[] };
      } = {};
      if (kpi.assignments) {
        kpi.assignments.forEach((assignment) => {
          if (
            assignment.assigned_to_employee &&
            assignment.employee &&
            assignment.employee.sectionId &&
            assignment.deleted_at === null
          ) {
            const employeeActualSectionId = assignment.employee.sectionId;
            let latestApprovedValue: number | null = null;
            if (assignment.kpiValues && assignment.kpiValues.length > 0) {
              const approved = assignment.kpiValues
                .filter((v) => {
                  return v.status === KpiValueStatus.APPROVED;
                })
                .sort(
                  (a, b) =>
                    new Date(b.updated_at || b.created_at).getTime() -
                    new Date(a.updated_at || a.created_at).getTime(),
                );
              if (approved.length > 0 && approved[0].value != null) {
                const val = Number(approved[0].value);
                latestApprovedValue = isNaN(val) ? null : val;
              }
            }
            if (latestApprovedValue !== null) {
              if (!employee_values_by_section[employeeActualSectionId]) {
                employee_values_by_section[employeeActualSectionId] = {
                  values: [],
                  targets: [],
                };
              }
              employee_values_by_section[employeeActualSectionId].values.push(
                latestApprovedValue,
              );
              if (assignment.targetValue != null) {
                employee_values_by_section[
                  employeeActualSectionId
                ].targets.push(Number(assignment.targetValue));
              }
            }
          }
        });
      }
      for (const sectionIdStr in employee_values_by_section) {
        const currentSectionAggId = parseInt(sectionIdStr, 10);
        const { values, targets } =
          employee_values_by_section[currentSectionAggId];
        let sectionActual = 0;
        if (kpi.formula && kpi.formula.expression) {
          try {
            const scope = {
              values,
              targets,
              target: Number(kpi.target) || 0,
              weight: Number(kpi.weight) || 0,
            };
            const result = evaluate(kpi.formula.expression, scope);
            sectionActual =
              typeof result === 'number' && !isNaN(result)
                ? parseFloat(result.toFixed(2))
                : 0;
          } catch (err) {
            sectionActual = 0;
          }
        } else {
          sectionActual =
            values.length > 0
              ? values.reduce((sum, val) => sum + val, 0) / values.length
              : 0;
        }
        actuals_by_section_id[currentSectionAggId] = sectionActual;
      }
      const validityStatus = getKpiStatus(kpi.start_date, kpi.end_date);
      return { ...kpi, actuals_by_section_id, validityStatus };
    });

    const pagination = {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      totalItems: totalItems,
      itemsPerPage: limit,
    };

    return { data: dataWithSectionActuals, pagination: pagination };
  }

  async getEmployeeKpis(
    employeeId: number,
    filterDto: KpiFilterDto,
    userId: number,
  ): Promise<{
    data: Kpi[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  }> {
    const { page = 1, limit = 15 } = filterDto;

    const query = this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.assignments', 'assignment')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue')
      .andWhere('assignment.assigned_to_employee = :employeeId', {
        employeeId,
      });

    if (filterDto.name) {
      query.andWhere('kpi.name ILIKE :name', {
        name: `%${filterDto.name}%`,
      });
    }

    if (filterDto.perspectiveId) {
      query.andWhere('kpi.perspective_id = :perspectiveId', {
        perspectiveId: filterDto.perspectiveId,
      });
    }

    if (filterDto.status) {
      query.andWhere('kpi.status = :status', {
        status: filterDto.status,
      });
    }

    if (filterDto.startDate) {
      query.andWhere('kpi.start_date >= :startDate', {
        startDate: filterDto.startDate,
      });
    }

    if (filterDto.endDate) {
      query.andWhere('kpi.end_date <= :endDate', {
        endDate: filterDto.endDate,
      });
    }

    const validSortColumns = ['name', 'created_at'];
    const sortBy = validSortColumns.includes(filterDto.sortBy ?? '')
      ? filterDto.sortBy!
      : 'created_at';
    const sortOrder = filterDto.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    query.orderBy(`kpi.${sortBy}`, sortOrder);

    const [data, totalItems] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const dataWithValidityStatus = data.map((kpi) => {
      const validityStatus = getKpiStatus(kpi.start_date, kpi.end_date);
      return { ...kpi, validityStatus };
    });

    const pagination = {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      itemsPerPage: limit,
    };

    return { data: dataWithValidityStatus, pagination };
  }

  private evaluateFormulaExpression(
    expression: string,
    variables: Record<string, any>,
  ): number {
    try {
      const result = evaluate(expression, variables);
      if (typeof result === 'number' && !isNaN(result)) {
        return parseFloat(result.toFixed(2));
      }
      return 0;
    } catch (e) {
      return 0;
    }
  }

  async findOne(
    id: number,
    userId: number,
  ): Promise<KpiDetailWithProcessedAssignments> {
    const kpi = await this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('kpi.createdBy', 'createdBy')
      .leftJoinAndSelect(
        'kpi.assignments',
        'assignment',
        'assignment.deleted_at IS NULL',
      )
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue')
      .leftJoinAndSelect('assignment.department', 'department')
      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.team', 'team')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('section.department', 'sectionDepartment')
      .leftJoinAndSelect('employee.department', 'employeeDepartment')
      .leftJoinAndSelect('employee.section', 'employeeSection')
      .where('kpi.id = :id', { id })
      .andWhere('kpi.deleted_at IS NULL')
      .orderBy({ 'assignment.id': 'ASC', 'kpiValue.timestamp': 'DESC' })
      .getOne();

    if (!kpi) {
      throw new NotFoundException(`KPI with ID "${id}" not found`);
    }
    if (!kpi.assignments) {
      kpi.assignments = [];
    }

    const employeeLatestApprovedValues = new Map<
      number,
      { value: number | null; target: number | null }
    >();
    kpi.assignments
      .filter((a) => a.assigned_to_employee != null)
      .forEach((assign) => {
        const employeeId = assign.assigned_to_employee;
        if (employeeId === null || employeeId === undefined) {
          return;
        }
        let latestApprovedValue: number | null = null;
        if (assign.kpiValues && assign.kpiValues.length > 0) {
          const approved = assign.kpiValues
            .filter((v) => v.status === KpiValueStatus.APPROVED)
            .sort(
              (a, b) =>
                new Date(b.updated_at || b.created_at).getTime() -
                new Date(a.updated_at || a.created_at).getTime(),
            );
          if (approved.length > 0 && approved[0].value != null) {
            latestApprovedValue = Number(approved[0].value);
            if (isNaN(latestApprovedValue)) latestApprovedValue = null;
          }
        }
        employeeLatestApprovedValues.set(employeeId, {
          value: latestApprovedValue,
          target: assign.targetValue ?? null,
        });
      });

    const processedAssignments = kpi.assignments.map((assignment) => {
      let calculatedActualValue: number | null = null;

      if (assignment.assigned_to_employee) {
        calculatedActualValue =
          employeeLatestApprovedValues.get(assignment.assigned_to_employee)
            ?.value ?? null;
      } else if (assignment.assigned_to_section) {
        const sectionId = assignment.assigned_to_section;
        const relevantValues: number[] = [];
        const relevantTargets: number[] = [];
        kpi.assignments.forEach((empAssign) => {
          if (
            empAssign.assigned_to_employee &&
            empAssign.employee?.sectionId === sectionId
          ) {
            const empData = employeeLatestApprovedValues.get(
              empAssign.assigned_to_employee,
            );
            if (empData && empData.value !== null) {
              relevantValues.push(empData.value);
              if (empData.target !== null) {
                relevantTargets.push(empData.target);
              }
            }
          }
        });

        if (kpi.formula && kpi.formula.expression) {
          try {
            const scope = {
              values: relevantValues,
              targets: relevantTargets,
              target: Number(assignment.targetValue) || 0,
              weight: Number(assignment.weight) || 0,
            };
            const result = evaluate(kpi.formula.expression, scope);
            calculatedActualValue =
              typeof result === 'number' && !isNaN(result)
                ? parseFloat(result.toFixed(2))
                : 0;
          } catch (err) {
            calculatedActualValue = 0;
          }
        } else {
          calculatedActualValue =
            relevantValues.length > 0
              ? relevantValues.reduce((sum, val) => sum + val, 0) /
                relevantValues.length
              : 0;
        }
      } else if (assignment.assigned_to_department) {
        const departmentId = assignment.assigned_to_department;
        const relevantValues: number[] = [];
        const relevantTargets: number[] = [];
        kpi.assignments.forEach((empAssign) => {
          if (
            empAssign.assigned_to_employee &&
            empAssign.employee?.departmentId === departmentId
          ) {
            const empData = employeeLatestApprovedValues.get(
              empAssign.assigned_to_employee,
            );
            if (empData && empData.value !== null) {
              relevantValues.push(empData.value);
              if (empData.target !== null) {
                relevantTargets.push(empData.target);
              }
            }
          }
        });

        if (kpi.formula && kpi.formula.expression) {
          try {
            const scope = {
              values: relevantValues,
              targets: relevantTargets,
              target: Number(assignment.targetValue) || 0,
              weight: Number(assignment.weight) || 0,
            };
            const result = evaluate(kpi.formula.expression, scope);
            calculatedActualValue =
              typeof result === 'number' && !isNaN(result)
                ? parseFloat(result.toFixed(2))
                : 0;
          } catch (err) {
            calculatedActualValue = 0;
          }
        } else {
          calculatedActualValue =
            relevantValues.length > 0
              ? relevantValues.reduce((sum, val) => sum + val, 0) /
                relevantValues.length
              : 0;
        }
      }
      return {
        ...assignment,
        latest_actual_value: calculatedActualValue,
        startDate: assignment.startDate ? new Date(assignment.startDate) : null,
        endDate: assignment.endDate ? new Date(assignment.endDate) : null,
      } as AssignmentWithLatestValue;
    });

    return { ...kpi, assignments: processedAssignments };
  }

  async getKpiAssignments(
    kpiId: number,
    userId: number,
  ): Promise<KPIAssignment[]> {
    const assignments = await this.kpiAssignmentRepository.find({
      where: { kpi_id: kpiId, deleted_at: IsNull() },
      withDeleted: true,
      relations: [
        'kpi',
        'department',
        'section',
        'team',
        'employee',
        'kpiValues',
      ],
      order: {
        employee: {
          first_name: 'ASC',
          last_name: 'ASC',
        },
      },
    });

    const processedAssignments = assignments.map((assignment) => {
      let latestValue: number | null = null;
      let latestTimestamp: Date | null = null;

      if (assignment.kpiValues && assignment.kpiValues.length > 0) {
        const sortedValues = [...assignment.kpiValues].sort(
          (a, b) =>
            new Date(b.updated_at || b.timestamp).getTime() -
            new Date(a.updated_at || a.timestamp).getTime(),
        );
        const latestKpiValue = sortedValues[0];

        if (latestKpiValue) {
          latestValue = latestKpiValue.value;
          latestTimestamp = latestKpiValue.timestamp;
        }
      }

      const result: AssignmentWithLatestValue = {
        ...assignment,
        latest_actual_value: latestValue,
        latest_value_timestamp: latestTimestamp,
        startDate: assignment.startDate ? new Date(assignment.startDate) : null,
        endDate: assignment.endDate ? new Date(assignment.endDate) : null,
      };

      return result;
    });

    return processedAssignments;
  }

  async recalculateKpiActualValue(kpiId: number): Promise<void> {
    const kpi = await this.kpisRepository.findOne({
      where: { id: kpiId },
      relations: ['formula'],
    });
    if (!kpi) {
      return;
    }
    const assignments = await this.kpiAssignmentRepository.find({
      where: { kpi_id: kpiId, deleted_at: IsNull() },
      relations: ['kpiValues'],
    });
    const latestApprovedValues: number[] = [];
    const correspondingTargets: number[] = [];
    if (assignments && assignments.length > 0) {
      for (const assignment of assignments) {
        const latestApprovedValueRecord = assignment.kpiValues
          ?.filter((v) => v.status === KpiValueStatus.APPROVED)
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          )[0];
        if (latestApprovedValueRecord) {
          latestApprovedValues.push(latestApprovedValueRecord.value);
          if (assignment.targetValue != null) {
            correspondingTargets.push(assignment.targetValue);
          }
        }
      }
    }
    let newActualValue: number | null = null;
    if (kpi.formula && kpi.formula.expression) {
      newActualValue = this.evaluateFormulaExpression(kpi.formula.expression, {
        values: latestApprovedValues,
        targets: correspondingTargets,
        target: kpi.target,
        weight: kpi.weight,
      });
    }
    const finalActualValue =
      newActualValue === null ? null : parseFloat(newActualValue.toFixed(2));
    if (kpi.actual_value !== finalActualValue) {
      kpi.actual_value = finalActualValue;
      kpi.updated_at = new Date();
      await this.kpisRepository.save(kpi);
    }
  }

  @OnEvent('kpi_value.approved', { async: true })
  async handleKpiValueApproved(payload: { kpiId: number }) {
    if (!payload || typeof payload.kpiId !== 'number') {
      return;
    }
    await this.recalculateKpiActualValue(payload.kpiId);
  }

  async create(createKpiDto: CreateKpiDto, userId: number): Promise<Kpi> {
    const type = createKpiDto?.assignments?.from || 'company';
    return await this.kpisRepository.manager.transaction(
      async (manager): Promise<Kpi> => {
        const dto = plainToInstance(CreateKpiDto, createKpiDto);
        const { assignments, id, ...kpiData } = dto as any;

        const createdByType = assignments?.from || 'company';
        const authenticatedUserId = userId;
        let creatorEntityId: number | null = authenticatedUserId;
        if (createdByType === 'company') {
        }

        const kpiEntityToSave = manager.getRepository(Kpi).create({
          ...kpiData,
          formula_id: kpiData.formula_id || kpiData.formulaId,
          perspective_id: kpiData.perspectiveId || kpiData.perspective_id,
          start_date: kpiData.startDate || kpiData.start_date,
          end_date: kpiData.endDate || kpiData.end_date,
          memo: kpiData.description || kpiData.memo,
          created_by: creatorEntityId,
          created_by_type: createdByType,
          created_at: new Date(),
          updated_at: new Date(),
        });

        const saveResult = await manager
          .getRepository(Kpi)
          .save(kpiEntityToSave);

        let savedKpiObject: Kpi;

        if (Array.isArray(saveResult) && saveResult.length > 0) {
          savedKpiObject = saveResult[0];
        } else if (!Array.isArray(saveResult) && saveResult) {
          savedKpiObject = saveResult as Kpi;
        } else {
          throw new Error('Failed to save KPI or received unexpected result.');
        }

        const assignmentEntities: KPIAssignment[] = [];
        const assignedByUserId = authenticatedUserId;

        if (assignments?.toDepartments) {
          for (const targetDepartment of assignments.toDepartments) {
            const assignment = new KPIAssignment();
            assignment.kpi = { id: savedKpiObject.id } as Kpi;
            assignment.assignedFrom = assignments?.from || createdByType;
            assignment.assigned_to_department = targetDepartment.id;
            assignment.targetValue =
              Number(targetDepartment.target) ?? Number(kpiData.target);
            assignment.assignedBy = assignedByUserId;
            assignment.status = savedKpiObject.status;
            assignment.startDate = kpiData.startDate
              ? new Date(kpiData.startDate.split('T')[0])
              : null;
            assignment.endDate = kpiData.endDate
              ? new Date(kpiData.endDate.split('T')[0])
              : null;
            assignment.weight = kpiData.weight;
            assignmentEntities.push(assignment);
          }
        }

        if (assignments?.toSections) {
          for (const targetSection of assignments.toSections) {
            const assignment = new KPIAssignment();
            assignment.kpi = { id: savedKpiObject.id } as Kpi;
            assignment.assignedFrom = assignments?.from || createdByType;
            assignment.assigned_to_section = targetSection.id;
            assignment.targetValue =
              Number(targetSection.target) ?? Number(kpiData.target);
            assignment.assignedBy = assignedByUserId;
            assignment.status = savedKpiObject.status;
            assignment.startDate = kpiData.startDate
              ? new Date(kpiData.startDate.split('T')[0])
              : null;
            assignment.endDate = kpiData.endDate
              ? new Date(kpiData.endDate.split('T')[0])
              : null;
            assignment.weight = kpiData.weight;
            assignmentEntities.push(assignment);
          }
        }

        if (assignments?.employeeId) {
          const assignedToEmployeeId = assignments.employeeId;
          const employee = await this.employeeRepository.findOne({
            where: { id: assignedToEmployeeId },
            relations: ['department'],
          });

          const employeeAssignment = new KPIAssignment();
          employeeAssignment.kpi = { id: savedKpiObject.id } as Kpi;
          employeeAssignment.assignedFrom = assignments?.from || createdByType;
          employeeAssignment.assigned_to_employee = assignedToEmployeeId;
          employeeAssignment.employee_id = assignedToEmployeeId;
          employeeAssignment.targetValue = Number(kpiData.target);
          employeeAssignment.assignedBy = assignedByUserId;
          employeeAssignment.status = savedKpiObject.status;
          employeeAssignment.startDate = kpiData.startDate
            ? new Date(kpiData.startDate.split('T')[0])
            : null;
          employeeAssignment.endDate = kpiData.endDate
            ? new Date(kpiData.endDate.split('T')[0])
            : null;
          employeeAssignment.weight = kpiData.weight;

          if (employee?.department) {
            employeeAssignment.assigned_to_department = employee.department.id;
          }

          assignmentEntities.push(employeeAssignment);
        }

        if (
          assignments?.to_employees &&
          Array.isArray(assignments.to_employees)
        ) {
          for (const userAssignment of assignments.to_employees) {
            if (!userAssignment.id) continue;
            const employeeAssignment = new KPIAssignment();
            employeeAssignment.kpi = { id: savedKpiObject.id } as Kpi;
            employeeAssignment.assignedFrom =
              assignments?.from || createdByType;
            employeeAssignment.assigned_to_employee = userAssignment.id;
            employeeAssignment.employee_id = userAssignment.id;
            employeeAssignment.targetValue = Number(userAssignment.target);
            employeeAssignment.assignedBy = assignedByUserId;
            employeeAssignment.status = savedKpiObject.status;
            employeeAssignment.startDate =
              kpiData.startDate || kpiData.start_date;
            employeeAssignment.endDate = kpiData.endDate || kpiData.end_date;
            employeeAssignment.weight = userAssignment.weight || null;
            assignmentEntities.push(employeeAssignment);
          }
        }

        if (assignmentEntities.length > 0) {
          await manager.getRepository(KPIAssignment).save(assignmentEntities);
        }

        return savedKpiObject;
      },
    );
  }

  async update(id: number, update: Partial<Kpi>, userId: number): Promise<Kpi> {
    const kpi = await this.kpisRepository.findOne({ where: { id } });

    if (!kpi) {
      throw new NotFoundException(`KPI with ID ${id} not found`);
    }

    // Check if KPI has expired
    const kpiValidityStatus = getKpiStatus(kpi.start_date, kpi.end_date);
    if (kpiValidityStatus === 'expired') {
      throw new BadRequestException(
        'Cannot update expired KPI. This KPI is no longer valid.',
      );
    }

    const updatePayload: Partial<Kpi> = { ...update };
    if ((update as any).formula_id || (update as any).formulaId) {
      updatePayload.formula_id =
        (update as any).formula_id || (update as any).formulaId;
    }

    if ('calculation_type' in updatePayload) {
      delete (updatePayload as any).calculation_type;
    }
    await this.kpisRepository.update(id, updatePayload);
    return this.findOne(id, userId);
  }

  async softDelete(
    id: number,
    userId: number,
    kpiType: 'company' | 'department' | 'section' | 'employee',
  ): Promise<void> {
    await this.checkPermission(userId, RBAC_ACTIONS.DELETE, RBAC_RESOURCES.KPI);

    // Check if KPI has been scored
    const kpi = await this.kpisRepository.findOne({
      where: { id },
      relations: ['assignments', 'assignments.kpiValues'],
    });

    if (!kpi) {
      throw new NotFoundException(`KPI with ID ${id} not found`);
    }

    // Check if KPI has been scored
    const hasKpiValues = kpi.assignments?.some(
      (assignment) => assignment.kpiValues && assignment.kpiValues.length > 0,
    );

    if (hasKpiValues) {
      throw new BadRequestException(
        'Cannot delete KPI that has been scored. Please contact administrator for assistance.',
      );
    }

    await this.kpisRepository.softDelete(id);
  }

  async saveUserAssignments(
    kpiId: number,
    assignments: { user_id: number; target: number; weight?: number }[],
    loggedInUser: Employee,
  ): Promise<KPIAssignment[]> {
    if (!Array.isArray(assignments) || assignments.length === 0) {
      throw new BadRequestException('Assignments array is empty or invalid');
    }
    const kpi = await this.kpisRepository.findOne({ where: { id: kpiId } });
    if (!kpi) {
      throw new NotFoundException(`KPI with ID ${kpiId} not found`);
    }

    // Check if KPI has expired
    const kpiValidityStatus = getKpiStatus(kpi.start_date, kpi.end_date);
    if (kpiValidityStatus === 'expired') {
      throw new BadRequestException(
        'Cannot assign expired KPI to other employees. This KPI is no longer valid.',
      );
    }
    const assignedById = loggedInUser.id;
    const assignedFromType = kpi.created_by_type;
    const kpiWeight = kpi.weight;

    const allExistingUserAssignmentsIncludingSoftDeleted =
      await this.kpiAssignmentRepository.find({
        where: { kpi_id: kpiId, assigned_to_employee: Not(IsNull()) },
        withDeleted: true,
        relations: ['employee'],
      });

    const existingAssignmentsMap = new Map<number, KPIAssignment>();
    allExistingUserAssignmentsIncludingSoftDeleted.forEach((assignment) => {
      if (assignment.assigned_to_employee !== null) {
        existingAssignmentsMap.set(assignment.assigned_to_employee, assignment);
      }
    });

    const assignmentsToSave: KPIAssignment[] = [];

    for (const incomingAssignment of assignments) {
      // Check user permissions with proper scope hierarchy
      const hasCompanyPermission = this.userHasPermission(
        loggedInUser,
        'kpi',
        'assign',
        'company',
      );
      const hasDepartmentPermission = this.userHasPermission(
        loggedInUser,
        'kpi',
        'assign',
        'department',
      );
      const hasSectionPermission = this.userHasPermission(
        loggedInUser,
        'kpi',
        'assign',
        'section',
      );

      if (
        !hasCompanyPermission &&
        !hasDepartmentPermission &&
        !hasSectionPermission
      ) {
        throw new UnauthorizedException(
          'You do not have permission to assign KPIs.',
        );
      }

      // If user only has section permission, validate section assignment
      if (
        hasSectionPermission &&
        !hasDepartmentPermission &&
        !hasCompanyPermission
      ) {
        if (!loggedInUser.sectionId) {
          throw new UnauthorizedException(
            'You are not assigned to a section and cannot assign KPIs.',
          );
        }
        const employeeToAssign = await this.employeeRepository.findOne({
          where: {
            id: incomingAssignment.user_id,
            sectionId: loggedInUser.sectionId,
          },
        });
        if (!employeeToAssign) {
          throw new UnauthorizedException(
            `You can only assign KPIs to employees within your own section. User ID ${incomingAssignment.user_id} is not in your section or does not exist.`,
          );
        }
      }

      // If user has department permission (but not company), validate department assignment
      if (hasDepartmentPermission && !hasCompanyPermission) {
        if (!loggedInUser.departmentId) {
          throw new UnauthorizedException(
            'You are not assigned to a department and cannot assign KPIs.',
          );
        }
        const employeeToAssign = await this.employeeRepository.findOne({
          where: {
            id: incomingAssignment.user_id,
          },
          relations: ['section', 'section.department'],
        });
        if (
          !employeeToAssign ||
          employeeToAssign.section?.department?.id !== loggedInUser.departmentId
        ) {
          throw new UnauthorizedException(
            `You can only assign KPIs to employees within your department. User ID ${incomingAssignment.user_id} is not in your department or does not exist.`,
          );
        }
      }

      // If user has company permission, no additional validation needed (can assign to anyone)

      const existingAssignment = existingAssignmentsMap.get(
        incomingAssignment.user_id,
      );

      if (existingAssignment) {
        // Check if KPI has expired when updating existing assignment
        const kpiValidityStatus = getKpiStatus(kpi.start_date, kpi.end_date);
        if (kpiValidityStatus === 'expired') {
          throw new BadRequestException(
            'Cannot update target value for expired KPI. This KPI is no longer valid.',
          );
        }

        existingAssignment.targetValue = incomingAssignment.target;
        existingAssignment.updated_at = new Date();
        existingAssignment.deleted_at = null as any;
        assignmentsToSave.push(existingAssignment);
      } else {
        const newAssignment = this.kpiAssignmentRepository.create({
          kpi: { id: kpiId },
          assigned_to_employee: incomingAssignment.user_id,
          employee_id: incomingAssignment.user_id,
          targetValue: incomingAssignment.target,
          weight: kpiWeight,
          status: kpi.status,
          assignedFrom: assignedFromType,
          assignedBy: assignedById,
          created_at: new Date(),
          updated_at: new Date(),
          assigned_to_department: null,
          assigned_to_section: null,
          assigned_to_team: null,
          startDate: kpi.start_date,
          endDate: kpi.end_date,
        } as unknown as import('typeorm').DeepPartial<KPIAssignment>);
        assignmentsToSave.push(newAssignment);

        if (newAssignment.assigned_to_employee) {
          this.eventEmitter.emit('kpi.assigned', {
            assignment: newAssignment,
            kpiName: kpi.name,
          });
        }
      }
    }

    await this.kpiAssignmentRepository.manager.transaction(async (manager) => {
      if (assignmentsToSave.length > 0) {
        await manager.save(
          KPIAssignment,
          assignmentsToSave as unknown as KPIAssignment[],
        );
      }
    });

    const updatedAssignmentsList = await this.kpiAssignmentRepository.find({
      where: { kpi_id: kpiId },
      relations: ['employee'],
    });
    return updatedAssignmentsList;
  }

  async deleteSectionAssignment(
    kpiId: number,
    sectionId: number,
    userId: number,
  ): Promise<void> {
    const assignment = await this.kpiAssignmentRepository.findOne({
      where: { kpi_id: kpiId, assigned_to_section: sectionId },
      relations: ['kpi'],
    });
    if (!assignment) {
      throw new NotFoundException(
        `Section Assignment with KPI ID ${kpiId} and Section ID ${sectionId} not found`,
      );
    }
    const result = await this.kpiAssignmentRepository.update(
      { kpi_id: kpiId, assigned_to_section: sectionId },
      { deleted_at: new Date() },
    );
    if (result.affected === 0) {
      throw new NotFoundException(
        `Section Assignment with KPI ID ${kpiId} and Section ID ${sectionId} not found`,
      );
    }
  }

  async saveDepartmentAndSectionAssignments(
    kpiId: number,
    assignmentsData: {
      assigned_to_department?: number | null;
      assigned_to_section?: number | null;
      targetValue: number;
      assignmentId?: number | null;
    }[],
    userId: number,
  ): Promise<void> {
    if (!Array.isArray(assignmentsData) || assignmentsData.length === 0) {
      throw new BadRequestException('Assignments array is empty or invalid');
    }
    const assignmentRepo = this.dataSource.getRepository(KPIAssignment);

    return await this.dataSource.transaction(async (manager) => {
      const kpiRepo = manager.getRepository(Kpi);
      const kpi = await kpiRepo.findOneBy({ id: kpiId });
      if (!kpi) {
        throw new NotFoundException(`KPI with ID ${kpiId} not found`);
      }

      // Check if KPI has expired
      const kpiValidityStatus = getKpiStatus(kpi.start_date, kpi.end_date);
      if (kpiValidityStatus === 'expired') {
        throw new BadRequestException(
          'Cannot assign expired KPI to other departments/sections. This KPI is no longer valid.',
        );
      }

      const entitiesToSave: KPIAssignment[] = [];

      for (const assignmentData of assignmentsData) {
        if (assignmentData.assignmentId) {
          try {
            const existingAssignment = await assignmentRepo.findOneByOrFail({
              id: assignmentData.assignmentId,
            });

            // Check if KPI has expired when updating existing assignment
            const kpiValidityStatus = getKpiStatus(
              kpi.start_date,
              kpi.end_date,
            );
            if (kpiValidityStatus === 'expired') {
              throw new BadRequestException(
                'Cannot update target value for expired KPI. This KPI is no longer valid.',
              );
            }

            existingAssignment.targetValue = assignmentData.targetValue;
            existingAssignment.updated_at = new Date();
            entitiesToSave.push(existingAssignment);
          } catch (error) {
            if (error.name === 'EntityNotFoundError') {
              continue;
            } else {
              throw error;
            }
          }
        } else {
          if (
            assignmentData.assigned_to_department &&
            assignmentData.assigned_to_section
          ) {
            const deptAssignment = assignmentRepo.create({
              kpi: { id: kpiId } as Kpi,
              assignedFrom: kpi.created_by_type,
              assignedBy: userId,
              targetValue: assignmentData.targetValue,
              status: kpi.status,
              assigned_to_department: assignmentData.assigned_to_department,
              assigned_to_section: null,
              assigned_to_team: null,
              assigned_to_employee: null,
              employee_id: null,
              startDate: kpi.start_date,
              endDate: kpi.end_date,
              created_at: new Date(),
              updated_at: new Date(),
              assignedAt: new Date(),
            } as DeepPartial<KPIAssignment>);
            entitiesToSave.push(deptAssignment);

            const sectionAssignment = assignmentRepo.create({
              kpi: { id: kpiId } as Kpi,
              assignedFrom: kpi.created_by_type,
              assignedBy: userId,
              targetValue: assignmentData.targetValue,
              status: kpi.status,
              assigned_to_department: assignmentData.assigned_to_department,
              assigned_to_section: assignmentData.assigned_to_section,
              assigned_to_team: null,
              assigned_to_employee: null,
              employee_id: null,
              startDate: kpi.start_date,
              endDate: kpi.end_date,
              created_at: new Date(),
              updated_at: new Date(),
              assignedAt: new Date(),
            } as DeepPartial<KPIAssignment>);
            entitiesToSave.push(sectionAssignment);
            continue;
          }
          if (
            !assignmentData.assigned_to_department &&
            !assignmentData.assigned_to_section
          ) {
            throw new BadRequestException(
              'Assignment target (Department or Section) is required for new assignments.',
            );
          }

          const newAssignment = assignmentRepo.create({
            kpi: { id: kpiId } as Kpi,
            assignedFrom: kpi.created_by_type,
            assignedBy: userId,
            targetValue: assignmentData.targetValue,
            status: kpi.status,
            assigned_to_department:
              assignmentData.assigned_to_department || null,
            assigned_to_section: assignmentData.assigned_to_section || null,
            assigned_to_team: null,
            assigned_to_employee: null,
            employee_id: null,
            startDate: kpi.start_date,
            endDate: kpi.end_date,
            created_at: new Date(),
            updated_at: new Date(),
            assignedAt: new Date(),
          } as DeepPartial<KPIAssignment>);
          entitiesToSave.push(newAssignment);
        }
      }

      if (entitiesToSave.length > 0) {
        await assignmentRepo.save(entitiesToSave);
      }
    });
  }

  /**
   * Lấy tất cả KPI để kiểm tra hết hạn/sắp hết hạn (không phân trang, chỉ lấy các trường cần thiết)
   */
  async getAllKpisForExpiryCheck(): Promise<any[]> {
    const kpis = await this.kpisRepository.find({
      where: { deleted_at: IsNull() },
      relations: ['assignments', 'createdBy'],
    });
    return kpis.map((kpi) => {
      const validityStatus = getKpiStatus(kpi.start_date, kpi.end_date);
      return { ...kpi, validityStatus };
    });
  }

  /**
   * Lấy tất cả userId liên quan đến 1 KPI: người tạo, tất cả người được assign, leader, manager (nếu có)
   */
  async getAllRelatedUserIdsForKpi(kpi: any): Promise<number[]> {
    const userIds = new Set<number>();
    if (kpi.createdBy && kpi.createdBy.id) userIds.add(kpi.createdBy.id);
    if (Array.isArray(kpi.assignments)) {
      for (const assignment of kpi.assignments) {
        if (assignment.assigned_to_employee)
          userIds.add(assignment.assigned_to_employee);

        if (assignment.department && assignment.department.managerId)
          userIds.add(assignment.department.managerId);
        if (assignment.section && assignment.section.leaderId)
          userIds.add(assignment.section.leaderId);
      }
    }
    return Array.from(userIds);
  }

  async toggleKpiStatus(id: number, userId: number): Promise<Kpi> {
    await this.checkPermission(
      userId,
      RBAC_ACTIONS.TOGGLE_STATUS,
      RBAC_RESOURCES.KPI,
    );
    return await this.dataSource.transaction(async (manager) => {
      const kpiRepo = manager.getRepository(Kpi);
      const assignmentRepo = manager.getRepository(KPIAssignment);
      const employeeRepo = manager.getRepository(Employee);

      const kpi = await kpiRepo.findOneBy({ id });
      if (!kpi) {
        throw new NotFoundException(`KPI with ID ${id} not found`);
      }

      const user = await employeeRepo.findOne({
        where: { id: userId },
        relations: ['roles', 'roles.permissions'],
      });
      if (!user) {
        throw new UnauthorizedException('User not found.');
      }

      const allPermissions = Array.isArray(user.roles)
        ? user.roles.flatMap((role: any) =>
            Array.isArray(role.permissions) ? role.permissions : [],
          )
        : [];
      const hasTogglePermission = allPermissions.some(
        (p: any) =>
          p.action === RBAC_ACTIONS.TOGGLE_STATUS &&
          p.resource === RBAC_RESOURCES.KPI,
      );
      if (!hasTogglePermission) {
        throw new UnauthorizedException(
          'User does not have permission to change KPI status.',
        );
      }

      const newKpiStatus =
        kpi.status === KpiDefinitionStatus.DRAFT
          ? KpiDefinitionStatus.APPROVED
          : KpiDefinitionStatus.DRAFT;

      const newAssignmentStatus =
        newKpiStatus === KpiDefinitionStatus.APPROVED
          ? KpiDefinitionStatus.APPROVED
          : KpiDefinitionStatus.DRAFT;

      kpi.status = newKpiStatus;
      kpi.updated_by = userId;
      kpi.updated_at = new Date();
      const updatedKpi = await kpiRepo.save(kpi);

      await assignmentRepo.update(
        { kpi_id: id },
        { status: newAssignmentStatus, updated_at: new Date() },
      );

      return updatedKpi;
    });
  }
}

export function getKpiStatus(
  startDate: string | Date | null,
  endDate: string | Date | null,
): 'active' | 'expired' | 'expiring_soon' {
  const now = new Date();
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  if (end && now > end) return 'expired';
  if (
    end &&
    now >= new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000) &&
    now <= end
  )
    return 'expiring_soon';
  if (start && now < start) return 'expired';
  return 'active';
}
