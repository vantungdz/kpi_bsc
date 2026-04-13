import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, IsNull, Repository } from 'typeorm';
import { evaluate, mean } from 'mathjs';
import { Kpi } from '../entities/kpi.entity';
import { KPIAssignment } from '../../kpi-assessments/entities/kpi-assignment.entity';
import { Employee } from '../../employees/entities/employee.entity';
import {
  EvaluationPhase,
  KpiReview,
} from '../../evaluation/entities/kpi-review.entity';
import {
  effectiveManagerScoreForReporting,
  pickActiveReview,
} from '../../evaluation/annual-review-score.util';
import { KpiFilterDto } from '../dto/filter-kpi.dto';
import { userHasPermission } from '../../common/utils/permission.utils';
import { EmployeesService } from '../../employees/employees.service';
import { KpiCalculationService } from './kpi-calculation.service';
import { KpiValue, KpiValueStatus } from '../../kpi-values/entities/kpi-value.entity';
import { ReviewCycle } from '../../review-cycle/entities/review-cycle.entity';
import { getKpiStatus } from '../kpis.service';
import {
  AssignmentWithLatestValue,
  KpiWithSectionActuals,
  KpiDetailWithProcessedAssignments,
} from '../interfaces/kpi.interfaces';

@Injectable()
export class KpiQueryService {
  private readonly logger = new Logger(KpiQueryService.name);

  constructor(
    @InjectRepository(Kpi)
    private readonly kpisRepository: Repository<Kpi>,
    @InjectRepository(KPIAssignment)
    private readonly kpiAssignmentRepository: Repository<KPIAssignment>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(KpiReview)
    private readonly kpiReviewRepository: Repository<KpiReview>,
    private dataSource: DataSource,
    private employeesService: EmployeesService,
    private calculationService: KpiCalculationService,
  ) {}

  /**
   * Get all KPIs assigned to a specific employee.
   */
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

