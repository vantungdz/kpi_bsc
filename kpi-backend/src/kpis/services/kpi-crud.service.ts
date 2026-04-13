import { plainToInstance } from 'class-transformer';
import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, In, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Kpi, KpiDefinitionStatus } from '../entities/kpi.entity';
import { KPIAssignment } from '../../kpi-assessments/entities/kpi-assignment.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { KpiValue, KpiValueStatus } from '../../kpi-values/entities/kpi-value.entity';
import { CreateKpiDto } from '../dto/create_kpi_dto';
import { userHasPermission } from '../../common/utils/permission.utils';
import { RBAC_ACTIONS, RBAC_RESOURCES } from '../../common/rbac/rbac.constants';
import { EmployeesService } from '../../employees/employees.service';
import { NotificationService } from '../../notification/notification.service';
import { KpiCalculationService } from './kpi-calculation.service';
import { getKpiStatus } from '../kpis.service';
import {
  AssignmentWithLatestValue,
  KpiDetailWithProcessedAssignments,
} from '../interfaces/kpi.interfaces';

@Injectable()
export class KpiCrudService {
  private readonly logger = new Logger(KpiCrudService.name);

  constructor(
    private dataSource: DataSource,
    @InjectRepository(Kpi)
    private readonly kpisRepository: Repository<Kpi>,
    @InjectRepository(KPIAssignment)
    private readonly kpiAssignmentRepository: Repository<KPIAssignment>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    private eventEmitter: EventEmitter2,
    private employeesService: EmployeesService,
    private notificationService: NotificationService,
    private calculationService: KpiCalculationService,
  ) {}

  /**
   * Get KPI detail with processed assignments, calculated values, and validity status.
   */
  async findOne(
    id: number,
    userId: number,
  ): Promise<KpiDetailWithProcessedAssignments> {
    const kpi = await this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .leftJoinAndSelect('kpi.createdBy', 'createdBy')
      .leftJoinAndSelect('kpi.formula', 'formula') // ← THÊM FORMULA RELATION
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

    // Tính toán phân cấp values with caching
    const calculatedValues = this.calculationService.getCalculatedValues(kpi.assignments);
    const employeeValues = calculatedValues.employeeValues;
    const sectionValues = calculatedValues.sectionValues;
    const departmentValues = calculatedValues.departmentValues;

    const processedAssignments = kpi.assignments.map((assignment) => {
      let calculatedActualValue: number | null = null;

      if (assignment.assigned_to_employee) {
        calculatedActualValue =
          employeeValues.get(assignment.assigned_to_employee) ?? null;
      } else if (assignment.assigned_to_section) {
        calculatedActualValue =
          sectionValues.get(assignment.assigned_to_section) ?? null;
      } else if (assignment.assigned_to_department) {
        calculatedActualValue =
          departmentValues.get(assignment.assigned_to_department) ?? null;
      }

      let latestStatus: string | null = null;
      if (assignment.kpiValues && assignment.kpiValues.length > 0) {
        // Ensure values are sorted by latest timestamp
        const sortedValues = [...assignment.kpiValues].sort(
          (a, b) =>
            new Date(b.updated_at || b.timestamp).getTime() -
            new Date(a.updated_at || a.timestamp).getTime(),
        );
        latestStatus = sortedValues[0].status;
      }

      return {
        ...assignment,
        latest_actual_value: calculatedActualValue,
        latest_value_status: latestStatus,
        startDate: assignment.startDate ? new Date(assignment.startDate) : null,
        endDate: assignment.endDate ? new Date(assignment.endDate) : null,
      } as AssignmentWithLatestValue;
    });

    // Tính actual_value cho KPI with caching
    const kpiCalculatedValues = this.calculationService.getCalculatedValues(kpi.assignments);
    const kpiEmployeeValues = kpiCalculatedValues.employeeValues;
    const kpiSectionValues = kpiCalculatedValues.sectionValues;
    const kpiDepartmentValues = kpiCalculatedValues.departmentValues;

    // Lấy values từ cấp cao nhất có assignments (departments > sections > employees)
    let allValues: number[] = [];
    let allTargets: number[] = [];

    // Ưu tiên department assignments
    const hasDepartmentAssignments = kpi.assignments.some(
      (a) => a.assigned_to_department,
    );
    const hasSectionAssignments = kpi.assignments.some(
      (a) => a.assigned_to_section,
    );

    if (hasDepartmentAssignments && kpiDepartmentValues.size > 0) {
      // Chỉ dùng department values nếu có data thực sự
      kpiDepartmentValues.forEach((value) => {
        allValues.push(value);
      });
      kpi.assignments
        .filter((a) => a.assigned_to_department && a.targetValue != null)
        .forEach((a) => {
          allTargets.push(Number(a.targetValue) || 0);
        });
    } else if (hasSectionAssignments && kpiSectionValues.size > 0) {
      kpiSectionValues.forEach((value) => {
        allValues.push(value);
      });
      kpi.assignments
        .filter((a) => a.assigned_to_section && a.targetValue != null)
        .forEach((a) => {
          allTargets.push(Number(a.targetValue) || 0);
        });
    } else {
      // FALLBACK: Lấy từ employee assignments (kể cả khi có department/section assignments nhưng không có data)
      kpiEmployeeValues.forEach((value) => {
        allValues.push(value);
      });
      kpi.assignments
        .filter((a) => a.assigned_to_employee && a.targetValue != null)
        .forEach((a) => {
          allTargets.push(Number(a.targetValue) || 0);
        });
    }

    // Tính tổng actual_value (đơn giản hóa, bỏ công thức)
    const actual_value =
      allValues.length > 0 ? allValues.reduce((sum, val) => sum + val, 0) : 0;

    return { ...kpi, assignments: processedAssignments, actual_value };
  }

