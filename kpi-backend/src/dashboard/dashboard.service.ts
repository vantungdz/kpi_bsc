import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { Employee } from '../employees/entities/employee.entity';
import { KpiValueHistory } from '../kpi-values/entities/kpi-value-history.entity';
import { KpiValue, KpiValueStatus } from '../kpi-values/entities/kpi-value.entity';
import { Kpi } from '../kpis/entities/kpi.entity';
import { KPIAssignment } from '../kpi-assessments/entities/kpi-assignment.entity';
import {
  KpiInventoryDto,
  KpiPerformanceOverviewDto,
  PerformanceByRoleDto,
} from './dto/dashboard.dto';

@Injectable()
export class DashboardsService {
  private readonly logger = new Logger(DashboardsService.name);

  constructor(
    @InjectRepository(KpiValue)
    private readonly kpiValuesRepository: Repository<KpiValue>,
    @InjectRepository(KpiValueHistory)
    private readonly kpiValueHistoryRepository: Repository<KpiValueHistory>,
    @InjectRepository(Kpi)
    private readonly kpisRepository: Repository<Kpi>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(KPIAssignment)
    private readonly kpiAssignmentRepository: Repository<KPIAssignment>,
  ) {}

  async getKpiAwaitingApprovalStats(currentUser: Employee): Promise<{
    total: number;
    byLevel: { name: string; count: number; status: KpiValueStatus }[];
  }> {
    this.logger.debug(
      `[getKpiAwaitingApprovalStats] Called by user: ${currentUser.id} with roles: ${Array.isArray(currentUser.roles) ? currentUser.roles.map((r) => (typeof r === 'string' ? r : r?.name)).join(',') : ''}`,
    );

    const query = this.kpiValuesRepository
      .createQueryBuilder('kpiValue')
      .innerJoin('kpiValue.kpiAssignment', 'assignment')
      .leftJoin('assignment.employee', 'assignedEmployee')
      .leftJoin('assignment.section', 'assignedSection')
      .leftJoin('assignedSection.department', 'departmentOfAssignedSection')
      .where('kpiValue.status IN (:...statuses)', {
        statuses: [
          KpiValueStatus.PENDING_SECTION_APPROVAL,
          KpiValueStatus.PENDING_DEPT_APPROVAL,
          KpiValueStatus.PENDING_MANAGER_APPROVAL,
        ],
      });

    const canProceed = this.applyRoleBasedFilters(query, currentUser, {
      assignmentAlias: 'assignment',
      assignedEmployeeAlias: 'assignedEmployee',
      departmentOfAssignedSectionAlias: 'departmentOfAssignedSection',
    });
    if (!canProceed) {
      return { total: 0, byLevel: [] };
    }

    const pendingValues = await query.getMany();

    const byLevelCounts = {
      [KpiValueStatus.PENDING_SECTION_APPROVAL]: 0,
      [KpiValueStatus.PENDING_DEPT_APPROVAL]: 0,
      [KpiValueStatus.PENDING_MANAGER_APPROVAL]: 0,
    };

    pendingValues.forEach((pv) => {
      if (pv.status && byLevelCounts.hasOwnProperty(pv.status)) {
        byLevelCounts[pv.status]++;
      }
    });

    const byLevelResults = [
      {
        name: 'Trưởng Bộ phận/Section Leader',
        count: byLevelCounts[KpiValueStatus.PENDING_SECTION_APPROVAL],
        status: KpiValueStatus.PENDING_SECTION_APPROVAL,
      },
      {
        name: 'Trưởng phòng/Department Manager',
        count: byLevelCounts[KpiValueStatus.PENDING_DEPT_APPROVAL],
        status: KpiValueStatus.PENDING_DEPT_APPROVAL,
      },
      {
        name: 'Quản lý cấp cao/Manager',
        count: byLevelCounts[KpiValueStatus.PENDING_MANAGER_APPROVAL],
        status: KpiValueStatus.PENDING_MANAGER_APPROVAL,
      },
    ];

    this.logger.debug(
      `[getKpiAwaitingApprovalStats] Stats for user ${currentUser.id}: Total=${pendingValues.length}, ByLevel=${JSON.stringify(byLevelResults)}`,
    );
    return {
      total: pendingValues.length,
      byLevel: byLevelResults,
    };
  }

  async getKpiStatusOverTimeStats(
    currentUser: Employee,
    days: number = 7,
  ): Promise<{ approvedLastXDays: number; rejectedLastXDays: number }> {
    this.logger.debug(
      `[getKpiStatusOverTimeStats] Called by user: ${currentUser.id} for last ${days} days`,
    );

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const baseQuery = this.kpiValuesRepository
      .createQueryBuilder('kpiValue')
      .innerJoin('kpiValue.kpiAssignment', 'assignment')
      .leftJoin('assignment.employee', 'assignedEmployee')
      .leftJoin('assignment.section', 'assignedSection')
      .leftJoin('assignedSection.department', 'departmentOfAssignedSection')
      .where('kpiValue.updated_at >= :sinceDate', { sinceDate });

    const canProceedStatusOverTime = this.applyRoleBasedFilters(
      baseQuery,
      currentUser,
      {
        assignmentAlias: 'assignment',
        assignedEmployeeAlias: 'assignedEmployee',
        departmentOfAssignedSectionAlias: 'departmentOfAssignedSection',
      },
    );

    if (!canProceedStatusOverTime) {
      return { approvedLastXDays: 0, rejectedLastXDays: 0 };
    }

    const approvedLastXDays = await baseQuery
      .clone()
      .andWhere('kpiValue.status = :status', {
        status: KpiValueStatus.APPROVED,
      })
      .getCount();
    const rejectedLastXDays = await baseQuery
      .clone()
      .andWhere('kpiValue.status IN (:...statuses)', {
        statuses: [
          KpiValueStatus.REJECTED_BY_SECTION,
          KpiValueStatus.REJECTED_BY_DEPT,
          KpiValueStatus.REJECTED_BY_MANAGER,
        ],
      })
      .getCount();

    return { approvedLastXDays, rejectedLastXDays };
  }

