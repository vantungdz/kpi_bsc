import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Employee } from '../entities/employee.entity';
import { KpiValueHistory } from '../entities/kpi-value-history.entity';
import { KpiValue, KpiValueStatus } from '../entities/kpi-value.entity';
import { Kpi } from '../entities/kpi.entity';

@Injectable()
export class DashboardsService {
  private readonly logger = new Logger(DashboardsService.name);

  constructor(
    @InjectRepository(KpiValue)
    private readonly kpiValuesRepository: Repository<KpiValue>,
    @InjectRepository(KpiValueHistory) // Đảm bảo đã inject KpiValueHistoryRepository
    private readonly kpiValueHistoryRepository: Repository<KpiValueHistory>,
    @InjectRepository(Kpi) // Inject KpiRepository để lấy tên KPI
    private readonly kpisRepository: Repository<Kpi>,
    // Inject EmployeeRepository nếu bạn cần lấy thông tin chi tiết của Employee
    // @InjectRepository(Employee)
    // private readonly employeeRepository: Repository<Employee>,
  ) {}

  async getKpiAwaitingApprovalStats(currentUser: Employee): Promise<{
    total: number;
    byLevel: { name: string; count: number; status: KpiValueStatus }[];
  }> {
    this.logger.debug(`[getKpiAwaitingApprovalStats] Called by user: ${currentUser.id} with role: ${currentUser.role}`);

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

    switch (currentUser.role) {
      case 'section':
        if (!currentUser.sectionId) {
          this.logger.warn(`Section user ${currentUser.id} has no sectionId. Returning empty stats.`);
          return { total: 0, byLevel: [] };
        }
        query.andWhere(
          new Brackets((qb) => {
            qb.where('assignment.assigned_to_section = :sectionId', { sectionId: currentUser.sectionId })
              .orWhere('assignedEmployee.sectionId = :sectionId', { sectionId: currentUser.sectionId });
          }),
        );
        break;
      case 'department':
        if (!currentUser.departmentId) {
          this.logger.warn(`Department user ${currentUser.id} has no departmentId. Returning empty stats.`);
          return { total: 0, byLevel: [] };
        }
        query.andWhere(
          new Brackets((qb) => {
            qb.where('assignment.assigned_to_department = :deptId', { deptId: currentUser.departmentId })
              .orWhere('departmentOfAssignedSection.id = :deptId', { deptId: currentUser.departmentId })
              .orWhere('assignedEmployee.departmentId = :deptId', { deptId: currentUser.departmentId });
          }),
        );
        break;
      case 'manager':
      case 'admin':
        // Manager và Admin thấy tất cả các mục đang chờ
        break;
      default:
        this.logger.warn(`Role ${currentUser.role} has no specific view for awaiting approval stats. Returning empty stats.`);
        return { total: 0, byLevel: [] };
    }

    const pendingValues = await query.getMany();
    
    const byLevelCounts = {
      [KpiValueStatus.PENDING_SECTION_APPROVAL]: 0,
      [KpiValueStatus.PENDING_DEPT_APPROVAL]: 0,
      [KpiValueStatus.PENDING_MANAGER_APPROVAL]: 0,
    };

    pendingValues.forEach(pv => {
      if (pv.status && byLevelCounts.hasOwnProperty(pv.status)) {
        byLevelCounts[pv.status]++;
      }
    });

    const byLevelResults = [
      { name: 'Trưởng Bộ phận/Section Leader', count: byLevelCounts[KpiValueStatus.PENDING_SECTION_APPROVAL], status: KpiValueStatus.PENDING_SECTION_APPROVAL },
      { name: 'Trưởng phòng/Department Manager', count: byLevelCounts[KpiValueStatus.PENDING_DEPT_APPROVAL], status: KpiValueStatus.PENDING_DEPT_APPROVAL },
      { name: 'Quản lý cấp cao/Manager', count: byLevelCounts[KpiValueStatus.PENDING_MANAGER_APPROVAL], status: KpiValueStatus.PENDING_MANAGER_APPROVAL },
    ];

    this.logger.debug(`[getKpiAwaitingApprovalStats] Stats for user ${currentUser.id}: Total=${pendingValues.length}, ByLevel=${JSON.stringify(byLevelResults)}`);
    return {
      total: pendingValues.length,
      byLevel: byLevelResults,
    };
  }