  /**
   * Create a new KPI with assignments (departments, sections, employees).
   * If user has Manager approval permission, KPI is auto-approved.
   */
  async create(createKpiDto: CreateKpiDto, userId: number): Promise<Kpi> {
    const creator = await this.employeeRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });
    const hasApproveManager = creator
      ? userHasPermission(
          creator,
          RBAC_ACTIONS.APPROVE,
          RBAC_RESOURCES.KPI_VALUE,
          'manager',
        )
      : false;

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

        const kpiStatus = hasApproveManager
          ? KpiDefinitionStatus.APPROVED
          : (kpiData.status ?? KpiDefinitionStatus.DRAFT);
        const kpiEntityToSave = manager.getRepository(Kpi).create({
          ...kpiData,
          formula_id: kpiData.formula_id || kpiData.formulaId,
          perspective_id: kpiData.perspective_id || kpiData.perspectiveId,
          start_date: kpiData.startDate || kpiData.start_date,
          end_date: kpiData.endDate || kpiData.end_date,
          description: kpiData.description,
          created_by: creatorEntityId,
          created_by_type: createdByType,
          status: kpiStatus,
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
        const assignmentStatus =
          savedKpiObject.status === KpiDefinitionStatus.APPROVED
            ? KpiDefinitionStatus.DRAFT
            : savedKpiObject.status;

        if (assignments?.toDepartments) {
          for (const targetDepartment of assignments.toDepartments) {
            const assignment = new KPIAssignment();
            assignment.kpi = { id: savedKpiObject.id } as Kpi;
            assignment.assignedFrom = assignments?.from || createdByType;
            assignment.assigned_to_department = targetDepartment.id;
            assignment.targetValue =
              Number(targetDepartment.target) ?? Number(kpiData.target);
            assignment.assignedBy = assignedByUserId;
            assignment.status = assignmentStatus;
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
            assignment.status = assignmentStatus;
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
          employeeAssignment.status = assignmentStatus;
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
            employeeAssignment.status = assignmentStatus;
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

  /**
   * Update a KPI and its assignments (soft delete removed assignments, restore re-selected ones).
   */
  async update(id: number, update: Partial<Kpi>, userId: number): Promise<Kpi> {
    return await this.kpisRepository.manager.transaction(
      async (manager): Promise<Kpi> => {
        // 1. Find the existing KPI record
        const kpi = await manager.getRepository(Kpi).findOne({
          where: { id },
          relations: ['assignments'],
        });

        if (!kpi) {
          throw new NotFoundException(`KPI with ID ${id} not found`);
        }

        // 2. Parse DTO and normalize KPI data
        const dto = plainToInstance(CreateKpiDto, update);
        const { assignments, ...kpiData } = dto as any;
        const createdByType =
          assignments?.from || kpi.created_by_type || 'company';

        const updatePayload: any = {
          name: kpiData.name,
          formula_id: kpiData.formula_id || kpiData.formulaId,
          perspective_id: kpiData.perspective_id || kpiData.perspectiveId,
          type: kpiData.type,
          unit: kpiData.unit,
          target: kpiData.target,
          weight: kpiData.weight,
          frequency: kpiData.frequency,
          start_date: kpiData.start_date || kpiData.startDate,
          end_date: kpiData.end_date || kpiData.endDate,
          description: kpiData.description,
          status: kpiData.status,
          updated_at: new Date(),
        };

        // Remove undefined keys to prevent overwriting existing data with null/undefined values
        Object.keys(updatePayload).forEach(
          (key) =>
            updatePayload[key] === undefined && delete updatePayload[key],
        );

        await manager.getRepository(Kpi).update(id, updatePayload);

        // 3. Handle Assignments Logic with Soft Delete
        if (assignments) {
          // Fetch current assignments, including soft-deleted ones,
          // to enable "restoration" if they are re-selected.
          const currentAssignments = await manager
            .getRepository(KPIAssignment)
            .find({
              where: { kpi: { id } },
              withDeleted: true,
            });

          const newAssignmentEntities: KPIAssignment[] = [];

          // Helper function to locate an existing assignment by type and target ID
          const findExisting = (
            type: 'department' | 'section' | 'employee',
            targetId: number,
          ) => {
            return currentAssignments.find((a) => {
              if (type === 'department')
                return a.assigned_to_department === targetId;
              if (type === 'section') return a.assigned_to_section === targetId;
              if (type === 'employee')
                return a.assigned_to_employee === targetId;
              return false;
            });
          };

          // Helper function to map data and restore soft-deleted records
          const processAssignment = (
            existing: KPIAssignment | undefined,
            data: any,
          ) => {
            const assignment =
              existing || manager.getRepository(KPIAssignment).create();
            Object.assign(assignment, {
              ...data,
              deleted_at: null, // Reset deleted_at to restore if previously soft-deleted
              updated_at: new Date(),
            });
            return assignment;
          };

          // --- Handle to_departments ---
          const depts =
            assignments.to_departments || assignments.toDepartments || [];
          for (const dept of depts) {
            const existing = findExisting('department', dept.id);
            newAssignmentEntities.push(
              processAssignment(existing, {
                kpi: { id },
                assignedFrom: assignments.from || createdByType,
                assigned_to_department: dept.id,
                targetValue: Number(dept.target),
                assignedBy: userId,
                status: updatePayload.status || kpi.status,
                weight: updatePayload.weight || kpi.weight,
              }),
            );
          }

          // --- Handle to_sections ---
          const secs = assignments.to_sections || assignments.toSections || [];
          for (const sec of secs) {
            const existing = findExisting('section', sec.id);
            newAssignmentEntities.push(
              processAssignment(existing, {
                kpi: { id },
                assignedFrom: assignments.from || createdByType,
                assigned_to_section: sec.id,
                targetValue: Number(sec.target),
                assignedBy: userId,
                status: updatePayload.status || kpi.status,
                weight: updatePayload.weight || kpi.weight,
              }),
            );
          }

          // --- Handle to_employees ---
          const emps = assignments.to_employees || assignments.toEmployees || [];
          for (const emp of emps) {
            const existing = findExisting('employee', emp.id);
            newAssignmentEntities.push(
              processAssignment(existing, {
                kpi: { id },
                assignedFrom: assignments.from || createdByType,
                assigned_to_employee: emp.id,
                employee_id: emp.id, // Đảm bảo mapping cả field employee_id nếu DB yêu cầu
                targetValue: Number(emp.target),
                assignedBy: userId,
                status: updatePayload.status || kpi.status,
                weight: emp.weight || updatePayload.weight || kpi.weight, // Ưu tiên weight riêng của emp
                startDate: updatePayload.start_date || kpi.start_date,
                endDate: updatePayload.end_date || kpi.end_date,
              }),
            );
          }

          // --- Handle employeeId ---
          if (assignments.employeeId) {
            const existing = findExisting('employee', assignments.employeeId);
            newAssignmentEntities.push(
              processAssignment(existing, {
                kpi: { id },
                assignedFrom: assignments.from || createdByType,
                assigned_to_employee: assignments.employeeId,
                employee_id: assignments.employeeId,
                targetValue: Number(kpiData.target),
                assignedBy: userId,
                status: updatePayload.status || kpi.status,
                weight: updatePayload.weight || kpi.weight,
                startDate: updatePayload.start_date || kpi.start_date,
                endDate: updatePayload.end_date || kpi.end_date,
              })
            );
          }

          // 4. Persist changes and cleanup (soft delete)
          if (newAssignmentEntities.length > 0) {
            // Save/Update current selected assignments
            const savedAssignments = await manager
              .getRepository(KPIAssignment)
              .save(newAssignmentEntities);
            const keptAssignmentIds = savedAssignments.map((a) => a.id);

            // Soft-delete assignments that are no longer in the update payload
            await manager
              .getRepository(KPIAssignment)
              .createQueryBuilder()
              .softDelete()
              .where('kpi_id = :kpiId', { kpiId: id })
              .andWhere('id NOT IN (:...ids)', { ids: keptAssignmentIds })
              .execute();
          } else {
            // If the payload contains no assignments, soft-delete all existing ones for this KPI
            await manager
              .getRepository(KPIAssignment)
              .softDelete({ kpi: { id } });
          }
        }

        return this.findOne(id, userId);
      },
    );
  }

  /**
   * Soft delete a KPI. Cannot delete KPI that has been scored.
   */
  async softDelete(
    id: number,
    userId: number,
    kpiType: 'company' | 'department' | 'section' | 'employee',
  ): Promise<void> {
    const user = await this.employeeRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });
    if (!user) throw new UnauthorizedException('User not found.');

    const hasPermission = userHasPermission(
      user,
      RBAC_ACTIONS.DELETE,
      RBAC_RESOURCES.KPI,
    );
    if (!hasPermission) {
      throw new UnauthorizedException(
        `No permission: ${RBAC_ACTIONS.DELETE} ${RBAC_RESOURCES.KPI}`,
      );
    }

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

  /**
   * Get all KPIs to check for expired/expiring soon (no pagination, only necessary fields)
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
   * Get all userIds related to a KPI: creator, all assigned users, leaders, managers (if any)
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

  /**
   * Toggle KPI status between DRAFT and APPROVED.
   * Also updates all assignment statuses accordingly.
   */
  async toggleKpiStatus(id: number, userId: number): Promise<Kpi> {
    const user = await this.employeeRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });
    if (!user) throw new UnauthorizedException('User not found.');

    const hasPermission = userHasPermission(
      user,
      RBAC_ACTIONS.TOGGLE_STATUS,
      RBAC_RESOURCES.KPI,
    );
    if (!hasPermission) {
      throw new UnauthorizedException(
        `No permission: ${RBAC_ACTIONS.TOGGLE_STATUS} ${RBAC_RESOURCES.KPI}`,
      );
    }
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

  /**
   * Find KPIs by an array of IDs (used by controller for delete pre-check).
   */
  async findKpisByIds(ids: number[]): Promise<Kpi[]> {
    if (!ids || ids.length === 0) return [];
    return this.kpisRepository.findBy({ id: In(ids) });
  }
}