  async getAverageApprovalTimeStats(currentUser: Employee): Promise<{
    totalAverageTime: number | null;
    byLevel: { name: string; averageTime: number | null }[];
  }> {
    this.logger.debug(
      `[getAverageApprovalTimeStats] Called by user: ${currentUser.id}`,
    );

    const completedKpiValuesQuery = this.kpiValuesRepository
      .createQueryBuilder('kv')
      .innerJoin('kv.kpiAssignment', 'assignment')
      .leftJoin('assignment.employee', 'assignedEmployee')
      .leftJoin('assignment.section', 'assignedSection')
      .leftJoin('assignedSection.department', 'departmentOfAssignedSection')
      .where('kv.status IN (:...finalStatuses)', {
        finalStatuses: [
          KpiValueStatus.APPROVED,
          KpiValueStatus.REJECTED_BY_SECTION,
          KpiValueStatus.REJECTED_BY_DEPT,
          KpiValueStatus.REJECTED_BY_MANAGER,
        ],
      })
      .select(['kv.id']);

    const canProceedAvgTime = this.applyRoleBasedFilters(
      completedKpiValuesQuery,
      currentUser,
      {
        assignmentAlias: 'assignment',
        assignedEmployeeAlias: 'assignedEmployee',
        departmentOfAssignedSectionAlias: 'departmentOfAssignedSection',
      },
    );

    if (!canProceedAvgTime) {
      return { totalAverageTime: null, byLevel: [] };
    }

    const completedKpiValueIds = (await completedKpiValuesQuery.getMany()).map(
      (kv) => kv.id,
    );

    if (completedKpiValueIds.length === 0) {
      return { totalAverageTime: null, byLevel: [] };
    }

    const histories = await this.kpiValueHistoryRepository
      .createQueryBuilder('history')
      .where('history.kpi_value_id IN (:...ids)', { ids: completedKpiValueIds })
      .orderBy('history.kpi_value_id', 'ASC')
      .addOrderBy('history.changed_at', 'ASC')
      .getMany();

    const processingTimes: number[] = [];

    const kpiValueTimeMap = new Map<
      number,
      { startTime?: Date; endTime?: Date }
    >();

    for (const record of histories) {
      if (!record.kpi_value_id) continue;

      let entry = kpiValueTimeMap.get(record.kpi_value_id);
      if (!entry) {
        entry = {};
        kpiValueTimeMap.set(record.kpi_value_id, entry);
      }

      if (
        (record.action === 'SUBMIT_CREATE' ||
          record.action === 'SUBMIT_UPDATE') &&
        !entry.startTime
      ) {
        entry.startTime = record.changed_at;
      }

      if (
        [
          KpiValueStatus.APPROVED,
          KpiValueStatus.REJECTED_BY_SECTION,
          KpiValueStatus.REJECTED_BY_DEPT,
          KpiValueStatus.REJECTED_BY_MANAGER,
        ].includes(record.status_after as KpiValueStatus)
      ) {
        entry.endTime = record.changed_at;
      }
    }

    kpiValueTimeMap.forEach((times) => {
      if (times.startTime && times.endTime && times.endTime > times.startTime) {
        processingTimes.push(
          times.endTime.getTime() - times.startTime.getTime(),
        );
      }
    });

    if (processingTimes.length === 0) {
      return { totalAverageTime: null, byLevel: [] };
    }

    const totalAverageMs =
      processingTimes.reduce((sum, time) => sum + time, 0) /
      processingTimes.length;
    const totalAverageHours = parseFloat(
      (totalAverageMs / (1000 * 60 * 60)).toFixed(2),
    );

    return { totalAverageTime: totalAverageHours, byLevel: [] };
  }