  async getKpiStatusOverTimeStats(
    currentUser: Employee,
    days: number = 7, // Mặc định là 7 ngày
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
      .where('kpiValue.updated_at >= :sinceDate', { sinceDate }); // Chỉ xét các KpiValue được cập nhật gần đây

    // Áp dụng phân quyền tương tự như getKpiAwaitingApprovalStats
    // để đảm bảo người dùng chỉ thấy số liệu họ có quyền
    switch (currentUser.role) {
      case 'section':
        if (!currentUser.sectionId) return { approvedLastXDays: 0, rejectedLastXDays: 0 };
        baseQuery.andWhere(
          new Brackets((qb) => {
            qb.where('assignment.assigned_to_section = :sectionId', { sectionId: currentUser.sectionId })
              .orWhere('assignedEmployee.sectionId = :sectionId', { sectionId: currentUser.sectionId });
          }),
        );
        break;
      case 'department':
        if (!currentUser.departmentId) return { approvedLastXDays: 0, rejectedLastXDays: 0 };
        baseQuery.andWhere(
          new Brackets((qb) => {
            qb.where('assignment.assigned_to_department = :deptId', { deptId: currentUser.departmentId })
              .orWhere('departmentOfAssignedSection.id = :deptId', { deptId: currentUser.departmentId })
              .orWhere('assignedEmployee.departmentId = :deptId', { deptId: currentUser.departmentId });
          }),
        );
        break;
      case 'manager':
      case 'admin':
        // Manager và Admin thấy tất cả
        break;
      default:
        return { approvedLastXDays: 0, rejectedLastXDays: 0 };
    }

    const approvedLastXDays = await baseQuery.clone().andWhere('kpiValue.status = :status', { status: KpiValueStatus.APPROVED }).getCount();
    const rejectedLastXDays = await baseQuery.clone().andWhere('kpiValue.status IN (:...statuses)', { statuses: [KpiValueStatus.REJECTED_BY_SECTION, KpiValueStatus.REJECTED_BY_DEPT, KpiValueStatus.REJECTED_BY_MANAGER] }).getCount();

    return { approvedLastXDays, rejectedLastXDays };
  }

