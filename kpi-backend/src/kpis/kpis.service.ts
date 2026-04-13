import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Kpi, KpiDefinitionStatus } from './entities/kpi.entity';
import { KPIAssignment } from '../kpi-assessments/entities/kpi-assignment.entity';
import { Employee } from '../employees/entities/employee.entity';
import { KpiFilterDto } from './dto/filter-kpi.dto';
import { CreateKpiDto } from './dto/create_kpi_dto';
import { KpiCalculationService } from './services/kpi-calculation.service';
import { KpiCrudService } from './services/kpi-crud.service';
import { KpiQueryService } from './services/kpi-query.service';
import { KpiAssignmentService } from './services/kpi-assignment.service';
import { KpiApprovalService } from './services/kpi-approval.service';
import { KpiDetailWithProcessedAssignments } from './interfaces/kpi.interfaces';

export { AssignmentWithLatestValue, KpiWithSectionActuals, KpiDetailWithProcessedAssignments } from './interfaces/kpi.interfaces';

/**
 * @deprecated Use the specific sub-services directly:
 * - KpiCalculationService for calculation logic
 * - KpiCrudService for create/update/delete/findOne
 * - KpiQueryService for list/query operations
 * - KpiAssignmentService for assignment management
 * - KpiApprovalService for approval workflows
 *
 * This facade is kept for backward compatibility and will be removed in a future version.
 */
@Injectable()
export class KpisService {
  private readonly logger = new Logger(KpisService.name);

  constructor(
    @InjectRepository(Kpi)
    private readonly kpisRepository: Repository<Kpi>,
    private readonly calculationService: KpiCalculationService,
    private readonly crudService: KpiCrudService,
    private readonly queryService: KpiQueryService,
    private readonly assignmentService: KpiAssignmentService,
    private readonly approvalService: KpiApprovalService,
  ) {}

  // ─── Query Methods (delegate to KpiQueryService) ───

  async getKpisByEmployeeId(employeeId: number, userId: number) {
    return this.queryService.getKpisByEmployeeId(employeeId, userId);
  }

  async findAll(filterDto: KpiFilterDto, userId: number) {
    return this.queryService.findAll(filterDto, userId);
  }

  async getDepartmentKpis(
    departmentId: number | null,
    filterDto: KpiFilterDto,
    loggedInUser: Employee,
  ) {
    return this.queryService.getDepartmentKpis(departmentId, filterDto, loggedInUser);
  }

  async getSectionKpis(
    sectionIdParam: number | string,
    filterDto: KpiFilterDto,
    loggedInUser: Employee,
  ) {
    return this.queryService.getSectionKpis(sectionIdParam, filterDto, loggedInUser);
  }

  async getMyAssignments(userId: number, filterDto: KpiFilterDto, cycle?: string) {
    return this.queryService.getMyAssignments(userId, filterDto, cycle);
  }

  async getEmployeeKpis(
    employeeId: number,
    filterDto: KpiFilterDto,
    userId: number,
    cycle?: string,
  ) {
    return this.queryService.getEmployeeKpis(employeeId, filterDto, userId, cycle);
  }

  async getKpiAssignments(kpiId: number, userId: number) {
    return this.queryService.getKpiAssignments(kpiId, userId);
  }

  async getAllKpiAssignedToDepartments(userId: number) {
    return this.queryService.getAllKpiAssignedToDepartments(userId);
  }

  async getAllKpiAssignedToSections(userId: number) {
    return this.queryService.getAllKpiAssignedToSections(userId);
  }

  async getKpiComparisonData(userId: number) {
    return this.queryService.getKpiComparisonData(userId);
  }

  // ─── CRUD Methods (delegate to KpiCrudService) ───

  async findOne(id: number, userId: number): Promise<KpiDetailWithProcessedAssignments> {
    return this.crudService.findOne(id, userId);
  }

  async create(createKpiDto: CreateKpiDto, userId: number) {
    return this.crudService.create(createKpiDto, userId);
  }

  async update(id: number, update: Partial<Kpi>, userId: number) {
    return this.crudService.update(id, update, userId);
  }

  async softDelete(
    id: number,
    userId: number,
    kpiType: 'company' | 'department' | 'section' | 'employee',
  ) {
    return this.crudService.softDelete(id, userId, kpiType);
  }

  async toggleKpiStatus(id: number, userId: number) {
    return this.crudService.toggleKpiStatus(id, userId);
  }

  async getAllKpisForExpiryCheck() {
    return this.crudService.getAllKpisForExpiryCheck();
  }

  async getAllRelatedUserIdsForKpi(kpi: any) {
    return this.crudService.getAllRelatedUserIdsForKpi(kpi);
  }

  // ─── Assignment Methods (delegate to KpiAssignmentService) ───

  async saveUserAssignments(
    kpiId: number,
    assignments: { user_id: number; target: number; weight?: number }[],
    loggedInUser: Employee,
    contextDepartmentId?: number,
  ) {
    return this.assignmentService.saveUserAssignments(
      kpiId,
      assignments,
      loggedInUser,
      contextDepartmentId,
    );
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
  ) {
    return this.assignmentService.saveDepartmentAndSectionAssignments(
      kpiId,
      assignmentsData,
      userId,
    );
  }

  // ─── Approval Methods (delegate to KpiApprovalService) ───

  async bulkSubmitKpis(kpiIds: number[], userId: number) {
    return this.approvalService.bulkSubmitKpis(kpiIds, userId);
  }

  async getPendingKpisForApproval(
    userId: number,
    options?: { startDate?: string; endDate?: string },
  ) {
    return this.approvalService.getPendingKpisForApproval(userId, options);
  }

  async approveKpi(kpiId: number, approverId: number) {
    return this.approvalService.approveKpi(kpiId, approverId);
  }

  async batchApproveKpis(kpiIds: number[], approverId: number) {
    return this.approvalService.batchApproveKpis(kpiIds, approverId);
  }
}


export function getKpiStatus(
  startDate: string | Date | null,
  endDate: string | Date | null,
): 'active' | 'expired' | 'not_started' | 'expiring_soon' {
  const now = new Date();
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  // KPI has not started
  if (start && now < start) return 'not_started';

  // KPI has expired
  if (end && now > end) return 'expired';

  // KPI is expiring soon (within 7 days)
  if (
    end &&
    now >= new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000) &&
    now <= end
  )
    return 'expiring_soon';

  // KPI is active
  return 'active';
}

/**
 * Check if KPI is usable (not expired or not_started)
 */
export function isKpiUsable(
  status: 'active' | 'expired' | 'not_started' | 'expiring_soon',
): boolean {
  return status === 'active' || status === 'expiring_soon';
}