  async getTopKpiActivityStats(
    currentUser: Employee,
    days: number = 30,
    limit: number = 5,
  ): Promise<{
    submitted: { kpiId: number; name: string; count: number }[];
    updated: { kpiId: number; name: string; count: number }[];
  }> {
    this.logger.debug(
      `[getTopKpiActivityStats] Called by user: ${currentUser.id} for last ${days} days, limit ${limit}`,
    );

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const submittedQuery = this.kpiValueHistoryRepository
      .createQueryBuilder('history')
      .select('history.kpi_id', 'kpiId')
      .addSelect('COUNT(history.id)', 'count')
      .innerJoin('history.kpiValue', 'kpiValue')
      .innerJoin('kpiValue.kpiAssignment', 'assignment')
      .leftJoin('assignment.employee', 'assignedEmployee')
      .leftJoin('assignment.section', 'assignedSection')
      .leftJoin('assignedSection.department', 'departmentOfAssignedSection')
      .where('history.action = :action', { action: 'SUBMIT_CREATE' })
      .andWhere('history.changed_at >= :sinceDate', { sinceDate })
      .groupBy('history.kpi_id')
      .innerJoin(Kpi, 'kpi_entity', 'kpi_entity.id = history.kpi_id')
      .andWhere('kpi_entity.deleted_at IS NULL')
      .orderBy('count', 'DESC')
      .limit(limit);

    const canProceedSubmitted = this.applyRoleBasedFilters(
      submittedQuery,
      currentUser,
      {
        assignmentAlias: 'assignment',
        assignedEmployeeAlias: 'assignedEmployee',
        departmentOfAssignedSectionAlias: 'departmentOfAssignedSection',
      },
    );
    if (!canProceedSubmitted) return { submitted: [], updated: [] };
    const topSubmittedRaw = await submittedQuery.getRawMany();

    const updatedQuery = this.kpiValueHistoryRepository
      .createQueryBuilder('history')
      .select('history.kpi_id', 'kpiId')
      .addSelect('COUNT(history.id)', 'count')
      .innerJoin('history.kpiValue', 'kpiValue')
      .innerJoin('kpiValue.kpiAssignment', 'assignment')
      .leftJoin('assignment.employee', 'assignedEmployee')
      .leftJoin('assignment.section', 'assignedSection')
      .leftJoin('assignedSection.department', 'departmentOfAssignedSection')
      .where('history.action != :actionCreate', {
        actionCreate: 'SUBMIT_CREATE',
      })
      .innerJoin(
        Kpi,
        'kpi_entity_updated',
        'kpi_entity_updated.id = history.kpi_id',
      )
      .andWhere('kpi_entity_updated.deleted_at IS NULL')
      .andWhere('history.changed_at >= :sinceDate', { sinceDate })
      .groupBy('history.kpi_id')
      .orderBy('count', 'DESC')
      .limit(limit);

    const canProceedUpdated = this.applyRoleBasedFilters(
      updatedQuery,
      currentUser,
      {
        assignmentAlias: 'assignment',
        assignedEmployeeAlias: 'assignedEmployee',
        departmentOfAssignedSectionAlias: 'departmentOfAssignedSection',
      },
    );

    if (!canProceedUpdated && !canProceedSubmitted)
      return { submitted: [], updated: [] };
    const topUpdatedRaw = await updatedQuery.getRawMany();

    const kpiIds = [
      ...new Set([
        ...topSubmittedRaw.map((r) => r.kpiId),
        ...topUpdatedRaw.map((r) => r.kpiId),
      ]),
    ].filter((id) => id != null);
    const kpis =
      kpiIds.length > 0 ? await this.kpisRepository.findByIds(kpiIds) : [];
    const kpiNameMap = new Map(kpis.map((k) => [k.id, k.name]));

    const submitted = topSubmittedRaw.map((r) => ({
      kpiId: r.kpiId,
      name: kpiNameMap.get(r.kpiId) || 'Unknown KPI',
      count: parseInt(r.count, 10),
    }));
    const updated = topUpdatedRaw.map((r) => ({
      kpiId: r.kpiId,
      name: kpiNameMap.get(r.kpiId) || 'Unknown KPI',
      count: parseInt(r.count, 10),
    }));

    return { submitted, updated };
  }

  // Helper: check if user has a permission (resource, action, scope)
  private userHasPermission(user: Employee, resource: string, action: string, scope?: string): boolean {
    if (!user || !user.roles) return false;
    for (const role of user.roles) {
      if (role && Array.isArray(role.permissions)) {
        if (
          role.permissions.some(
            (p) =>
              p.resource === resource &&
              p.action === action &&
              (!scope || p.scope === scope)
          )
        ) {
          return true;
        }
      }
    }
    return false;
  }

  private hasDynamicRole(
    currentUser: Employee,
    resource: string,
    action: string,
    scope?: string,
  ): boolean {
    return this.userHasPermission(currentUser, resource, action, scope);
  }

  private applyRoleBasedFilters<
    T extends KpiValue | KpiValueHistory | Kpi | KPIAssignment,
  >(
    query: SelectQueryBuilder<T>,
    currentUser: Employee,
    aliases: {
      assignmentAlias: string;
      assignedEmployeeAlias: string;
      departmentOfAssignedSectionAlias: string;
      assignedDirectlyToDepartmentAlias?: string;
    },
  ): boolean {
    // Ưu tiên quyền cao nhất
    if (this.hasDynamicRole(currentUser, 'kpi', 'view', 'company')) {
      return true;
    }
    if (
      this.hasDynamicRole(currentUser, 'kpi', 'view', 'department') &&
      currentUser.departmentId
    ) {
      query.andWhere(
        `${aliases.departmentOfAssignedSectionAlias}.id = :deptId`,
        { deptId: currentUser.departmentId },
      );
      return true;
    }
    if (
      this.hasDynamicRole(currentUser, 'kpi', 'view', 'section') &&
      currentUser.sectionId
    ) {
      query.andWhere(
        `${aliases.assignedEmployeeAlias}.sectionId = :sectionId`,
        { sectionId: currentUser.sectionId },
      );
      return true;
    }
    if (this.hasDynamicRole(currentUser, 'kpi', 'view', 'personal')) {
      query.andWhere(`${aliases.assignedEmployeeAlias}.id = :userId`, {
        userId: currentUser.id,
      });
      return true;
    }
    return false;
  }