  /**
   * List KPIs with RBAC filtering, pagination, and calculated actual values.
   * Also used by ReportsService.
   */
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
    const { page = 1, limit = Math.min(filterDto.limit || 20, 100) } = filterDto;
    const loggedInUser = await this.employeesService.findOneWithPermissions(userId);
    if (!loggedInUser) {
      throw new UnauthorizedException('User not found');
    }
    const query = this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.assignments', 'assignment', 'assignment.deleted_at IS NULL')
      .leftJoinAndSelect('assignment.department', 'department')
      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.team', 'team')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('section.department', 'departmentOfSection')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue', 'kpiValue.status = :approvedStatus', { approvedStatus: 'APPROVED' })
      .leftJoinAndSelect('kpi.createdBy', 'createdBy')
      .leftJoinAndSelect('kpi.formula', 'formula')
      .where('kpi.deleted_at IS NULL');
    const hasViewCompany = userHasPermission(loggedInUser, 'view', 'kpi', 'company');
    const hasViewDepartment = userHasPermission(loggedInUser, 'view', 'kpi', 'department');
    const hasViewSection = userHasPermission(loggedInUser, 'view', 'kpi', 'section');
    if (!hasViewCompany) {
      const hasDepartmentFilter = hasViewDepartment && loggedInUser.departmentId;
      const hasSectionFilter = hasViewSection && loggedInUser.sectionId;
      if (hasDepartmentFilter || hasSectionFilter) {
        query.andWhere(new Brackets((qb) => {
          qb.where('assignment.id IS NULL').orWhere('kpi.created_by = :userId', { userId });
          if (hasDepartmentFilter) {
            qb.orWhere('assignment.assigned_to_department = :deptId', { deptId: loggedInUser.departmentId })
              .orWhere('departmentOfSection.id = :deptId', { deptId: loggedInUser.departmentId });
          }
          if (hasSectionFilter) {
            qb.orWhere('assignment.assigned_to_section = :sectionId', { sectionId: loggedInUser.sectionId });
          }
        }));
      } else {
        query.andWhere('kpi.created_by = :userId', { userId });
      }
    }
    if (filterDto.name) query.andWhere('kpi.name ILIKE :name', { name: `%${filterDto.name}%` });
    if (filterDto.perspectiveId) query.andWhere('kpi.perspective_id = :perspectiveId', { perspectiveId: filterDto.perspectiveId });
    if (filterDto.departmentId && filterDto.departmentId > 0) {
      query.andWhere('((assignment.assigned_to_department = :departmentId AND assignment.deleted_at IS NULL) OR assignment.id IS NULL)', { departmentId: filterDto.departmentId });
    }
    if (filterDto.sectionId && filterDto.sectionId > 0) {
      query.andWhere('((assignment.assigned_to_section = :sectionId AND assignment.deleted_at IS NULL) OR assignment.id IS NULL)', { sectionId: filterDto.sectionId });
    }
    if (filterDto.teamId && filterDto.teamId > 0) {
      query.andWhere('((assignment.assigned_to_team = :teamId AND assignment.deleted_at IS NULL) OR assignment.id IS NULL)', { teamId: filterDto.teamId });
    }
    if (filterDto.assignedToId && filterDto.assignedToId > 0) {
      query.andWhere('((assignment.assigned_to_employee = :assignedToId AND assignment.deleted_at IS NULL) OR assignment.id IS NULL)', { assignedToId: filterDto.assignedToId });
    }
    if (filterDto.status) query.andWhere('kpi.status = :status', { status: filterDto.status });
    if (filterDto.scope) query.andWhere('kpi.created_by_type = :scope', { scope: filterDto.scope });
    if (filterDto.startDate) query.andWhere('kpi.start_date >= :startDate', { startDate: filterDto.startDate });
    if (filterDto.endDate) query.andWhere('kpi.end_date <= :endDate', { endDate: filterDto.endDate });
    query.distinct(true);
    const validSortColumns = ['name', 'created_at'];
    const sortBy = validSortColumns.includes(filterDto.sortBy ?? '') ? filterDto.sortBy! : 'created_at';
    const sortOrder = filterDto.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    query.orderBy(`kpi.${sortBy}`, sortOrder);
    let data: Kpi[];
    let totalItems: number;
    try {
      [data, totalItems] = await query.skip((page - 1) * limit).take(limit).getManyAndCount();
    } catch (error) {
      if (error.message && error.message.includes('sort_order')) {
        const fallbackQuery = this.kpisRepository.createQueryBuilder('kpi')
          .leftJoinAndSelect('kpi.assignments', 'assignment', 'assignment.deleted_at IS NULL')
          .leftJoin('assignment.department', 'department')
          .addSelect(['department.id', 'department.name', 'department.managerId'])
          .leftJoin('assignment.section', 'section')
          .addSelect(['section.id', 'section.name', 'section.managerId', 'section.departmentId', 'section.created_at', 'section.updated_at'])
          .leftJoinAndSelect('assignment.team', 'team')
          .leftJoinAndSelect('assignment.employee', 'employee')
          .leftJoin('section.department', 'departmentOfSection')
          .addSelect(['departmentOfSection.id', 'departmentOfSection.name', 'departmentOfSection.managerId'])
          .leftJoinAndSelect('kpi.perspective', 'perspective')
          .leftJoinAndSelect('assignment.kpiValues', 'kpiValue')
          .leftJoinAndSelect('kpi.createdBy', 'createdBy')
          .leftJoinAndSelect('kpi.formula', 'formula')
          .where('kpi.deleted_at IS NULL');
        if (!hasViewCompany) {
          const hasDepartmentFilter = hasViewDepartment && loggedInUser.departmentId;
          const hasSectionFilter = hasViewSection && loggedInUser.sectionId;
          if (hasDepartmentFilter || hasSectionFilter) {
            fallbackQuery.andWhere(new Brackets((qb) => {
              qb.where('assignment.id IS NULL');
              if (hasDepartmentFilter) {
                qb.orWhere('assignment.assigned_to_department = :deptId', { deptId: loggedInUser.departmentId })
                  .orWhere('departmentOfSection.id = :deptId', { deptId: loggedInUser.departmentId });
              }
              if (hasSectionFilter) {
                qb.orWhere('assignment.assigned_to_section = :sectionId', { sectionId: loggedInUser.sectionId });
              }
            }));
          } else {
            return { data: [], pagination: { currentPage: page, totalPages: 0, totalItems: 0, itemsPerPage: limit } };
          }
        }
        if (filterDto.name) fallbackQuery.andWhere('kpi.name ILIKE :name', { name: `%${filterDto.name}%` });
        if (filterDto.perspectiveId) fallbackQuery.andWhere('kpi.perspective_id = :perspectiveId', { perspectiveId: filterDto.perspectiveId });
        if (filterDto.departmentId && filterDto.departmentId > 0) fallbackQuery.andWhere('((assignment.assigned_to_department = :departmentId AND assignment.deleted_at IS NULL) OR assignment.id IS NULL)', { departmentId: filterDto.departmentId });
        if (filterDto.sectionId && filterDto.sectionId > 0) fallbackQuery.andWhere('((assignment.assigned_to_section = :sectionId AND assignment.deleted_at IS NULL) OR assignment.id IS NULL)', { sectionId: filterDto.sectionId });
        if (filterDto.teamId && filterDto.teamId > 0) fallbackQuery.andWhere('((assignment.assigned_to_team = :teamId AND assignment.deleted_at IS NULL) OR assignment.id IS NULL)', { teamId: filterDto.teamId });
        if (filterDto.assignedToId && filterDto.assignedToId > 0) fallbackQuery.andWhere('((assignment.assigned_to_employee = :assignedToId AND assignment.deleted_at IS NULL) OR assignment.id IS NULL)', { assignedToId: filterDto.assignedToId });
        if (filterDto.status) fallbackQuery.andWhere('kpi.status = :status', { status: filterDto.status });
        if (filterDto.scope) fallbackQuery.andWhere('kpi.created_by_type = :scope', { scope: filterDto.scope });
        if (filterDto.startDate) fallbackQuery.andWhere('kpi.start_date >= :startDate', { startDate: filterDto.startDate });
        if (filterDto.endDate) fallbackQuery.andWhere('kpi.end_date <= :endDate', { endDate: filterDto.endDate });
        fallbackQuery.distinct(true);
        fallbackQuery.orderBy(`kpi.${sortBy}`, sortOrder);
        [data, totalItems] = await fallbackQuery.skip((page - 1) * limit).take(limit).getManyAndCount();
      } else {
        throw error;
      }
    }
    const dataWithActualValue = data.map((kpi) => {
      const activeAssignments = kpi.assignments.filter((a) => a.deleted_at === null || a.deleted_at === undefined);
      const calculatedValues = this.calculationService.getCalculatedValues(activeAssignments);
      const { employeeValues, sectionValues, departmentValues } = calculatedValues;
      let allValues: number[] = [];
      let allTargets: number[] = [];
      const hasDepartmentAssignments = activeAssignments.some((a) => a.assigned_to_department);
      const hasSectionAssignments = activeAssignments.some((a) => a.assigned_to_section);
      if (hasDepartmentAssignments) {
        departmentValues.forEach((v) => allValues.push(v));
        activeAssignments.filter((a) => a.assigned_to_department && a.targetValue != null).forEach((a) => allTargets.push(Number(a.targetValue) || 0));
      } else if (hasSectionAssignments) {
        sectionValues.forEach((v) => allValues.push(v));
        activeAssignments.filter((a) => a.assigned_to_section && a.targetValue != null).forEach((a) => allTargets.push(Number(a.targetValue) || 0));
      } else {
        employeeValues.forEach((v) => allValues.push(v));
        activeAssignments.filter((a) => a.assigned_to_employee && a.targetValue != null).forEach((a) => allTargets.push(Number(a.targetValue) || 0));
      }
      const actual_value = allValues.length > 0 ? allValues.reduce((sum, val) => sum + val, 0) : 0;
      const validityStatus = getKpiStatus(kpi.start_date, kpi.end_date);
      return { ...kpi, actual_value, validityStatus };
    });
    return { data: dataWithActualValue, pagination: { currentPage: page, totalPages: Math.ceil(totalItems / limit), totalItems, itemsPerPage: limit } };
  }

  /**
   * Get KPIs for a department with RBAC filtering and formula-based actual value calculation.
   */
  async getDepartmentKpis(
    departmentId: number | null,
    filterDto: KpiFilterDto,
    loggedInUser: Employee,
  ): Promise<{
    data: Kpi[];
    pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number };
  }> {
    const { page = 1, limit = 15 } = filterDto;
    const effectiveDepartmentId = departmentId;
    const query = this.kpisRepository
      .createQueryBuilder('kpi')
      .distinct(true)
      .leftJoinAndSelect('kpi.assignments', 'assignment')
      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.team', 'team')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('kpi.formula', 'formula')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue')
      .leftJoinAndSelect('section.department', 'departmentOfSection')
      .where('kpi.deleted_at IS NULL')
      .andWhere('assignment.deleted_at IS NULL');
    if (effectiveDepartmentId !== null && effectiveDepartmentId !== 0) {
      query.andWhere(new Brackets((qb) => {
        qb.where('kpi.created_by_type = :createdTypeDept AND kpi.created_by = :deptId', { createdTypeDept: 'department', deptId: effectiveDepartmentId })
          .orWhere(new Brackets((subQb) => {
            subQb.where('kpi.created_by_type = :createdTypeCompany', { createdTypeCompany: 'company' })
              .andWhere('assignment.assigned_to_department = :deptId', { deptId: effectiveDepartmentId });
          }));
      }));
    } else {
      const hasViewCompany = userHasPermission(loggedInUser, 'view', 'kpi', 'company');
      const hasViewDepartment = userHasPermission(loggedInUser, 'view', 'kpi', 'department');
      const hasViewSection = userHasPermission(loggedInUser, 'view', 'kpi', 'section');
      if (hasViewCompany) {
        query.andWhere(new Brackets((qb) => {
          qb.where('kpi.created_by_type = :createdTypeDept', { createdTypeDept: 'department' })
            .orWhere(new Brackets((subQb) => {
              subQb.where('kpi.created_by_type = :createdTypeCompany', { createdTypeCompany: 'company' })
                .andWhere('assignment.assigned_to_department IS NOT NULL');
            }));
        }));
      } else {
        const hasDepartmentFilter = hasViewDepartment && loggedInUser.departmentId;
        const hasSectionFilter = hasViewSection && loggedInUser.sectionId;
        if (hasDepartmentFilter || hasSectionFilter) {
          query.andWhere(new Brackets((qb) => {
            if (hasDepartmentFilter) {
              qb.where(new Brackets((subQb) => {
                subQb.where('kpi.created_by_type = :createdTypeDept', { createdTypeDept: 'department' })
                  .andWhere('assignment.assigned_to_department = :userDeptId', { userDeptId: loggedInUser.departmentId });
              })).orWhere(new Brackets((subQb) => {
                subQb.where('kpi.created_by_type = :createdTypeCompany', { createdTypeCompany: 'company' })
                  .andWhere('assignment.assigned_to_department = :userDeptId', { userDeptId: loggedInUser.departmentId });
              }));
            }
          }));
        } else {
          return { data: [], pagination: { currentPage: page, totalPages: 0, totalItems: 0, itemsPerPage: limit } };
        }
      }
    }
    if (filterDto.name) query.andWhere('kpi.name ILIKE :name', { name: `%${filterDto.name}%` });
    if (filterDto.perspectiveId) query.andWhere('kpi.perspective_id = :perspectiveId', { perspectiveId: filterDto.perspectiveId });
    if (filterDto.sectionId) query.andWhere('assignment.assigned_to_section = :sectionId', { sectionId: filterDto.sectionId });
    if (filterDto.teamId) query.andWhere('assignment.assigned_to_team = :teamId', { teamId: filterDto.teamId });
    if (filterDto.assignedToId) query.andWhere('assignment.assigned_to_employee = :assignedToId', { assignedToId: filterDto.assignedToId });
    if (filterDto.status) query.andWhere('kpi.status = :status', { status: filterDto.status });
    if (filterDto.startDate) query.andWhere('kpi.start_date >= :startDate', { startDate: filterDto.startDate });
    if (filterDto.endDate) query.andWhere('kpi.end_date <= :endDate', { endDate: filterDto.endDate });
    query.distinct(true);
    const sortBy = ['name', 'created_at'].includes(filterDto.sortBy ?? '') ? filterDto.sortBy! : 'created_at';
    const sortOrder = filterDto.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    query.orderBy(`kpi.${sortBy}`, sortOrder);
    let data: Kpi[];
    let totalItems: number;
    try {
      [data, totalItems] = await query.skip((page - 1) * limit).take(limit).getManyAndCount();
    } catch (error) {
      if (error.message && error.message.includes('sort_order')) {
        const fallbackQuery = this.kpisRepository.createQueryBuilder('kpi').distinct(true)
          .leftJoinAndSelect('kpi.assignments', 'assignment')
          .leftJoin('assignment.section', 'section')
          .addSelect(['section.id', 'section.name', 'section.managerId', 'section.departmentId', 'section.created_at', 'section.updated_at'])
          .leftJoinAndSelect('assignment.team', 'team')
          .leftJoinAndSelect('assignment.employee', 'employee')
          .leftJoinAndSelect('kpi.perspective', 'perspective')
          .leftJoinAndSelect('kpi.formula', 'formula')
          .leftJoinAndSelect('assignment.kpiValues', 'kpiValue')
          .leftJoin('section.department', 'departmentOfSection')
          .addSelect(['departmentOfSection.id', 'departmentOfSection.name', 'departmentOfSection.managerId'])
          .where('kpi.deleted_at IS NULL')
          .andWhere('assignment.deleted_at IS NULL');
        if (effectiveDepartmentId !== null && effectiveDepartmentId !== 0) {
          fallbackQuery.andWhere(new Brackets((qb) => {
            qb.where('kpi.created_by_type = :createdTypeDept AND kpi.created_by = :deptId', { createdTypeDept: 'department', deptId: effectiveDepartmentId })
              .orWhere(new Brackets((subQb) => {
                subQb.where('kpi.created_by_type = :createdTypeCompany', { createdTypeCompany: 'company' })
                  .andWhere('assignment.assigned_to_department = :deptId', { deptId: effectiveDepartmentId });
              }));
          }));
        } else {
          const hasViewCompany = userHasPermission(loggedInUser, 'view', 'kpi', 'company');
          const hasViewDepartment = userHasPermission(loggedInUser, 'view', 'kpi', 'department');
          const hasViewSection = userHasPermission(loggedInUser, 'view', 'kpi', 'section');
          if (hasViewCompany) {
            fallbackQuery.andWhere(new Brackets((qb) => {
              qb.where('kpi.created_by_type = :createdTypeDept', { createdTypeDept: 'department' })
                .orWhere(new Brackets((subQb) => {
                  subQb.where('kpi.created_by_type = :createdTypeCompany', { createdTypeCompany: 'company' })
                    .andWhere('assignment.assigned_to_department IS NOT NULL');
                }));
            }));
          } else {
            const hasDepartmentFilter = hasViewDepartment && loggedInUser.departmentId;
            const hasSectionFilter = hasViewSection && loggedInUser.sectionId;
            if (hasDepartmentFilter || hasSectionFilter) {
              fallbackQuery.andWhere(new Brackets((qb) => {
                if (hasDepartmentFilter) {
                  qb.where(new Brackets((subQb) => {
                    subQb.where('kpi.created_by_type = :createdTypeDept', { createdTypeDept: 'department' })
                      .andWhere('assignment.assigned_to_department = :userDeptId', { userDeptId: loggedInUser.departmentId });
                  })).orWhere(new Brackets((subQb) => {
                    subQb.where('kpi.created_by_type = :createdTypeCompany', { createdTypeCompany: 'company' })
                      .andWhere('assignment.assigned_to_department = :userDeptId', { userDeptId: loggedInUser.departmentId });
                  }));
                }
              }));
            } else {
              return { data: [], pagination: { currentPage: page, totalPages: 0, totalItems: 0, itemsPerPage: limit } };
            }
          }
        }
        if (filterDto.name) fallbackQuery.andWhere('kpi.name ILIKE :name', { name: `%${filterDto.name}%` });
        if (filterDto.perspectiveId) fallbackQuery.andWhere('kpi.perspective_id = :perspectiveId', { perspectiveId: filterDto.perspectiveId });
        if (filterDto.sectionId) fallbackQuery.andWhere('assignment.assigned_to_section = :sectionId', { sectionId: filterDto.sectionId });
        if (filterDto.teamId) fallbackQuery.andWhere('assignment.assigned_to_team = :teamId', { teamId: filterDto.teamId });
        if (filterDto.assignedToId) fallbackQuery.andWhere('assignment.assigned_to_employee = :assignedToId', { assignedToId: filterDto.assignedToId });
        if (filterDto.status) fallbackQuery.andWhere('kpi.status = :status', { status: filterDto.status });
        if (filterDto.startDate) fallbackQuery.andWhere('kpi.start_date >= :startDate', { startDate: filterDto.startDate });
        if (filterDto.endDate) fallbackQuery.andWhere('kpi.end_date <= :endDate', { endDate: filterDto.endDate });
        fallbackQuery.distinct(true);
        fallbackQuery.orderBy(`kpi.${sortBy}`, sortOrder);
        [data, totalItems] = await fallbackQuery.skip((page - 1) * limit).take(limit).getManyAndCount();
      } else {
        throw error;
      }
    }
    const dataWithActualValue = data.map((kpi) => {
      const activeAssignments = kpi.assignments.filter((a) => a.deleted_at === null || a.deleted_at === undefined);
      const calculatedValues = this.calculationService.getCalculatedValues(activeAssignments);
      const { employeeValues, sectionValues, departmentValues } = calculatedValues;
      let allValues: number[] = [];
      let allTargets: number[] = [];
      const hasDepartmentAssignments = activeAssignments.some((a) => a.assigned_to_department);
      const hasSectionAssignments = activeAssignments.some((a) => a.assigned_to_section);
      if (hasDepartmentAssignments && departmentValues.size > 0) {
        departmentValues.forEach((v) => allValues.push(v));
        activeAssignments.filter((a) => a.assigned_to_department && a.targetValue != null).forEach((a) => allTargets.push(Number(a.targetValue) || 0));
      } else if (hasSectionAssignments && sectionValues.size > 0) {
        sectionValues.forEach((v) => allValues.push(v));
        activeAssignments.filter((a) => a.assigned_to_section && a.targetValue != null).forEach((a) => allTargets.push(Number(a.targetValue) || 0));
      } else {
        employeeValues.forEach((v) => allValues.push(v));
        activeAssignments.filter((a) => a.assigned_to_employee && a.targetValue != null).forEach((a) => allTargets.push(Number(a.targetValue) || 0));
      }
      let actual_value = 0;
      if (kpi.formula && kpi.formula.expression) {
        try {
          const scope = { values: allValues, targets: allTargets, target: Number(kpi.target) || 0, weight: Number(kpi.weight) || 0, average: mean };
          const result = evaluate(kpi.formula.expression, scope);
          actual_value = typeof result === 'number' && !isNaN(result) ? parseFloat(result.toFixed(2)) : 0;
        } catch { actual_value = 0; }
      } else {
        actual_value = allValues.length > 0 ? allValues.reduce((sum, val) => sum + val, 0) : 0;
      }
      const validityStatus = getKpiStatus(kpi.start_date, kpi.end_date);
      return { ...kpi, actual_value: actual_value ?? 0, validityStatus };
    });
    return { data: dataWithActualValue, pagination: { currentPage: page, totalPages: Math.ceil(totalItems / limit), totalItems, itemsPerPage: limit } };
  }

  /**
   * Get all KPIs that have department-level assignments (for assignment dropdowns).
   */
  async getAllKpiAssignedToDepartments(userId: number): Promise<Kpi[]> {
    const user = await this.employeeRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions', 'department', 'section'],
    });
    if (!user) return [];
    const hasCompanyAssignPermission = userHasPermission(user, 'assign', 'kpi', 'company');
    const query = this.kpisRepository
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
      .andWhere('kpi.deleted_at IS NULL');
    if (!hasCompanyAssignPermission) {
      if (user.departmentId) {
        query.andWhere(new Brackets((qb) => {
          qb.where('assignment.assigned_to_department = :deptId', { deptId: user.departmentId })
            .orWhere('departmentOfSection.id = :deptId', { deptId: user.departmentId })
            .orWhere('employee.departmentId = :deptId', { deptId: user.departmentId });
        }));
      } else {
        return [];
      }
    }
    return query.getMany();
  }

  /**
   * Get all KPIs that have section-level assignments.
   */
  async getAllKpiAssignedToSections(userId: number): Promise<Kpi[]> {
    try {
      return await this.kpisRepository
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
    } catch (error) {
      if (error.message && error.message.includes('sort_order')) {
        return await this.kpisRepository.createQueryBuilder('kpi')
          .leftJoinAndSelect('kpi.perspective', 'perspective')
          .leftJoinAndSelect('kpi.assignments', 'assignment')
          .leftJoin('assignment.section', 'section')
          .addSelect(['section.id', 'section.name', 'section.managerId', 'section.departmentId', 'section.created_at', 'section.updated_at'])
          .leftJoinAndSelect('assignment.employee', 'employee')
          .leftJoin('assignment.department', 'department')
          .addSelect(['department.id', 'department.name', 'department.managerId'])
          .leftJoinAndSelect('assignment.team', 'team')
          .leftJoinAndSelect('assignment.kpiValues', 'kpiValues')
          .leftJoin('section.department', 'departmentOfSection')
          .addSelect(['departmentOfSection.id', 'departmentOfSection.name', 'departmentOfSection.managerId'])
          .where('assignment.assigned_to_section IS NOT NULL')
          .andWhere('assignment.deleted_at IS NULL')
          .andWhere('kpi.deleted_at IS NULL')
          .getMany();
      }
      throw error;
    }
  }

  /**
   * Get KPI comparison data (target vs actual) grouped by department.
   */
  async getKpiComparisonData(userId: number): Promise<{ data: any[] }> {
    const kpis = await this.kpisRepository.find({
      where: {},
      relations: ['assignments', 'assignments.department', 'assignments.kpiValues', 'formula'],
    });
    const result: any[] = [];
    for (const kpi of kpis) {
      const departmentAssignment = (kpi.assignments || []).find((a) => a.department && a.department.name);
      const departmentName = departmentAssignment?.department?.name || 'N/A';
      const activeAssignments = (kpi.assignments || []).filter((a) => !a.deleted_at);
      const allValues = activeAssignments.flatMap((a) => a.kpiValues || []).map((v) => Number(v.value) || 0);
      const actual_value = allValues.length > 0 ? allValues.reduce((sum, val) => sum + val, 0) : 0;
      result.push({ department_name: departmentName, kpi_name: kpi.name, target: kpi.target, actual_value });
    }
    return { data: result };
  }

  /**
   * Get KPIs for a section with RBAC filtering and batch-calculated section actual values.
   */
  async getSectionKpis(
    sectionIdParam: number | string,
    filterDto: KpiFilterDto,
    loggedInUser: Employee,
  ): Promise<{
    data: KpiWithSectionActuals[];
    pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number };
  }> {
    if (!loggedInUser.roles || !Array.isArray(loggedInUser.roles) || loggedInUser.roles.some((role: any) => !role.permissions)) {
      const userWithRoles = await this.employeeRepository.findOne({
        where: { id: loggedInUser.id },
        relations: ['roles', 'roles.permissions'],
      });
      if (userWithRoles) loggedInUser.roles = userWithRoles.roles;
    }
    const { page = 1, limit = 15 } = filterDto;
    let effectiveSectionId: number | null = Number(sectionIdParam);
    const effectiveDepartmentId: number | null = filterDto.departmentId ?? null;
    const query = this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.assignments', 'assignment')
      .leftJoinAndSelect('assignment.department', 'department')
      .leftJoinAndSelect('assignment.section', 'section')
      .leftJoinAndSelect('assignment.team', 'team')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('section.department', 'departmentOfSection')
      .leftJoinAndSelect('employee.section', 'employeeSection')
      .leftJoinAndSelect('employeeSection.department', 'departmentOfEmployeeSection')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('kpi.formula', 'formula')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue')
      .where('kpi.deleted_at IS NULL')
      .andWhere('assignment.deleted_at IS NULL');
    if (effectiveDepartmentId !== null && effectiveDepartmentId !== 0) {
      query.andWhere(new Brackets((qb) => {
        qb.where('departmentOfSection.id = :deptId', { deptId: effectiveDepartmentId })
          .orWhere('departmentOfEmployeeSection.id = :deptId', { deptId: effectiveDepartmentId });
      }));
    }
    if (effectiveSectionId !== null && effectiveSectionId !== 0) {
      query.andWhere(new Brackets((qb) => {
        qb.where(new Brackets((subQb) => {
          subQb.where('kpi.created_by_type = :createdTypeSection', { createdTypeSection: 'section' })
            .andWhere('assignment.assigned_to_section = :sectionCreatorId', { sectionCreatorId: effectiveSectionId });
        })).orWhere(new Brackets((subQb) => {
          subQb.where('kpi.created_by_type = :createdTypeCompany', { createdTypeCompany: 'company' })
            .andWhere('assignment.assigned_to_section = :sid', { sid: effectiveSectionId });
        })).orWhere(new Brackets((subQb) => {
          subQb.where('kpi.created_by_type = :createdTypeDepartment', { createdTypeDepartment: 'department' })
            .andWhere('assignment.assigned_to_section = :sid', { sid: effectiveSectionId });
        }));
      }));
    } else {
      const hasCompanyAssignPermission = userHasPermission(loggedInUser, 'assign', 'kpi', 'company');
      if (!hasCompanyAssignPermission) {
        const hasAnyViewPermission = ['company', 'department', 'section', 'manager', 'admin'].some((scope) =>
          userHasPermission(loggedInUser, 'view', 'kpi', scope)
        );
        if (hasAnyViewPermission) {
          effectiveSectionId = loggedInUser.sectionId;
          if (effectiveSectionId) {
            query.andWhere(new Brackets((qb) => {
              qb.where(new Brackets((subQb) => {
                subQb.where('kpi.created_by_type = :createdTypeSection', { createdTypeSection: 'section' })
                  .andWhere('assignment.assigned_to_section = :sectionCreatorId', { sectionCreatorId: effectiveSectionId });
              })).orWhere(new Brackets((subQb) => {
                subQb.where('kpi.created_by_type = :createdTypeCompany', { createdTypeCompany: 'company' })
                  .andWhere('assignment.assigned_to_section = :sid', { sid: effectiveSectionId });
              })).orWhere(new Brackets((subQb) => {
                subQb.where('kpi.created_by_type = :createdTypeDepartment', { createdTypeDepartment: 'department' })
                  .andWhere('assignment.assigned_to_section = :sid', { sid: effectiveSectionId });
              }));
            }));
          } else {
            return { data: [], pagination: { currentPage: page, totalPages: 0, totalItems: 0, itemsPerPage: limit } };
          }
        } else {
          return { data: [], pagination: { currentPage: page, totalPages: 0, totalItems: 0, itemsPerPage: limit } };
        }
      } else {
        if (userHasPermission(loggedInUser, 'view', 'kpi', 'company') || userHasPermission(loggedInUser, 'view', 'kpi', 'department') || userHasPermission(loggedInUser, 'view', 'kpi', 'section')) {
          query.andWhere(new Brackets((qb) => {
            qb.where('kpi.created_by_type = :createdTypeSection', { createdTypeSection: 'section' })
              .orWhere(new Brackets((subQb) => {
                subQb.where('kpi.created_by_type = :createdTypeCompany', { createdTypeCompany: 'company' })
                  .andWhere('assignment.assigned_to_section IS NOT NULL');
              }))
              .orWhere(new Brackets((subQb) => {
                subQb.where('kpi.created_by_type = :createdTypeDepartment', { createdTypeDepartment: 'department' })
                  .andWhere('assignment.assigned_to_section IS NOT NULL');
              }));
          }));
        } else {
          return { data: [], pagination: { currentPage: page, totalPages: 0, totalItems: 0, itemsPerPage: limit } };
        }
      }
    }
    if (filterDto.name) query.andWhere('kpi.name ILIKE :name', { name: `%${filterDto.name}%` });
    if (filterDto.perspectiveId) query.andWhere('kpi.perspective_id = :perspective_id', { perspective_id: filterDto.perspectiveId });
    if (filterDto.teamId) query.andWhere('assignment.assigned_to_team = :teamId', { teamId: filterDto.teamId });
    if (filterDto.status) query.andWhere('kpi.status = :status', { status: filterDto.status });
    if (filterDto.startDate) query.andWhere('kpi.start_date >= :startDate', { startDate: filterDto.startDate });
    if (filterDto.endDate) query.andWhere('kpi.end_date <= :endDate', { endDate: filterDto.endDate });
    query.distinct(true);
    const sortBy = ['name', 'created_at'].includes(filterDto.sortBy ?? '') ? filterDto.sortBy! : 'created_at';
    const sortOrder = filterDto.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    query.orderBy(`kpi.${sortBy}`, sortOrder);
    let data: Kpi[];
    let totalItems: number;
    try {
      [data, totalItems] = await query.skip((page - 1) * limit).take(limit).getManyAndCount();
    } catch (error) {
      if (error.message && error.message.includes('sort_order')) {
        const fallbackQuery = this.kpisRepository.createQueryBuilder('kpi')
          .leftJoinAndSelect('kpi.assignments', 'assignment')
          .leftJoin('assignment.department', 'department')
          .addSelect(['department.id', 'department.name', 'department.managerId'])
          .leftJoin('assignment.section', 'section')
          .addSelect(['section.id', 'section.name', 'section.managerId', 'section.departmentId', 'section.created_at', 'section.updated_at'])
          .leftJoinAndSelect('assignment.team', 'team')
          .leftJoinAndSelect('assignment.employee', 'employee')
          .leftJoin('section.department', 'departmentOfSection')
          .addSelect(['departmentOfSection.id', 'departmentOfSection.name', 'departmentOfSection.managerId'])
          .leftJoin('employee.section', 'employeeSection')
          .addSelect(['employeeSection.id', 'employeeSection.name', 'employeeSection.managerId', 'employeeSection.departmentId'])
          .leftJoin('employeeSection.department', 'departmentOfEmployeeSection')
          .addSelect(['departmentOfEmployeeSection.id', 'departmentOfEmployeeSection.name', 'departmentOfEmployeeSection.managerId'])
          .leftJoinAndSelect('kpi.perspective', 'perspective')
          .leftJoinAndSelect('kpi.formula', 'formula')
          .leftJoinAndSelect('assignment.kpiValues', 'kpiValue')
          .where('kpi.deleted_at IS NULL')
          .andWhere('assignment.deleted_at IS NULL');
        if (effectiveDepartmentId !== null && effectiveDepartmentId !== 0) {
          fallbackQuery.andWhere(new Brackets((qb) => {
            qb.where('departmentOfSection.id = :deptId', { deptId: effectiveDepartmentId })
              .orWhere('departmentOfEmployeeSection.id = :deptId', { deptId: effectiveDepartmentId });
          }));
        }
        if (effectiveSectionId !== null && effectiveSectionId !== 0) {
          fallbackQuery.andWhere(new Brackets((qb) => {
            qb.where(new Brackets((subQb) => {
              subQb.where('kpi.created_by_type = :createdTypeSection', { createdTypeSection: 'section' })
                .andWhere('kpi.created_by = :sectionCreatorId', { sectionCreatorId: effectiveSectionId });
            })).orWhere(new Brackets((subQb) => {
              subQb.where('kpi.created_by_type = :createdTypeCompany', { createdTypeCompany: 'company' })
                .andWhere('assignment.assigned_to_section = :sid', { sid: effectiveSectionId });
            })).orWhere(new Brackets((subQb) => {
              subQb.where('kpi.created_by_type = :createdTypeDepartment', { createdTypeDepartment: 'department' })
                .andWhere('assignment.assigned_to_section = :sid', { sid: effectiveSectionId });
            }));
          }));
        }
        if (filterDto.name) fallbackQuery.andWhere('kpi.name ILIKE :name', { name: `%${filterDto.name}%` });
        if (filterDto.perspectiveId) fallbackQuery.andWhere('kpi.perspective_id = :perspectiveId', { perspectiveId: filterDto.perspectiveId });
        if (filterDto.teamId) fallbackQuery.andWhere('assignment.assigned_to_team = :teamId', { teamId: filterDto.teamId });
        if (filterDto.status) fallbackQuery.andWhere('kpi.status = :status', { status: filterDto.status });
        if (filterDto.startDate) fallbackQuery.andWhere('kpi.start_date >= :startDate', { startDate: filterDto.startDate });
        if (filterDto.endDate) fallbackQuery.andWhere('kpi.end_date <= :endDate', { endDate: filterDto.endDate });
        fallbackQuery.distinct(true);
        fallbackQuery.orderBy(`kpi.${sortBy}`, sortOrder);
        [data, totalItems] = await fallbackQuery.skip((page - 1) * limit).take(limit).getManyAndCount();
      } else {
        throw error;
      }
    }
    const kpiSectionPairs: Array<{ kpiId: number; sectionId: number }> = [];
    data.forEach((kpi) => {
      if (kpi.assignments) {
        const sectionIds = new Set<number>();
        kpi.assignments.forEach((a) => {
          if (a.assigned_to_section != null && a.deleted_at === null) sectionIds.add(a.assigned_to_section);
        });
        kpi.assignments.forEach((a) => {
          if (a.assigned_to_employee && a.employee?.sectionId && a.deleted_at === null) sectionIds.add(a.employee.sectionId);
        });
        if (effectiveSectionId !== null && effectiveSectionId !== 0) {
          sectionIds.forEach((id) => { if (id !== effectiveSectionId) sectionIds.delete(id); });
        }
        sectionIds.forEach((sectionId) => kpiSectionPairs.push({ kpiId: kpi.id, sectionId }));
      }
    });
    const actualValuesMap = await this.calculationService.batchCalculateSectionActualValues(kpiSectionPairs);
    const dataWithSectionActuals = data.map((kpi) => {
      const actuals_by_section_id: { [sectionId: number]: number | null } = {};
      if (kpi.assignments) {
        const sectionIds = new Set<number>();
        kpi.assignments.forEach((a) => {
          if (a.assigned_to_section != null && a.deleted_at === null) sectionIds.add(a.assigned_to_section);
        });
        kpi.assignments.forEach((a) => {
          if (a.assigned_to_employee && a.employee?.sectionId && a.deleted_at === null) sectionIds.add(a.employee.sectionId);
        });
        if (effectiveSectionId !== null && effectiveSectionId !== 0) {
          sectionIds.forEach((id) => { if (id !== effectiveSectionId) sectionIds.delete(id); });
        }
        sectionIds.forEach((sectionId) => {
          actuals_by_section_id[sectionId] = actualValuesMap.get(`${kpi.id}-${sectionId}`) ?? 0;
        });
      }
      const validityStatus = getKpiStatus(kpi.start_date, kpi.end_date);
      return { ...kpi, actuals_by_section_id, validityStatus };
    });
    return { data: dataWithSectionActuals, pagination: { currentPage: page, totalPages: Math.ceil(totalItems / limit), totalItems, itemsPerPage: limit } };
  }

  /**
   * Get current user's KPI assignments with review scores (all statuses).
   */
  async getMyAssignments(
    userId: number,
    filterDto: KpiFilterDto,
    cycle?: string,
  ): Promise<{
    data: Kpi[];
    pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number };
  }> {
    const { page = 1, limit = 15 } = filterDto;
    const query = this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.assignments', 'assignment')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue')
      .andWhere('assignment.assigned_to_employee = :userId', { userId })
      .andWhere('assignment.deleted_at IS NULL');
    if (filterDto.name) query.andWhere('kpi.name ILIKE :name', { name: `%${filterDto.name}%` });
    if (filterDto.perspectiveId) query.andWhere('kpi.perspective_id = :perspectiveId', { perspectiveId: filterDto.perspectiveId });
    if (filterDto.status) query.andWhere('kpi.status = :status', { status: filterDto.status });
    if (filterDto.startDate) query.andWhere('kpi.start_date >= :startDate', { startDate: filterDto.startDate });
    if (filterDto.endDate) query.andWhere('kpi.end_date <= :endDate', { endDate: filterDto.endDate });
    const sortBy = ['name', 'created_at'].includes(filterDto.sortBy ?? '') ? filterDto.sortBy! : 'created_at';
    const sortOrder = filterDto.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    query.orderBy(`kpi.${sortBy}`, sortOrder);
    const [data, totalItems] = await query.skip((page - 1) * limit).take(limit).getManyAndCount();
    let reviewsMap = new Map<number, { managerScore: number | null; score: number | null; selfScore: number | null; weightSelftScore: number | null; sectionComment: string | null; departmentComment: string | null; managerComment: string | null }>();
    if (cycle) {
      const reviews = await this.kpiReviewRepository.createQueryBuilder('review')
        .leftJoinAndSelect('review.kpi', 'kpi')
        .leftJoinAndSelect('review.employee', 'employee')
        .where('employee.id = :userId', { userId })
        .andWhere('review.cycle = :cycle', { cycle })
        .getMany();
      const byKpi = new Map<
        number,
        { mid?: KpiReview; yearEnd?: KpiReview }
      >();
      for (const review of reviews) {
        const kid = review.kpi?.id;
        if (!kid) continue;
        const g = byKpi.get(kid) ?? {};
        if (review.evaluationPhase === EvaluationPhase.MID_YEAR) {
          g.mid = review;
        } else if (review.evaluationPhase === EvaluationPhase.YEAR_END) {
          g.yearEnd = review;
        }
        byKpi.set(kid, g);
      }
      for (const [kpiId, { mid, yearEnd }] of byKpi) {
        const active = pickActiveReview(mid ?? null, yearEnd ?? null);
        const kpiRef = mid?.kpi ?? yearEnd?.kpi;
        const managerScore = effectiveManagerScoreForReporting(
          mid ?? null,
          yearEnd ?? null,
        );
        const score =
          managerScore !== null && kpiRef?.weight != null
            ? managerScore * kpiRef.weight
            : null;
        const selfScore = active?.selfScore ?? 0;
        const weightSelftScore =
          selfScore !== null && kpiRef?.weight != null
            ? selfScore * kpiRef.weight
            : null;
        reviewsMap.set(kpiId, {
          managerScore,
          score,
          selfScore,
          weightSelftScore,
          sectionComment: active?.sectionComment ?? null,
          departmentComment: active?.departmentComment ?? null,
          managerComment: active?.managerComment ?? null,
        });
      }
    }
    const dataWithValidityStatus = data.map((kpi) => {
      const validityStatus = getKpiStatus(kpi.start_date, kpi.end_date);
      const reviewData = reviewsMap.get(kpi.id);
      return {
        ...kpi, validityStatus,
        managerScore: reviewData?.managerScore ?? null,
        score: reviewData?.score ?? null,
        selfScore: reviewData?.selfScore ?? null,
        weightSelftScore: reviewData?.weightSelftScore ?? null,
        sectionComment: reviewData?.sectionComment ?? null,
        departmentComment: reviewData?.departmentComment ?? null,
        managerComment: reviewData?.managerComment ?? null,
      };
    });
    return { data: dataWithValidityStatus, pagination: { currentPage: page, totalPages: Math.ceil(totalItems / limit), totalItems, itemsPerPage: limit } };
  }

  /**
   * Get KPIs assigned to a specific employee with review scores and validity status.
   */
  async getEmployeeKpis(
    employeeId: number,
    filterDto: KpiFilterDto,
    userId: number,
    cycle?: string,
  ): Promise<{
    data: Kpi[];
    pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number };
    summary?: { totalWeightScore: number; averageScore: number };
  }> {
    const { page = 1, limit = 15 } = filterDto;
    const query = this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.assignments', 'assignment')
      .leftJoinAndSelect('assignment.employee', 'employee')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('assignment.kpiValues', 'kpiValue')
      .andWhere('assignment.assigned_to_employee = :employeeId', { employeeId })
      .andWhere('assignment.deleted_at IS NULL');
    if (filterDto.name) query.andWhere('kpi.name ILIKE :name', { name: `%${filterDto.name}%` });
    if (filterDto.perspectiveId) query.andWhere('kpi.perspective_id = :perspectiveId', { perspectiveId: filterDto.perspectiveId });
    if (filterDto.status) query.andWhere('kpi.status = :status', { status: filterDto.status });
    if (filterDto.startDate) query.andWhere('kpi.start_date >= :startDate', { startDate: filterDto.startDate });
    if (filterDto.endDate) query.andWhere('kpi.end_date <= :endDate', { endDate: filterDto.endDate });
    const sortBy = ['name', 'created_at'].includes(filterDto.sortBy ?? '') ? filterDto.sortBy! : 'created_at';
    const sortOrder = filterDto.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    query.orderBy(`kpi.${sortBy}`, sortOrder);
    const [data, totalItems] = await query.skip((page - 1) * limit).take(limit).getManyAndCount();
    let reviewsMap = new Map<number, { managerScore: number | null; score: number | null; selfScore: number | null; weightSelftScore: number | null; sectionComment: string | null; departmentComment: string | null; managerComment: string | null }>();
    if (cycle) {
      const reviews = await this.kpiReviewRepository.createQueryBuilder('review')
        .leftJoinAndSelect('review.kpi', 'kpi')
        .leftJoinAndSelect('review.employee', 'employee')
        .where('employee.id = :employeeId', { employeeId })
        .andWhere('review.cycle = :cycle', { cycle })
        .getMany();
      const byKpiEmp = new Map<
        number,
        { mid?: KpiReview; yearEnd?: KpiReview }
      >();
      for (const review of reviews) {
        const kid = review.kpi?.id;
        if (!kid) continue;
        const g = byKpiEmp.get(kid) ?? {};
        if (review.evaluationPhase === EvaluationPhase.MID_YEAR) {
          g.mid = review;
        } else if (review.evaluationPhase === EvaluationPhase.YEAR_END) {
          g.yearEnd = review;
        }
        byKpiEmp.set(kid, g);
      }
      for (const [kpiId, { mid, yearEnd }] of byKpiEmp) {
        const active = pickActiveReview(mid ?? null, yearEnd ?? null);
        const kpiRef = mid?.kpi ?? yearEnd?.kpi;
        const managerScore = effectiveManagerScoreForReporting(
          mid ?? null,
          yearEnd ?? null,
        );
        const score =
          managerScore !== null && kpiRef?.weight != null
            ? managerScore * kpiRef.weight
            : null;
        const selfScore = active?.selfScore ?? 0;
        const weightSelftScore =
          selfScore !== null && kpiRef?.weight != null
            ? selfScore * kpiRef.weight
            : null;
        reviewsMap.set(kpiId, {
          managerScore,
          score,
          selfScore,
          weightSelftScore,
          sectionComment: active?.sectionComment ?? null,
          departmentComment: active?.departmentComment ?? null,
          managerComment: active?.managerComment ?? null,
        });
      }
    }
    const dataWithValidityStatus = data.map((kpi) => {
      const validityStatus = getKpiStatus(kpi.start_date, kpi.end_date);
      const reviewData = reviewsMap.get(kpi.id);
      return {
        ...kpi, validityStatus,
        managerScore: reviewData?.managerScore ?? null,
        score: reviewData?.score ?? null,
        selfScore: reviewData?.selfScore ?? null,
        weightSelftScore: reviewData?.weightSelftScore ?? null,
        sectionComment: reviewData?.sectionComment ?? null,
        departmentComment: reviewData?.departmentComment ?? null,
        managerComment: reviewData?.managerComment ?? null,
      };
    });
    let summary: { totalWeightScore: number; averageScore: number } | undefined;
    if (cycle) {
      const reviewCycleRepo = this.dataSource.getRepository(ReviewCycle);
      const reviewCycle = await reviewCycleRepo.findOne({ where: { id: parseInt(cycle, 10) } });
      const cycleStart = reviewCycle?.startDate ? new Date(reviewCycle.startDate).getTime() : null;
      const cycleEnd = reviewCycle?.endDate ? new Date(reviewCycle.endDate).getTime() : null;
      const valueRepo = this.dataSource.getRepository(KpiValue);
      const approvedValues = await valueRepo.find({
        where: { status: KpiValueStatus.APPROVED },
        relations: ['kpiAssignment', 'kpiAssignment.kpi'],
      });
      const approvedKpiIds = new Set<number>();
      for (const v of approvedValues) {
        const a = v.kpiAssignment;
        if (!a || (a.assigned_to_employee ?? (a as any).employee_id) !== employeeId) continue;
        if (cycleStart != null && cycleEnd != null && a.kpi) {
          const kpiStart = new Date(a.kpi.start_date || 0).getTime();
          const kpiEnd = new Date(a.kpi.end_date || 0).getTime();
          if (kpiStart > cycleEnd || kpiEnd < cycleStart) continue;
        }
        approvedKpiIds.add(a.kpi_id);
      }
      const allReviews = await this.kpiReviewRepository.createQueryBuilder('review')
        .leftJoinAndSelect('review.kpi', 'kpi')
        .leftJoinAndSelect('review.employee', 'employee')
        .where('employee.id = :employeeId', { employeeId })
        .andWhere('review.cycle = :cycle', { cycle })
        .getMany();
      let totalWeightScore = 0;
      let totalWeight = 0;
      const summaryByKpi = new Map<
        number,
        { mid?: KpiReview; yearEnd?: KpiReview }
      >();
      for (const review of allReviews) {
        const kpiId = review.kpi?.id;
        if (kpiId == null) continue;
        const g = summaryByKpi.get(kpiId) ?? {};
        if (review.evaluationPhase === EvaluationPhase.MID_YEAR) {
          g.mid = review;
        } else if (review.evaluationPhase === EvaluationPhase.YEAR_END) {
          g.yearEnd = review;
        }
        summaryByKpi.set(kpiId, g);
      }
      for (const [kpiId, { mid, yearEnd }] of summaryByKpi) {
        if (!approvedKpiIds.has(kpiId)) continue;
        const w = mid?.kpi?.weight ?? yearEnd?.kpi?.weight;
        if (w == null) continue;
        const eff = effectiveManagerScoreForReporting(
          mid ?? null,
          yearEnd ?? null,
        );
        if (eff != null && eff !== undefined) {
          totalWeightScore += Number(eff) * Number(w);
        }
        totalWeight += Number(w);
      }
      summary = {
        totalWeightScore: parseFloat(totalWeightScore.toFixed(2)),
        averageScore: totalWeight > 0 ? parseFloat((totalWeightScore / totalWeight).toFixed(2)) : 0,
      };
    }
    return { data: dataWithValidityStatus, pagination: { currentPage: page, totalPages: Math.ceil(totalItems / limit), totalItems, itemsPerPage: limit }, summary };
  }

  /**
   * Get all assignments for a KPI with latest actual values and processed details.
   */
  async getKpiAssignments(kpiId: number, userId: number): Promise<KPIAssignment[]> {
    const assignments = await this.kpiAssignmentRepository.find({
      where: { kpi_id: kpiId, deleted_at: IsNull() },
      withDeleted: true,
      relations: ['kpi', 'department', 'section', 'section.department', 'team', 'employee', 'employee.section', 'employee.section.department', 'kpiValues'],
      order: { employee: { first_name: 'ASC', last_name: 'ASC' } },
    });
    const calculatedValues = this.calculationService.getCalculatedValues(assignments);
    const { employeeValues, sectionValues, departmentValues } = calculatedValues;
    const getLatestMetaFromValues = (values?: KpiValue[] | null): { status: string | null; timestamp: Date | null } => {
      if (!values || values.length === 0) return { status: null, timestamp: null };
      let best: KpiValue | null = null;
      let bestMs = -Infinity;
      for (const v of values) {
        const ms = new Date(v.updated_at || v.timestamp).getTime();
        if (ms > bestMs) { bestMs = ms; best = v; }
      }
      return { status: best?.status ?? null, timestamp: best?.timestamp ?? null };
    };
    const aggregateStatuses = (statuses: Iterable<string | null | undefined>): string | null => {
      let any = false, allApproved = true;
      let hasRejectedByManager = false, hasRejectedByDept = false, hasRejectedBySection = false;
      let hasPendingManager = false, hasPendingDept = false, hasPendingSection = false;
      let hasSubmitted = false, hasResubmitted = false;
      for (const s of statuses) {
        if (!s) continue;
        any = true;
        if (s !== KpiValueStatus.APPROVED) allApproved = false;
        if (s === KpiValueStatus.REJECTED_BY_MANAGER) hasRejectedByManager = true;
        else if (s === KpiValueStatus.REJECTED_BY_DEPT) hasRejectedByDept = true;
        else if (s === KpiValueStatus.REJECTED_BY_SECTION) hasRejectedBySection = true;
        else if (s === KpiValueStatus.PENDING_MANAGER_APPROVAL) hasPendingManager = true;
        else if (s === KpiValueStatus.PENDING_DEPT_APPROVAL) hasPendingDept = true;
        else if (s === KpiValueStatus.PENDING_SECTION_APPROVAL) hasPendingSection = true;
        else if (s === KpiValueStatus.SUBMITTED) hasSubmitted = true;
        else if (s === KpiValueStatus.RESUBMITTED) hasResubmitted = true;
      }
      if (!any) return null;
      if (hasRejectedByManager) return KpiValueStatus.REJECTED_BY_MANAGER;
      if (hasRejectedByDept) return KpiValueStatus.REJECTED_BY_DEPT;
      if (hasRejectedBySection) return KpiValueStatus.REJECTED_BY_SECTION;
      if (allApproved) return KpiValueStatus.APPROVED;
      if (hasPendingManager) return KpiValueStatus.PENDING_MANAGER_APPROVAL;
      if (hasPendingDept) return KpiValueStatus.PENDING_DEPT_APPROVAL;
      if (hasPendingSection) return KpiValueStatus.PENDING_SECTION_APPROVAL;
      if (hasSubmitted) return KpiValueStatus.SUBMITTED;
      if (hasResubmitted) return KpiValueStatus.RESUBMITTED;
      return KpiValueStatus.DRAFT;
    };
    const employeeAssignments = assignments.filter((a) => a.assigned_to_employee && !a.deleted_at);
    const latestStatusByEmployeeAssignmentId = new Map<number, string | null>();
    const latestTimestampByEmployeeAssignmentId = new Map<number, Date | null>();
    for (const a of employeeAssignments) {
      const meta = getLatestMetaFromValues(a.kpiValues);
      latestStatusByEmployeeAssignmentId.set(a.id, meta.status);
      latestTimestampByEmployeeAssignmentId.set(a.id, meta.timestamp);
    }
    const employeesBySectionId = new Map<number, KPIAssignment[]>();
    const employeesByDepartmentId = new Map<number, KPIAssignment[]>();
    const employeesByTeamId = new Map<number, KPIAssignment[]>();
    const teamValues = new Map<number, number>();
    const teamHasEmployees = new Set<number>();
    for (const a of employeeAssignments) {
      if (a.employee?.sectionId != null) {
        if (!employeesBySectionId.has(a.employee.sectionId)) employeesBySectionId.set(a.employee.sectionId, []);
        employeesBySectionId.get(a.employee.sectionId)!.push(a);
      }
      const deptId = a.employee?.departmentId ?? a.employee?.section?.department?.id ?? null;
      if (deptId != null) {
        if (!employeesByDepartmentId.has(deptId)) employeesByDepartmentId.set(deptId, []);
        employeesByDepartmentId.get(deptId)!.push(a);
      }
      if (a.employee?.teamId != null) {
        if (!employeesByTeamId.has(a.employee.teamId)) employeesByTeamId.set(a.employee.teamId, []);
        employeesByTeamId.get(a.employee.teamId)!.push(a);
        teamHasEmployees.add(a.employee.teamId);
        const empId = a.assigned_to_employee!;
        if (employeeValues.has(empId)) {
          teamValues.set(a.employee.teamId, (teamValues.get(a.employee.teamId) ?? 0) + employeeValues.get(empId)!);
        }
      }
    }
    for (const teamId of teamHasEmployees) {
      if (!teamValues.has(teamId)) teamValues.set(teamId, 0);
    }
    const sectionAggregatedStatusById = new Map<number, string | null>();
    employeesBySectionId.forEach((emps, sectionId) => {
      sectionAggregatedStatusById.set(sectionId, aggregateStatuses(emps.map((e) => latestStatusByEmployeeAssignmentId.get(e.id))));
    });
    const departmentAggregatedStatusById = new Map<number, string | null>();
    employeesByDepartmentId.forEach((emps, deptId) => {
      departmentAggregatedStatusById.set(deptId, aggregateStatuses(emps.map((e) => latestStatusByEmployeeAssignmentId.get(e.id))));
    });
    const teamAggregatedStatusById = new Map<number, string | null>();
    employeesByTeamId.forEach((emps, teamId) => {
      teamAggregatedStatusById.set(teamId, aggregateStatuses(emps.map((e) => latestStatusByEmployeeAssignmentId.get(e.id))));
    });
    const processedAssignments = assignments.map((assignment) => {
      let latestValue: number | null = null;
      let latestTimestamp: Date | null = null;
      let latestStatus: string | null = null;
      let calculatedActualValue: number | null = null;
      if (assignment.assigned_to_employee) {
        calculatedActualValue = employeeValues.get(assignment.assigned_to_employee) ?? null;
      } else if (assignment.assigned_to_team) {
        calculatedActualValue = teamValues.get(assignment.assigned_to_team) ?? null;
      } else if (assignment.assigned_to_section) {
        calculatedActualValue = sectionValues.get(assignment.assigned_to_section) ?? null;
      } else if (assignment.assigned_to_department) {
        calculatedActualValue = departmentValues.get(assignment.assigned_to_department) ?? null;
      }
      latestValue = calculatedActualValue;
      if (assignment.assigned_to_employee) {
        latestStatus = latestStatusByEmployeeAssignmentId.get(assignment.id) ?? null;
        latestTimestamp = latestTimestampByEmployeeAssignmentId.get(assignment.id) ?? null;
      } else if (assignment.assigned_to_department) {
        latestStatus = departmentAggregatedStatusById.get(assignment.assigned_to_department) ?? null;
        latestTimestamp = getLatestMetaFromValues(assignment.kpiValues).timestamp;
      } else if (assignment.assigned_to_section) {
        latestStatus = sectionAggregatedStatusById.get(assignment.assigned_to_section) ?? null;
        latestTimestamp = getLatestMetaFromValues(assignment.kpiValues).timestamp;
      } else if (assignment.assigned_to_team) {
        latestStatus = teamAggregatedStatusById.get(assignment.assigned_to_team) ?? null;
        latestTimestamp = getLatestMetaFromValues(assignment.kpiValues).timestamp;
      }
      return {
        ...assignment,
        latest_actual_value: latestValue,
        latest_value_timestamp: latestTimestamp,
        latest_value_status: latestStatus,
        startDate: assignment.startDate ? new Date(assignment.startDate) : null,
        endDate: assignment.endDate ? new Date(assignment.endDate) : null,
      } as AssignmentWithLatestValue;
    });
    return processedAssignments;
  }
}