  async getAverageApprovalTimeStats(currentUser: Employee): Promise<{
    totalAverageTime: number | null; // in hours
    byLevel: { name: string; averageTime: number | null }[]; // in hours
  }> {
    this.logger.debug(`[getAverageApprovalTimeStats] Called by user: ${currentUser.id}`);

    // Lấy tất cả các KpiValue đã được APPROVED hoặc REJECTED (đã hoàn thành quy trình)
    // và có lịch sử thay đổi.
    // Cần join với KpiAssignment để áp dụng phân quyền
    const completedKpiValuesQuery = this.kpiValuesRepository.createQueryBuilder('kv')
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

    // Áp dụng phân quyền
    switch (currentUser.role) {
      case 'section':
        if (!currentUser.sectionId) return { totalAverageTime: null, byLevel: [] };
        completedKpiValuesQuery.andWhere(
          new Brackets((qb) => {
            qb.where('assignment.assigned_to_section = :sectionId', { sectionId: currentUser.sectionId })
              .orWhere('assignedEmployee.sectionId = :sectionId', { sectionId: currentUser.sectionId });
          }),
        );
        break;
      case 'department':
        if (!currentUser.departmentId) return { totalAverageTime: null, byLevel: [] };
        completedKpiValuesQuery.andWhere(
          new Brackets((qb) => {
            qb.where('assignment.assigned_to_department = :deptId', { deptId: currentUser.departmentId })
              .orWhere('departmentOfAssignedSection.id = :deptId', { deptId: currentUser.departmentId })
              .orWhere('assignedEmployee.departmentId = :deptId', { deptId: currentUser.departmentId });
          }),
        );
        break;
      case 'manager':
      case 'admin':
        break;
      default:
        return { totalAverageTime: null, byLevel: [] };
    }

    const completedKpiValueIds = (await completedKpiValuesQuery.getMany()).map(kv => kv.id);

    if (completedKpiValueIds.length === 0) {
      return { totalAverageTime: null, byLevel: [] };
    }

    const histories = await this.kpiValueHistoryRepository.createQueryBuilder('history')
      .where('history.kpi_value_id IN (:...ids)', { ids: completedKpiValueIds })
      .orderBy('history.kpi_value_id', 'ASC')
      .addOrderBy('history.changed_at', 'ASC')
      .getMany();

    const processingTimes: number[] = []; // Store processing times in milliseconds

    // Logic tính toán thời gian (đơn giản hóa)
    // Bạn cần một logic phức tạp hơn để theo dõi chính xác thời gian ở mỗi bước
    // dựa trên 'action' và 'status_before', 'status_after' trong KpiValueHistory.
    // Ví dụ này chỉ tính tổng thời gian từ lúc submit đầu tiên đến lúc có kết quả cuối.
    const kpiValueTimeMap = new Map<number, { startTime?: Date, endTime?: Date }>();

    for (const record of histories) {
      if (!record.kpi_value_id) continue;

      let entry = kpiValueTimeMap.get(record.kpi_value_id);
      if (!entry) {
        entry = {};
        kpiValueTimeMap.set(record.kpi_value_id, entry);
      }

      // Ghi nhận thời điểm submit đầu tiên (SUBMIT_CREATE hoặc SUBMIT_UPDATE)
      if ((record.action === 'SUBMIT_CREATE' || record.action === 'SUBMIT_UPDATE') && !entry.startTime) {
        entry.startTime = record.changed_at;
      }

      // Ghi nhận thời điểm có kết quả cuối cùng
      if (
        [KpiValueStatus.APPROVED, KpiValueStatus.REJECTED_BY_SECTION, KpiValueStatus.REJECTED_BY_DEPT, KpiValueStatus.REJECTED_BY_MANAGER].includes(record.status_after as KpiValueStatus)
      ) {
        entry.endTime = record.changed_at;
      }
    }

    kpiValueTimeMap.forEach(times => {
      if (times.startTime && times.endTime && times.endTime > times.startTime) {
        processingTimes.push(times.endTime.getTime() - times.startTime.getTime());
      }
    });

    if (processingTimes.length === 0) {
      return { totalAverageTime: null, byLevel: [] };
    }

    const totalAverageMs = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
    const totalAverageHours = parseFloat((totalAverageMs / (1000 * 60 * 60)).toFixed(2));

    // Việc tính byLevel sẽ phức tạp hơn, đòi hỏi phân tích action trong history
    // Ví dụ: thời gian từ PENDING_SECTION_APPROVAL -> APPROVE_SECTION hoặc PENDING_DEPT_APPROVAL
    // Tạm thời trả về mảng rỗng cho byLevel
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

    // --- Top Submitted KPIs (dựa trên KpiValueHistory với action SUBMIT_CREATE) ---
    const submittedQuery = this.kpiValueHistoryRepository
      .createQueryBuilder('history')
      .select('history.kpi_id', 'kpiId')
      .addSelect('COUNT(history.id)', 'count')
      .innerJoin('history.kpiValue', 'kpiValue') // Join để có thể join tiếp với KpiAssignment
      .innerJoin('kpiValue.kpiAssignment', 'assignment')
      .leftJoin('assignment.employee', 'assignedEmployee')
      .leftJoin('assignment.section', 'assignedSection')
      .leftJoin('assignedSection.department', 'departmentOfAssignedSection')
      .where('history.action = :action', { action: 'SUBMIT_CREATE' })
      .andWhere('history.changed_at >= :sinceDate', { sinceDate })
      .groupBy('history.kpi_id')
      .orderBy('count', 'DESC')
      .limit(limit);

    // Áp dụng phân quyền cho submittedQuery
    switch (currentUser.role) {
        case 'section':
            if (currentUser.sectionId) {
                submittedQuery.andWhere(new Brackets(qb => {
                    qb.where('assignment.assigned_to_section = :sectionId', { sectionId: currentUser.sectionId })
                      .orWhere('assignedEmployee.sectionId = :sectionId', { sectionId: currentUser.sectionId });
                }));
            } else { return { submitted: [], updated: [] }; }
            break;
        case 'department':
            if (currentUser.departmentId) {
                submittedQuery.andWhere(new Brackets(qb => {
                    qb.where('assignment.assigned_to_department = :deptId', { deptId: currentUser.departmentId })
                      .orWhere('departmentOfAssignedSection.id = :deptId', { deptId: currentUser.departmentId })
                      .orWhere('assignedEmployee.departmentId = :deptId', { deptId: currentUser.departmentId });
                }));
            } else { return { submitted: [], updated: [] }; }
            break;
    }
    const topSubmittedRaw = await submittedQuery.getRawMany();

    // --- Top Updated KPIs (dựa trên KpiValueHistory với các action không phải SUBMIT_CREATE) ---
    // Bao gồm SUBMIT_UPDATE, APPROVE_*, REJECT_*
    const updatedQuery = this.kpiValueHistoryRepository
      .createQueryBuilder('history')
      .select('history.kpi_id', 'kpiId')
      .addSelect('COUNT(history.id)', 'count')
      .innerJoin('history.kpiValue', 'kpiValue')
      .innerJoin('kpiValue.kpiAssignment', 'assignment')
      .leftJoin('assignment.employee', 'assignedEmployee')
      .leftJoin('assignment.section', 'assignedSection')
      .leftJoin('assignedSection.department', 'departmentOfAssignedSection')
      .where('history.action != :actionCreate', { actionCreate: 'SUBMIT_CREATE' })
      .andWhere('history.changed_at >= :sinceDate', { sinceDate })
      .groupBy('history.kpi_id')
      .orderBy('count', 'DESC')
      .limit(limit);

    // Áp dụng phân quyền cho updatedQuery
     switch (currentUser.role) {
        case 'section':
            if (currentUser.sectionId) {
                updatedQuery.andWhere(new Brackets(qb => {
                    qb.where('assignment.assigned_to_section = :sectionId', { sectionId: currentUser.sectionId })
                      .orWhere('assignedEmployee.sectionId = :sectionId', { sectionId: currentUser.sectionId });
                }));
            } else { return { submitted: [], updated: [] }; }
            break;
        case 'department':
            if (currentUser.departmentId) {
                updatedQuery.andWhere(new Brackets(qb => {
                    qb.where('assignment.assigned_to_department = :deptId', { deptId: currentUser.departmentId })
                      .orWhere('departmentOfAssignedSection.id = :deptId', { deptId: currentUser.departmentId })
                      .orWhere('assignedEmployee.departmentId = :deptId', { deptId: currentUser.departmentId });
                }));
            } else { return { submitted: [], updated: [] }; }
            break;
    }
    const topUpdatedRaw = await updatedQuery.getRawMany();

    // Lấy tên KPI cho kết quả
    const kpiIds = [...new Set([...topSubmittedRaw.map(r => r.kpiId), ...topUpdatedRaw.map(r => r.kpiId)])].filter(id => id != null);
    const kpis = kpiIds.length > 0 ? await this.kpisRepository.findByIds(kpiIds) : [];
    const kpiNameMap = new Map(kpis.map(k => [k.id, k.name]));

    const submitted = topSubmittedRaw.map(r => ({ kpiId: r.kpiId, name: kpiNameMap.get(r.kpiId) || 'Unknown KPI', count: parseInt(r.count, 10) }));
    const updated = topUpdatedRaw.map(r => ({ kpiId: r.kpiId, name: kpiNameMap.get(r.kpiId) || 'Unknown KPI', count: parseInt(r.count, 10) }));

    return { submitted, updated };
  }
}