  async getTopPendingApproversStats(
    currentUser: Employee,
    limit: number = 5,
  ): Promise<
    {
      approverType: 'user' | 'department' | 'section';
      approverId: number;
      approverName: string;
      pendingCount: number;
      pendingKpis?: {
        kpiValueId: number;
        kpiId: number;
        kpiName: string;
        submittedBy?: string;
      }[];
    }[]
  > {
    this.logger.debug(
      `[getTopPendingApproversStats] Called by user: ${currentUser.id}, limit: ${limit}`,
    );
    // Đặt khai báo userRoles lên đầu mỗi hàm cần dùng
    const userRoles: string[] = Array.isArray(currentUser.roles)
      ? currentUser.roles.map((r: any) => (typeof r === 'string' ? r : r?.name))
      : [];

    const pendingValuesQuery = this.kpiValuesRepository
      .createQueryBuilder('kpiValue')
      .innerJoinAndSelect('kpiValue.kpiAssignment', 'assignment')
      .innerJoinAndSelect('assignment.kpi', 'kpi')
      .leftJoinAndSelect('assignment.employee', 'assignedEmployee')
      .leftJoinAndSelect('assignedEmployee.section', 'submitterSection')
      .leftJoinAndSelect('assignedEmployee.department', 'submitterDepartment')
      .leftJoinAndSelect('assignment.section', 'assignedSection')
      .leftJoinAndSelect(
        'assignedSection.department',
        'departmentOfAssignedSection',
      )
      .leftJoinAndSelect('assignment.department', 'assignedDepartment')
      .where('kpiValue.status IN (:...statuses)', {
        statuses: [
          KpiValueStatus.PENDING_SECTION_APPROVAL,
          KpiValueStatus.PENDING_DEPT_APPROVAL,
          KpiValueStatus.PENDING_MANAGER_APPROVAL,
        ],
      });

    // Replace userRoles.includes checks with permission checks
    if (this.userHasPermission(currentUser, 'kpi-value', 'approve', 'manager') && currentUser.departmentId) {
      pendingValuesQuery.andWhere(
        new Brackets((qb) => {
          qb.where('assignedDepartment.id = :userDeptId', {
            userDeptId: currentUser.departmentId,
          })
            .orWhere('departmentOfAssignedSection.id = :userDeptId', {
              userDeptId: currentUser.departmentId,
            })
            .orWhere('submitterDepartment.id = :userDeptId', {
              userDeptId: currentUser.departmentId,
            });
        }),
      );
    } else if (this.userHasPermission(currentUser, 'kpi-value', 'approve', 'department') && currentUser.departmentId) {
      pendingValuesQuery.andWhere(
        new Brackets((qb) => {
          qb.where('departmentOfAssignedSection.id = :userDeptId', {
            userDeptId: currentUser.departmentId,
          }).orWhere('submitterSection.departmentId = :userDeptId', {
            userDeptId: currentUser.departmentId,
          });
        }),
      );
    } else if (this.userHasPermission(currentUser, 'kpi-value', 'approve', 'section') && currentUser.sectionId) {
      pendingValuesQuery.andWhere('assignedSection.id = :sectionId', {
        sectionId: currentUser.sectionId,
      });
    } else if (this.userHasPermission(currentUser, 'kpi-value', 'approve', 'user')) {
      pendingValuesQuery.andWhere('assignedEmployee.id = :userId', {
        userId: currentUser.id,
      });
    }

    const pendingValues = await pendingValuesQuery.getMany();

    const approverCounts: Record<
      string,
      {
        approverType: 'user' | 'department' | 'section';
        approverId: number;
        approverName: string;
        pendingCount: number;
        pendingKpis: {
          kpiValueId: number;
          kpiId: number;
          kpiName: string;
          submittedBy?: string;
        }[];
        sortKey: string;
      }
    > = {};

    for (const pv of pendingValues) {
      let approverKey: string | null = null;
      let approverType: 'user' | 'department' | 'section' | null = null;
      let approverEntityId: number | null = null;
      let approverName: string = '';

      const assignment = pv.kpiAssignment;
      if (!assignment) continue;
      const kpiDetail = {
        kpiValueId: pv.id,
        kpiId: assignment.kpi.id,
        kpiName: assignment.kpi.name,
        submittedBy: assignment.employee
          ? `${assignment.employee.first_name} ${assignment.employee.last_name}`
          : assignment.section
            ? assignment.section.name
            : '',
      };

      if (pv.status === KpiValueStatus.PENDING_SECTION_APPROVAL) {
        const targetSection =
          assignment.section || assignment.employee?.section;
        if (targetSection) {
          approverType = 'section';
          approverEntityId = targetSection.id;
          approverName = targetSection.name || `Section ID ${targetSection.id}`;
          approverKey = `section_${targetSection.id}`;
        }
      } else if (pv.status === KpiValueStatus.PENDING_DEPT_APPROVAL) {
        const targetDepartment =
          assignment.department ||
          assignment.section?.department ||
          assignment.employee?.department;
        if (targetDepartment) {
          approverType = 'department';
          approverEntityId = targetDepartment.id;
          approverName =
            targetDepartment.name || `Department ID ${targetDepartment.id}`;
          approverKey = `department_${targetDepartment.id}`;
        }
      } else if (pv.status === KpiValueStatus.PENDING_MANAGER_APPROVAL) {
        approverType = 'user';
        approverEntityId = 0;
        approverName = 'Cấp Quản lý/Admin';
        approverKey = `group_manager_admin`;
      }

      if (approverKey && approverEntityId !== null && approverType) {
        if (!approverCounts[approverKey]) {
          approverCounts[approverKey] = {
            approverType,
            approverId: approverEntityId,
            approverName,
            pendingCount: 0,
            pendingKpis: [],
            sortKey: approverName.toLowerCase(),
          };
        }
        approverCounts[approverKey].pendingCount++;
        if (approverCounts[approverKey].pendingKpis.length < 5) {
          approverCounts[approverKey].pendingKpis.push(kpiDetail);
        }
      }
    }
    const sortedApprovers = Object.values(approverCounts)
      .sort((a, b) => {
        if (b.pendingCount === a.pendingCount) {
          return a.sortKey.localeCompare(b.sortKey);
        }
        return b.pendingCount - a.pendingCount;
      })
      .slice(0, limit);

    return sortedApprovers.map(({ sortKey, ...rest }) => rest);
  }

  async getKpiSubmissionStats(
    currentUser: Employee,
    params: {
      days: number;
      limit: number;
      entityType: 'user' | 'section' | 'department';
      orderBy: 'most' | 'least';
      recentKpisLimit?: number;
    },
  ): Promise<
    {
      id: number | string;
      name: string;
      count: number;
      recentSubmittedKpis?: {
        kpiId: number;
        kpiName: string;
        submittedAt: Date;
      }[];
    }[]
  > {
    const { days, limit, entityType, orderBy, recentKpisLimit = 3 } = params;
    this.logger.debug(
      `[getKpiSubmissionStats] Called by user: ${currentUser.id}, entityType: ${entityType}, orderBy: ${orderBy}, days: ${days}, limit: ${limit}, recentKpisLimit: ${recentKpisLimit}`,
    );

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const topEntitiesQuery = this.kpiValueHistoryRepository
      .createQueryBuilder('history')
      .select('COUNT(history.id)', 'count')
      .innerJoin(Employee, 'submitter', 'submitter.id = history.changed_by')
      .innerJoin(Kpi, 'kpi_for_count', 'kpi_for_count.id = history.kpi_id')
      .where('history.action = :action', { action: 'SUBMIT_CREATE' })
      .andWhere('history.changed_at >= :sinceDate', { sinceDate })
      .andWhere('kpi_for_count.deleted_at IS NULL');

    // Đặt khai báo userRoles lên đầu mỗi hàm cần dùng
    const userRoles: string[] = Array.isArray(currentUser.roles)
      ? currentUser.roles.map((r: any) => (typeof r === 'string' ? r : r?.name))
      : [];
    if (userRoles.includes('manager') && currentUser.departmentId) {
      topEntitiesQuery.andWhere('submitter.departmentId = :userDepartmentId', {
        userDepartmentId: currentUser.departmentId,
      });
    } else if (userRoles.includes('department') && currentUser.departmentId) {
      topEntitiesQuery.andWhere('submitter.departmentId = :userDepartmentId', {
        userDepartmentId: currentUser.departmentId,
      });
    } else if (userRoles.includes('section') && currentUser.sectionId) {
      topEntitiesQuery.andWhere('submitter.sectionId = :userSectionId', {
        userSectionId: currentUser.sectionId,
      });
    } else if (userRoles.includes('user')) {
      topEntitiesQuery.andWhere('submitter.id = :userId', {
        userId: currentUser.id,
      });
    }

    switch (entityType) {
      case 'user':
        topEntitiesQuery
          .addSelect('submitter.id', 'id')
          .addSelect(
            "CONCAT(submitter.first_name, ' ', submitter.last_name)",
            'name',
          )
          .groupBy('submitter.id, submitter.first_name, submitter.last_name');
        break;
      case 'section':
        topEntitiesQuery
          .leftJoin('submitter.section', 'sectionEntity')
          .addSelect('sectionEntity.id', 'id')
          .addSelect('sectionEntity.name', 'name')
          .andWhere('sectionEntity.id IS NOT NULL')
          .groupBy('sectionEntity.id, sectionEntity.name');
        break;
      case 'department':
        topEntitiesQuery
          .leftJoin('submitter.department', 'departmentEntity')
          .addSelect('departmentEntity.id', 'id')
          .addSelect('departmentEntity.name', 'name')
          .andWhere('departmentEntity.id IS NOT NULL')
          .groupBy('departmentEntity.id, departmentEntity.name');
        break;
    }

    topEntitiesQuery
      .orderBy('count', orderBy === 'most' ? 'DESC' : 'ASC')
      .limit(limit);

    const topEntitiesRaw = await topEntitiesQuery.getRawMany();

    if (topEntitiesRaw.length === 0) {
      return [];
    }

    const results: {
      id: number | string;
      name: string;
      count: number;
      recentSubmittedKpis?: {
        kpiId: number;
        kpiName: string;
        submittedAt: Date;
      }[];
    }[] = [];

    for (const entity of topEntitiesRaw) {
      const entityId = entity.id;
      let entityName = entity.name;
      const submissionCount = parseInt(entity.count, 10);
      let recentKpis: { kpiId: number; kpiName: string; submittedAt: Date }[] =
        [];

      if (!entityName) {
        if (entityType === 'section') entityName = 'Không có Bộ phận';
        else if (entityType === 'department') entityName = 'Không có Phòng ban';
        else entityName = 'Người dùng không xác định';
      }

      if (recentKpisLimit > 0 && entityId) {
        const kpiDetailsQuery = this.kpiValueHistoryRepository
          .createQueryBuilder('h_detail')
          .select('h_detail.kpi_id', 'kpiId')
          .addSelect('kpi_entity.name', 'kpiName')
          .addSelect('h_detail.changed_at', 'submittedAt')
          .innerJoin(Kpi, 'kpi_entity', 'kpi_entity.id = h_detail.kpi_id')
          .innerJoin(
            Employee,
            'submitter_detail',
            'submitter_detail.id = h_detail.changed_by',
          )
          .where('h_detail.action = :action', { action: 'SUBMIT_CREATE' })
          .andWhere('h_detail.changed_at >= :sinceDate', { sinceDate })
          .andWhere('kpi_entity.deleted_at IS NULL');

        if (entityType === 'user') {
          kpiDetailsQuery.andWhere('h_detail.changed_by = :entityIdParam', {
            entityIdParam: entityId,
          });
        } else if (entityType === 'section') {
          kpiDetailsQuery.andWhere(
            'submitter_detail.sectionId = :entityIdParam',
            { entityIdParam: entityId },
          );
        } else {
          kpiDetailsQuery.andWhere(
            'submitter_detail.departmentId = :entityIdParam',
            { entityIdParam: entityId },
          );
        }

        if (userRoles.includes('manager') && currentUser.departmentId) {
          kpiDetailsQuery.andWhere(
            'submitter_detail.departmentId = :managerDeptId',
            { managerDeptId: currentUser.departmentId },
          );
        }

        recentKpis = await kpiDetailsQuery
          .orderBy('h_detail.changed_at', 'DESC')
          .limit(recentKpisLimit)
          .getRawMany();
      }

      results.push({
        id: entityId,
        name: entityName,
        count: submissionCount,
        recentSubmittedKpis: recentKpis.map((kpi) => ({
          kpiId: kpi.kpiId,
          kpiName: kpi.kpiName,
          submittedAt: new Date(kpi.submittedAt),
        })),
      });
    }
    return results;
  }

  async getKpiPerformanceOverview(
    currentUser: Employee,
    daysForNotUpdated: number = 7,
  ): Promise<KpiPerformanceOverviewDto> {
    this.logger.debug(
      `[getKpiPerformanceOverview] Called by user: ${currentUser.id}`,
    );

    const baseKpiQuery = this.kpisRepository
      .createQueryBuilder('kpi')
      .where('kpi.deleted_at IS NULL');

    const totalKpis = await baseKpiQuery.getCount();

    const relevantAssignmentsQuery = this.kpisRepository
      .createQueryBuilder('kpi')
      .select([
        'kpi.id',
        'assignment.id',
        'assignment.targetValue',
        'latestValue.value',
        'latestValue.id AS latestValue_kpi_value_id',
        'assignedEmployee.id',
        'assignedEmployee.first_name',
        'assignedEmployee.last_name',
        'assignedEmployee.departmentId AS assignedEmployee_departmentId',
        'assignedEmployeeDepartment.name AS assignedEmployee_department_name',
        'assignedDirectlyToDepartment.id AS assignedDirectlyToDepartment_id',
        'assignedDirectlyToDepartment.name AS assignedDirectlyToDepartment_name',
        'departmentOfAssignedSection.id AS departmentOfAssignedSection_id',
        'departmentOfAssignedSection.name AS departmentOfAssignedSection_name',
        'latestValue.timestamp',
      ])
      .innerJoin('kpi.assignments', 'assignment')
      .leftJoin(
        (qb) =>
          qb
            .select(
              'kv_sub.kpi_assigment_id, MAX(kv_sub.timestamp) as max_timestamp',
            )
            .from(KpiValue, 'kv_sub')
            .groupBy('kv_sub.kpi_assigment_id'),
        'latest_value_time',
        'latest_value_time.kpi_assigment_id = assignment.id',
      )
      .leftJoin(
        KpiValue,
        'latestValue',
        'latestValue.kpi_assigment_id = assignment.id AND latestValue.timestamp = latest_value_time.max_timestamp',
      )
      .where('kpi.deleted_at IS NULL')
      .andWhere('assignment.deleted_at IS NULL');

    this.applyRoleBasedFilters(relevantAssignmentsQuery, currentUser, {
      assignmentAlias: 'assignment',
      assignedEmployeeAlias: 'assignedEmployee',
      departmentOfAssignedSectionAlias: 'departmentOfAssignedSection',
    });

    relevantAssignmentsQuery
      .leftJoin('assignment.employee', 'assignedEmployee')
      .leftJoin('assignedEmployee.department', 'assignedEmployeeDepartment')
      .leftJoin('assignment.section', 'assignedSection')
      .leftJoin('assignedSection.department', 'departmentOfAssignedSection')
      .leftJoin('assignment.department', 'assignedDirectlyToDepartment');

    const assignmentsWithLatestValues =
      await relevantAssignmentsQuery.getRawMany();

    let achievedCount = 0;
    let notAchievedCount = 0;
    let notUpdatedRecentlyCount = 0;
    const kpisWithValues = assignmentsWithLatestValues.filter(
      (a) => a.latestValue_value !== null,
    );
    const totalKpisWithValues = kpisWithValues.length;

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysForNotUpdated);

    for (const item of assignmentsWithLatestValues) {
      if (
        item.latestValue_value !== null &&
        item.assignment_targetValue !== null
      ) {
        if (
          parseFloat(item.latestValue_value) >=
          parseFloat(item.assignment_targetValue)
        ) {
          achievedCount++;
        } else {
          notAchievedCount++;
        }
      }

      if (
        item.latestValue_value === null ||
        (item.latestValue_timestamp &&
          new Date(item.latestValue_timestamp) < thresholdDate)
      ) {
        if (
          item.latestValue_value === null &&
          new Date(
            item.assignment_created_at || item.kpi_created_at || Date.now(),
          ) < thresholdDate
        ) {
          notUpdatedRecentlyCount++;
        } else if (
          item.latestValue_value !== null &&
          new Date(item.latestValue_timestamp) < thresholdDate
        ) {
          notUpdatedRecentlyCount++;
        }
      }
    }

    const totalRatedKpis = achievedCount + notAchievedCount;
    const achievedRate =
      totalRatedKpis > 0
        ? parseFloat(((achievedCount / totalRatedKpis) * 100).toFixed(2))
        : 0;
    const notAchievedRate =
      totalRatedKpis > 0
        ? parseFloat(((notAchievedCount / totalRatedKpis) * 100).toFixed(2))
        : 0;
    const notUpdatedRecentlyRate =
      totalKpisWithValues > 0
        ? parseFloat(
            ((notUpdatedRecentlyCount / totalKpisWithValues) * 100).toFixed(2),
          )
        : 0;

    const performanceByRole: PerformanceByRoleDto[] = [];
    const userRoles: string[] = Array.isArray(currentUser.roles)
      ? currentUser.roles.map((r: any) => (typeof r === 'string' ? r : r?.name))
      : [];
    if (userRoles.includes('admin') || userRoles.includes('manager')) {
      const performanceMap = new Map<
        number,
        {
          departmentName: string;
          total: number;
          achieved: number;
          notAchieved: number;
        }
      >();

      for (const item of kpisWithValues) {
        const departmentId =
          item.assigneddirectlytodepartment_id ||
          item.assignedemployee_departmentid ||
          item.departmentofassignedsection_id;
        const departmentName =
          item.assigneddirectlytodepartment_name ||
          item.assignedemployee_department_name ||
          item.departmentofassignedsection_name ||
          'Không xác định';

        if (departmentId) {
          if (
            userRoles.includes('manager') &&
            currentUser.departmentId !== departmentId
          ) {
            continue;
          }

          if (!performanceMap.has(departmentId)) {
            performanceMap.set(departmentId, {
              departmentName: departmentName,
              total: 0,
              achieved: 0,
              notAchieved: 0,
            });
          }
          const deptStat = performanceMap.get(departmentId)!;
          deptStat.total++;
          if (
            item.latestValue_value !== null &&
            item.assignment_targetValue !== null
          ) {
            if (
              parseFloat(item.latestValue_value) >=
              parseFloat(item.assignment_targetValue)
            ) {
              deptStat.achieved++;
            } else {
              deptStat.notAchieved++;
            }
          }
        }
      }

      performanceMap.forEach((stat, deptId) => {
        performanceByRole.push({
          roleType: 'department',
          roleId: deptId,
          roleName: stat.departmentName,
          totalAssignedKpis: stat.total,
          achievedCount: stat.achieved,
          notAchievedCount: stat.notAchieved,
          achievedRate:
            stat.total > 0
              ? parseFloat(((stat.achieved / stat.total) * 100).toFixed(2))
              : 0,
        });
      });

      performanceByRole.sort((a, b) => a.roleName.localeCompare(b.roleName));
    }

    return {
      totalKpis,
      achievedCount,
      notAchievedCount,
      achievedRate,
      notAchievedRate,
      notUpdatedRecentlyCount,
      totalKpisWithValues,
      notUpdatedRecentlyRate,
      performanceByRole:
        performanceByRole.length > 0 ? performanceByRole : undefined,
    };
  }

  async getKpiInventoryStats(currentUser: Employee): Promise<KpiInventoryDto> {
    // Đặt khai báo userRoles lên đầu mỗi hàm cần dùng
    const userRoles: string[] = Array.isArray(currentUser.roles)
      ? currentUser.roles.map((r: any) => (typeof r === 'string' ? r : r?.name))
      : [];

    this.logger.debug(
      `[getKpiInventoryStats] Called by user: ${currentUser.id} with roles: ${userRoles.join(',')}`,
    );

    const totalKpiDefinitionsQuery = this.kpisRepository
      .createQueryBuilder('kpi')
      .where('kpi.deleted_at IS NULL');

    if (userRoles.includes('manager') && currentUser.departmentId) {
      totalKpiDefinitionsQuery
        .innerJoin(
          'kpi.assignments',
          'assignment',
          'assignment.deleted_at IS NULL',
        )
        .leftJoin('assignment.employee', 'assignedEmployee')
        .leftJoin('assignment.section', 'assignedSection')
        .leftJoin('assignedSection.department', 'departmentOfAssignedSection')
        .leftJoin('assignment.department', 'assignedDirectlyToDepartment')
        .andWhere(
          new Brackets((qb) => {
            qb.where('assignedDirectlyToDepartment.id = :userDeptId', {
              userDeptId: currentUser.departmentId,
            })
              .orWhere('departmentOfAssignedSection.id = :userDeptId', {
                userDeptId: currentUser.departmentId,
              })
              .orWhere('assignedEmployee.departmentId = :userDeptId', {
                userDeptId: currentUser.departmentId,
              });
          }),
        )
        .distinct(true);
    }

    const totalKpiDefinitions = await totalKpiDefinitionsQuery.getCount();

    const totalKpiAssignmentsQuery = this.kpiValuesRepository
      .createQueryBuilder('kpiValue')
      .select('COUNT(DISTINCT assignment.id)', 'count')
      .innerJoin(
        'kpiValue.kpiAssignment',
        'assignment',
        'assignment.deleted_at IS NULL',
      )
      .leftJoin('assignment.employee', 'assignedEmployee')
      .leftJoin('assignment.section', 'assignedSection')
      .leftJoin('assignedSection.department', 'departmentOfAssignedSection')
      .leftJoin('assignment.department', 'assignedDirectlyToDepartment')
      .where('assignment.deleted_at IS NULL');

    this.applyRoleBasedFilters(totalKpiAssignmentsQuery, currentUser, {
      assignmentAlias: 'assignment',
      assignedEmployeeAlias: 'assignedEmployee',
      departmentOfAssignedSectionAlias: 'departmentOfAssignedSection',
      assignedDirectlyToDepartmentAlias: 'assignedDirectlyToDepartment',
    });

    const totalKpiAssignmentsRaw = await totalKpiAssignmentsQuery.getRawOne();
    const totalKpiAssignments = parseInt(
      totalKpiAssignmentsRaw?.count || '0',
      10,
    );

    const assignmentsByDepartmentQuery = this.kpiValuesRepository
      .createQueryBuilder('kpiValue')
      .innerJoin(
        'kpiValue.kpiAssignment',
        'assignment',
        'assignment.deleted_at IS NULL',
      )
      .leftJoin('assignment.department', 'assignedDirectlyToDepartment')
      .leftJoin('assignment.employee', 'assignedEmployee')
      .leftJoin('assignedEmployee.department', 'employeeDepartment')
      .leftJoin('assignment.section', 'assignedSection')
      .leftJoin('assignedSection.department', 'sectionDepartment')
      .select(
        'COALESCE(assignedDirectlyToDepartment.id, employeeDepartment.id, sectionDepartment.id)',
        'departmentId',
      )
      .addSelect(
        'COALESCE(assignedDirectlyToDepartment.name, employeeDepartment.name, sectionDepartment.name)',
        'departmentName',
      )
      .addSelect('COUNT(DISTINCT assignment.id)', 'count')
      .where('assignment.deleted_at IS NULL')
      .andWhere(
        new Brackets((qb) => {
          qb.where('assignedDirectlyToDepartment.id IS NOT NULL')
            .orWhere('employeeDepartment.id IS NOT NULL')
            .orWhere('sectionDepartment.id IS NOT NULL');
        }),
      );

    this.applyRoleBasedFilters(assignmentsByDepartmentQuery, currentUser, {
      assignmentAlias: 'assignment',
      assignedEmployeeAlias: 'assignedEmployee',
      departmentOfAssignedSectionAlias: 'sectionDepartment',
      assignedDirectlyToDepartmentAlias: 'assignedDirectlyToDepartment',
    });

    assignmentsByDepartmentQuery
      .groupBy(
        'COALESCE(assignedDirectlyToDepartment.id, employeeDepartment.id, sectionDepartment.id)',
      )
      .addGroupBy(
        'COALESCE(assignedDirectlyToDepartment.name, employeeDepartment.name, sectionDepartment.name)',
      )
      .orderBy('"departmentName"', 'ASC');

    const assignmentsByDepartmentRaw =
      await assignmentsByDepartmentQuery.getRawMany();
    const assignmentsByDepartment = assignmentsByDepartmentRaw
      .map((item) => ({
        departmentId: parseInt(item.departmentId, 10),
        departmentName: item.departmentName || 'Không xác định',
        count: parseInt(item.count, 10),
      }))
      .filter((item) => item.departmentId);

    const assignmentsByStatusQuery = this.kpiAssignmentRepository
      .createQueryBuilder('assignment')
      .select('assignment.status', 'status')
      .addSelect('COUNT(assignment.id)', 'count')
      .where('assignment.deleted_at IS NULL');

    assignmentsByStatusQuery
      .leftJoin('assignment.employee', 'assignedEmployee')
      .leftJoin('assignment.section', 'assignedSection')
      .leftJoin('assignedSection.department', 'departmentOfAssignedSection')
      .leftJoin('assignment.department', 'assignedDirectlyToDepartment');

    this.applyRoleBasedFilters(assignmentsByStatusQuery, currentUser, {
      assignmentAlias: 'assignment',
      assignedEmployeeAlias: 'assignedEmployee',
      departmentOfAssignedSectionAlias: 'departmentOfAssignedSection',
      assignedDirectlyToDepartmentAlias: 'assignedDirectlyToDepartment',
    });

    assignmentsByStatusQuery.groupBy('assignment.status');

    const assignmentsByStatusRaw = await assignmentsByStatusQuery.getRawMany();
    const assignmentsByStatus = assignmentsByStatusRaw.map((item) => ({
      status: item.status,
      count: parseInt(item.count, 10),
    }));

    return {
      totalKpiDefinitions,
      totalKpiAssignments,
      assignmentsByDepartment:
        assignmentsByDepartment.length > 0
          ? assignmentsByDepartment
          : undefined,
      assignmentsByStatus:
        assignmentsByStatus.length > 0 ? assignmentsByStatus : undefined,
    };
  }
}
