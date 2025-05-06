import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository, DataSource, DeepPartial, Brackets } from 'typeorm';
import { KpiValue, KpiValueStatus } from '../entities/kpi-value.entity';
import { KpiValueHistory } from '../entities/kpi-value-history.entity';
import { KPIAssignment } from '../entities/kpi-assignment.entity';
import { Employee } from '../entities/employee.entity';
import { Kpi, KpiDefinitionStatus } from '../entities/kpi.entity';

@Injectable()
export class KpiValuesService {
  private readonly logger = new Logger(KpiValuesService.name);
  constructor(
    private dataSource: DataSource,
    @InjectRepository(KpiValue)
    private kpiValuesRepository: Repository<KpiValue>,
    @InjectRepository(KpiValueHistory)
    private kpiValueHistoryRepository: Repository<KpiValueHistory>,
    @InjectRepository(KPIAssignment)
    private readonly kpiAssignmentRepository: Repository<KPIAssignment>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    private eventEmitter: EventEmitter2,
  ) {}

  async findAll(): Promise<KpiValue[]> {
    return await this.kpiValuesRepository.find({});
  }

  async findOne(id: number): Promise<KpiValue> {
    const data = await this.kpiValuesRepository.findOne({
      where: { id },
    });

    if (!data) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return data;
  }

  async create(
    kpiValueData: Partial<KpiValue>,
    createdBy: number,
  ): Promise<KpiValue> {
    const newKpiValue = this.kpiValuesRepository.create(kpiValueData);
    const savedKpiValue = await this.kpiValuesRepository.save(newKpiValue);

    const historyEntry = this.kpiValueHistoryRepository.create({
      kpi_value_id: savedKpiValue.id,

      value: savedKpiValue.value,
      timestamp: savedKpiValue.timestamp,
      notes: savedKpiValue.notes,
      action: 'CREATE',
      changed_by: createdBy,
    });
    await this.kpiValueHistoryRepository.save(historyEntry);

    return savedKpiValue;
  }

  async update(
    id: number,
    updateData: Partial<KpiValue>,
    updatedBy: number,
  ): Promise<KpiValue> {
    const kpiValue = await this.kpiValuesRepository.findOne({
      where: { id },
    });
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found`);
    }

    const historyEntry = this.kpiValueHistoryRepository.create({
      kpi_value_id: kpiValue.id,

      value: kpiValue.value,
      timestamp: kpiValue.timestamp,
      notes: kpiValue.notes,
      action: 'UPDATE',
      changed_by: updatedBy,
    });
    await this.kpiValueHistoryRepository.save(historyEntry);

    Object.assign(kpiValue, updateData);
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = updatedBy;
    return this.kpiValuesRepository.save(kpiValue);
  }

  async delete(id: number, deletedBy: number): Promise<boolean> {
    const kpiValue = await this.kpiValuesRepository.findOne({
      where: { id },
    });
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found`);
    }

    const historyEntry = this.kpiValueHistoryRepository.create({
      kpi_value_id: kpiValue.id,

      value: kpiValue.value,
      timestamp: kpiValue.timestamp,
      notes: kpiValue.notes,
      action: 'DELETE',
      changed_by: deletedBy,
    });
    await this.kpiValueHistoryRepository.save(historyEntry);

    await this.kpiValuesRepository.delete(id);
    return true;
  }

  async submitProgressUpdate(
    assignmentId: number,
    notes: string,
    projectDetails: any[],
    userId: number,
  ): Promise<KpiValue> {
    return await this.dataSource.transaction(
      async (transactionalEntityManager) => {
        const kpiValueRepo = transactionalEntityManager.getRepository(KpiValue);
        const historyRepo =
          transactionalEntityManager.getRepository(KpiValueHistory);
        const assignmentRepo =
          transactionalEntityManager.getRepository(KPIAssignment);

        const assignment = await assignmentRepo.findOne({
          where: { id: assignmentId },
          relations: ['kpi'],
        });

        if (!assignment) {
          throw new NotFoundException(
            `KPI Assignment with ID ${assignmentId} not found. Cannot submit progress.`,
          );
        }
        if (!assignment.kpi) {
          throw new InternalServerErrorException(
            `Could not load parent KPI for Assignment ID ${assignmentId}.`,
          );
        }

        if (assignment.kpi.status !== KpiDefinitionStatus.APPROVED) {
          throw new BadRequestException(
            `Cannot submit value for a KPI that is not APPROVED (current status: ${assignment.kpi.status}).`,
          );
        }

        let calculatedValue = 0;
        if (projectDetails && Array.isArray(projectDetails)) {
          calculatedValue = projectDetails.reduce(
            (sum, project) =>
              sum + Number(project.value || project.projectValue || 0),
            0,
          );
        }

        let existingRecord = await kpiValueRepo.findOneBy({
          kpi_assigment_id: assignmentId,
        });

        let savedKpiValue: KpiValue;
        let historyAction: string;
        const currentTimestamp = new Date();
        const projectDetailsObject = projectDetails;
        const initialStatusAfterSubmit =
          KpiValueStatus.PENDING_SECTION_APPROVAL;
        const statusBeforeSubmit = existingRecord?.status;

        if (existingRecord) {
          historyAction = 'SUBMIT_UPDATE';
          existingRecord.value = calculatedValue;
          existingRecord.notes = notes;
          existingRecord.project_details = projectDetailsObject;
          existingRecord.status = initialStatusAfterSubmit;
          existingRecord.timestamp = currentTimestamp;
          existingRecord.updated_by = userId;
          existingRecord.rejection_reason = null;
          savedKpiValue = await kpiValueRepo.save(existingRecord);
        } else {
          historyAction = 'SUBMIT_CREATE';
          const newKpiValueData: Partial<KpiValue> = {
            kpi_assigment_id: assignmentId,
            value: calculatedValue,
            timestamp: currentTimestamp,
            notes: notes,
            status: initialStatusAfterSubmit,
            project_details: projectDetailsObject,
            updated_by: userId,
          };
          const newKpiValue = kpiValueRepo.create(newKpiValueData);
          savedKpiValue = await kpiValueRepo.save(newKpiValue);
        }

        const historyEntry = historyRepo.create({
          kpi_value_id: savedKpiValue.id,
          kpi_assigment_id: assignmentId,
          kpi_id: assignment.kpi_id,
          value: savedKpiValue.value,
          timestamp: savedKpiValue.timestamp,
          notes: savedKpiValue.notes,
          status_before: statusBeforeSubmit,
          status_after: savedKpiValue.status,
          action: historyAction,
          changed_by: userId,
          changed_at: new Date(),
        } as DeepPartial<KpiValueHistory>);
        await historyRepo.save(historyEntry);

        return savedKpiValue;
      },
    );
  }

  async getHistory(kpiValueId: number): Promise<KpiValueHistory[]> {
    return this.kpiValueHistoryRepository.find({
      where: { kpi_value_id: kpiValueId },
      relations: ['changedByUser'],
      order: { changed_at: 'DESC' },
    });
  }

  async approveValueBySection(
    valueId: number,
    userId: number,
  ): Promise<KpiValue> {
    const kpiValue = await this.findKpiValueForWorkflow(valueId);
    const statusBefore = kpiValue.status;
    const user = await this.employeeRepository.findOneBy({ id: userId });

    if (!user) {
      throw new UnauthorizedException('Approving user not found.');
    }

    const canApprove = await this.checkPermission(
      userId,
      kpiValue.kpi_assigment_id,
      'SECTION_APPROVE',
    );
    if (!canApprove) {
      throw new UnauthorizedException(
        'User does not have permission for Section level action.',
      );
    }

    if (kpiValue.status !== KpiValueStatus.PENDING_SECTION_APPROVAL) {
      throw new BadRequestException(
        `Cannot perform Section Approval on value with status '${kpiValue.status}'. Expected '${KpiValueStatus.PENDING_SECTION_APPROVAL}'.`,
      );
    }

    const newStatus =
      user.role === 'manager' || user.role === 'admin'
        ? KpiValueStatus.APPROVED
        : KpiValueStatus.PENDING_DEPT_APPROVAL;

    kpiValue.status = newStatus;
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = userId;
    kpiValue.rejection_reason = null;

    await this.logWorkflowHistory(
      kpiValue,
      statusBefore,
      'APPROVE_SECTION',
      userId,
    );
    const savedValue = await this.kpiValuesRepository.save(kpiValue);
    this.logger.log(
      `[approveValueBySection] Saved KpiValue ID ${savedValue.id} with status ${savedValue.status}`,
    );

    await this.logWorkflowHistory(
      savedValue,
      statusBefore,
      'APPROVE_SECTION',
      userId,
    );

    if (savedValue.status === KpiValueStatus.APPROVED) {
      const assignment =
        savedValue.kpiAssignment ??
        (await this.kpiAssignmentRepository.findOneBy({
          id: savedValue.kpi_assigment_id,
        }));
      if (assignment && typeof assignment.kpi_id === 'number') {
        this.logger.log(
          `Emitting kpi_value.approved event for KPI ID: ${assignment.kpi_id}`,
        );

        this.eventEmitter.emit('kpi_value.approved', {
          kpiId: assignment.kpi_id,
        });
      } else {
        this.logger.error(
          `Cannot emit kpi_value.approved event: Missing assignment or kpi_id for KpiValue ID ${savedValue.id}`,
        );
      }
    }
    return savedValue;
  }

  async rejectValueBySection(
    valueId: number,
    reason: string,
    userId: number,
  ): Promise<KpiValue> {
    const kpiValue = await this.findKpiValueForWorkflow(valueId);
    const statusBefore = kpiValue.status;
    const user = await this.employeeRepository.findOneBy({ id: userId });

    if (!user) throw new UnauthorizedException('Rejecting user not found.');

    const canReject = await this.checkPermission(
      userId,
      kpiValue.kpi_assigment_id,
      'SECTION_REJECT',
    );
    if (!canReject) {
      throw new UnauthorizedException(
        'User does not have permission to reject at Section level.',
      );
    }
    if (kpiValue.status !== KpiValueStatus.PENDING_SECTION_APPROVAL) {
      throw new BadRequestException(
        `Cannot reject value from status '${kpiValue.status}'. Expected '${KpiValueStatus.PENDING_SECTION_APPROVAL}'.`,
      );
    }
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Rejection reason is required.');
    }

    let newStatus: KpiValueStatus;
    let logAction: string;

    if (user.role === 'admin' || user.role === 'manager') {
      newStatus = KpiValueStatus.REJECTED_BY_MANAGER;
      logAction = 'REJECT_MANAGER';
      console.log(
        `[rejectValueBySection] Admin/Manager (ID: ${userId}) rejecting at Section level. Final Status: REJECTED_BY_MANAGER. Logging Action: ${logAction}`,
      );
    } else {
      newStatus = KpiValueStatus.REJECTED_BY_SECTION;
      logAction = 'REJECT_SECTION';
      console.log(
        `[rejectValueBySection] Leader (ID: ${userId}) rejecting at Section level. Final Status: REJECTED_BY_SECTION. Logging Action: ${logAction}`,
      );
    }

    kpiValue.status = newStatus;
    kpiValue.rejection_reason = reason;
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = userId;

    await this.logWorkflowHistory(
      kpiValue,
      statusBefore,
      logAction,
      userId,
      reason,
    );

    console.log(
      `[rejectValueBySection] SAVING KpiValue ID ${kpiValue.id} with NEW status: ${kpiValue.status}`,
    );
    return this.kpiValuesRepository.save(kpiValue);
  }

  async approveValueByDepartment(
    valueId: number,
    userId: number,
  ): Promise<KpiValue> {
    const kpiValue = await this.findKpiValueForWorkflow(valueId);
    const statusBefore = kpiValue.status;
    const user = await this.employeeRepository.findOneBy({ id: userId });

    if (!user) {
      throw new UnauthorizedException('Approving user not found.');
    }

    const canApprove = await this.checkPermission(
      userId,
      kpiValue.kpi_assigment_id,
      'DEPT_APPROVE',
    );
    if (!canApprove) {
      throw new UnauthorizedException(
        'User does not have permission for Section level action.',
      );
    }

    if (
      ![
        KpiValueStatus.PENDING_DEPT_APPROVAL,
        KpiValueStatus.PENDING_SECTION_APPROVAL,
      ].includes(kpiValue.status)
    ) {
      throw new BadRequestException(
        `Cannot perform Department Approval on value with status '${kpiValue.status}'. Expected '${KpiValueStatus.PENDING_DEPT_APPROVAL}' or lower.`,
      );
    }

    const newStatus =
      user.role === 'manager' || user.role === 'admin'
        ? KpiValueStatus.APPROVED
        : KpiValueStatus.PENDING_MANAGER_APPROVAL;

    kpiValue.status = newStatus;
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = userId;
    kpiValue.rejection_reason = null;

    await this.logWorkflowHistory(
      kpiValue,
      statusBefore,
      'APPROVE_DEPT',
      userId,
    );
    const savedValue = await this.kpiValuesRepository.save(kpiValue);
    this.logger.log(
      `[approveValueByDepartment] Saved KpiValue ID ${savedValue.id} with status ${savedValue.status}`,
    );

    await this.logWorkflowHistory(
      savedValue,
      statusBefore,
      'APPROVE_DEPT',
      userId,
    );

    if (savedValue.status === KpiValueStatus.APPROVED) {
      const assignment =
        savedValue.kpiAssignment ??
        (await this.kpiAssignmentRepository.findOneBy({
          id: savedValue.kpi_assigment_id,
        }));
      if (assignment && typeof assignment.kpi_id === 'number') {
        this.logger.log(
          `Emitting kpi_value.approved event for KPI ID: ${assignment.kpi_id}`,
        );
        this.eventEmitter.emit('kpi_value.approved', {
          kpiId: assignment.kpi_id,
        });
      } else {
        this.logger.error(
          `Cannot emit kpi_value.approved event: Missing assignment or kpi_id for KpiValue ID ${savedValue.id}`,
        );
      }
    }
    return savedValue;
  }

  async rejectValueByDepartment(
    valueId: number,
    reason: string,
    userId: number,
  ): Promise<KpiValue> {
    const kpiValue = await this.findKpiValueForWorkflow(valueId);
    const statusBefore = kpiValue.status;
    const user = await this.employeeRepository.findOneBy({ id: userId });

    if (!user) throw new UnauthorizedException('Rejecting user not found.');

    const canReject = await this.checkPermission(
      userId,
      kpiValue.kpi_assigment_id,
      'DEPT_REJECT',
    );
    if (!canReject) {
      throw new UnauthorizedException(
        'User does not have permission to reject at Department level.',
      );
    }

    if (
      ![
        KpiValueStatus.PENDING_DEPT_APPROVAL,
        KpiValueStatus.PENDING_SECTION_APPROVAL,
      ].includes(kpiValue.status)
    ) {
      throw new BadRequestException(
        `Cannot reject value from status '${kpiValue.status}'. Expected '${KpiValueStatus.PENDING_DEPT_APPROVAL}' or '${KpiValueStatus.PENDING_SECTION_APPROVAL}'.`,
      );
    }
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Rejection reason is required.');
    }

    let newStatus: KpiValueStatus;
    let logAction: string;

    if (user.role === 'admin' || user.role === 'manager') {
      newStatus = KpiValueStatus.REJECTED_BY_MANAGER;
      logAction = 'REJECT_MANAGER';
      console.log(
        `[rejectValueByDepartment] Admin/Manager (ID: ${userId}) rejecting at/before Dept level. Final Status: REJECTED_BY_MANAGER. Logging Action: ${logAction}`,
      );
    } else {
      console.warn(
        `[rejectValueByDepartment] Unexpected user role (${user.role}) attempting Dept rejection. Logging as REJECT_DEPT.`,
      );
      newStatus = KpiValueStatus.REJECTED_BY_DEPT;
      logAction = 'REJECT_DEPT';
    }

    kpiValue.status = newStatus;
    kpiValue.rejection_reason = reason;
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = userId;

    await this.logWorkflowHistory(
      kpiValue,
      statusBefore,
      logAction,
      userId,
      reason,
    );

    console.log(
      `[rejectValueByDepartment] SAVING KpiValue ID ${kpiValue.id} with NEW status: ${kpiValue.status}`,
    );
    return this.kpiValuesRepository.save(kpiValue);
  }

  async approveValueByManager(
    valueId: number,
    userId: number,
  ): Promise<KpiValue> {
    console.log(
      `--- approveValueByManager CALLED by UserID: ${userId} for ValueID: ${valueId} ---`,
    );
    const kpiValue = await this.findKpiValueForWorkflow(valueId);
    const statusBefore = kpiValue.status;
    const user = await this.employeeRepository.findOneBy({ id: userId });

    if (!user) {
      console.error(
        `[approveValueByManager] Approving user ${userId} not found.`,
      );
      throw new UnauthorizedException('Approving user not found.');
    }
    console.log(
      `[approveValueByManager] Approver Info: ID=${user.id}, Role=${user.role}`,
    );

    const canApprove = await this.checkPermission(
      userId,
      kpiValue.kpi_assigment_id,
      'MANAGER_APPROVE',
    );
    if (!canApprove) {
      console.error(
        `[approveValueByManager] Permission DENIED by checkPermission.`,
      );
      throw new UnauthorizedException(
        'User does not have permission for Section level action.',
      );
    }

    if (
      ![
        KpiValueStatus.PENDING_MANAGER_APPROVAL,
        KpiValueStatus.PENDING_DEPT_APPROVAL,
        KpiValueStatus.PENDING_SECTION_APPROVAL,
      ].includes(kpiValue.status)
    ) {
      console.error(
        `[approveValueByManager] Invalid current status: ${kpiValue.status}`,
      );
      throw new BadRequestException(
        `Cannot perform final Manager Approval on value with status '${kpiValue.status}'. Expected a pending status.`,
      );
    }

    const newStatus = KpiValueStatus.APPROVED;

    console.log(`[approveValueByManager] Status Before: ${statusBefore}`);
    console.log(
      `[approveValueByManager] Determined New Status based on role '${user.role}': ${newStatus}`,
    );

    kpiValue.status = newStatus;
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = userId;
    kpiValue.rejection_reason = null;

    await this.logWorkflowHistory(
      kpiValue,
      statusBefore,
      'APPROVE_MANAGER',
      userId,
    );

    console.log(
      `[approveValueByManager] Attempting to SAVE KpiValue ID ${kpiValue.id} with NEW status: ${kpiValue.status}`,
    );

    const savedValue = await this.kpiValuesRepository.save(kpiValue);
    this.logger.log(
      `[approveValueByManager] Saved KpiValue ID ${savedValue.id} with status ${savedValue.status}`,
    );

    await this.logWorkflowHistory(
      savedValue,
      statusBefore,
      'APPROVE_MANAGER',
      userId,
    );

    const assignment =
      savedValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: savedValue.kpi_assigment_id,
      }));
    if (assignment && typeof assignment.kpi_id === 'number') {
      this.logger.log(
        `Emitting kpi_value.approved event for KPI ID: ${assignment.kpi_id}`,
      );
      this.eventEmitter.emit('kpi_value.approved', {
        kpiId: assignment.kpi_id,
      });
    } else {
      this.logger.error(
        `Cannot emit kpi_value.approved event: Missing assignment or kpi_id for KpiValue ID ${savedValue.id}`,
      );
    }
    return savedValue;
  }

  async rejectValueByManager(
    valueId: number,
    reason: string,
    userId: number,
  ): Promise<KpiValue> {
    const kpiValue = await this.findKpiValueForWorkflow(valueId);
    const statusBefore = kpiValue.status;
    const user = await this.employeeRepository.findOneBy({ id: userId });

    if (!user) throw new UnauthorizedException('Rejecting user not found.');

    const canReject = await this.checkPermission(
      userId,
      kpiValue.kpi_assigment_id,
      'MANAGER_REJECT',
    );
    if (!canReject) {
      throw new UnauthorizedException(
        'User does not have permission to reject at Manager level.',
      );
    }

    if (
      ![
        KpiValueStatus.PENDING_MANAGER_APPROVAL,
        KpiValueStatus.PENDING_DEPT_APPROVAL,
        KpiValueStatus.PENDING_SECTION_APPROVAL,
      ].includes(kpiValue.status)
    ) {
      throw new BadRequestException(
        `Cannot reject value from status '${kpiValue.status}'. Expected a pending status.`,
      );
    }
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Rejection reason is required.');
    }

    const newStatus = KpiValueStatus.REJECTED_BY_MANAGER;
    const logAction = 'REJECT_MANAGER';
    console.log(
      `[rejectValueByManager] Manager/Admin (ID: ${userId}) performing final rejection. Setting status to REJECTED_BY_MANAGER. Logging Action: ${logAction}`,
    );

    kpiValue.status = newStatus;
    kpiValue.rejection_reason = reason;
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = userId;

    await this.logWorkflowHistory(
      kpiValue,
      statusBefore,
      logAction,
      userId,
      reason,
    );

    console.log(
      `[rejectValueByManager] SAVING KpiValue ID ${kpiValue.id} with NEW status: ${kpiValue.status}`,
    );
    return this.kpiValuesRepository.save(kpiValue);
  }

  private async findKpiValueForWorkflow(valueId: number): Promise<KpiValue> {
    const kpiValue = await this.kpiValuesRepository.findOne({
      where: { id: valueId },
      relations: [
        'kpiAssignment',
        'kpiAssignment.section',
        'kpiAssignment.department',
        'kpiAssignment.section.department',
      ],
    });
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${valueId} not found.`);
    }
    if (!kpiValue.kpiAssignment) {
      throw new InternalServerErrorException(
        `Assignment not found for KPI Value ID ${valueId}. Data might be inconsistent.`,
      );
    }
    return kpiValue;
  }

  private async checkPermission(
    userId: number,
    assignmentId: number,
    action: string,
  ): Promise<boolean> {
    console.log(
      `--- checkPermission CALLED --- UserID: ${userId}, AssignmentID: ${assignmentId}, Action: ${action}`,
    );

    const user = await this.employeeRepository.findOneBy({ id: userId });
    if (!user) {
      console.error(`Permission check failed: User ${userId} not found.`);
      return false;
    }
    console.log(`User found:`, JSON.stringify(user, null, 2));

    const assignment = await this.kpiAssignmentRepository.findOne({
      where: { id: assignmentId },
      relations: ['section', 'department', 'section.department', 'employee'],
    });

    if (!assignment) {
      console.error(
        `Permission check failed: Assignment ${assignmentId} not found.`,
      );
      return false;
    }
    console.log(`Assignment found:`, JSON.stringify(assignment, null, 2));

    let effectiveTargetSectionId: number | null | undefined =
      assignment.assigned_to_section;
    let effectiveTargetDepartmentId: number | null | undefined =
      assignment.assigned_to_department;

    if (assignment.assigned_to_employee && assignment.employee) {
      if (
        effectiveTargetSectionId === null ||
        effectiveTargetSectionId === undefined
      ) {
        effectiveTargetSectionId = assignment.employee.sectionId;
      }

      if (
        effectiveTargetDepartmentId === null ||
        effectiveTargetDepartmentId === undefined
      ) {
        effectiveTargetDepartmentId = assignment.employee.departmentId;
      }
    } else if (
      assignment.assigned_to_section &&
      assignment.section?.department?.id
    ) {
      if (
        effectiveTargetDepartmentId === null ||
        effectiveTargetDepartmentId === undefined
      ) {
        effectiveTargetDepartmentId = assignment.section.department.id;
      }
    }

    console.log(
      `Effective Target Section ID: ${effectiveTargetSectionId}, Effective Target Department ID: ${effectiveTargetDepartmentId}`,
    );

    let hasRequiredRole = false;

    switch (action) {
      case 'SECTION_APPROVE':
      case 'SECTION_REJECT':
        if (!effectiveTargetSectionId) {
          console.error(
            `Permission Check [${action}]: No effective target section ID found for assignment ${assignmentId}. Denying.`,
          );
          hasRequiredRole = false;
        } else {
          const isLeaderOfSection =
            user.role === 'leader' &&
            user.sectionId === effectiveTargetSectionId;
          const isManager = user.role === 'manager';
          const isAdmin = user.role === 'admin';
          hasRequiredRole = isLeaderOfSection || isManager || isAdmin;

          console.log(`--- Permission Check [${action}] Details ---`);
          console.log(
            `- User Role: ${user.role}, User Section: ${user.sectionId}`,
          );
          console.log(
            `- Effective Target Section ID: ${effectiveTargetSectionId}`,
          );
          console.log(`- Is Leader of Section? ${isLeaderOfSection}`);
          console.log(`- Is Manager? ${isManager}`);
          console.log(`- Is Admin? ${isAdmin}`);
          console.log(
            `- Final Permission Result for Section Action: ${hasRequiredRole}`,
          );
        }
        break;

      case 'DEPT_APPROVE':
      case 'DEPT_REJECT':
        if (!effectiveTargetDepartmentId) {
          console.error(
            `Permission Check [${action}]: No effective target department ID found for assignment ${assignmentId}. Denying.`,
          );
          hasRequiredRole = false;
        } else {
          const isManagerOfDept =
            user.role === 'manager' &&
            user.departmentId === effectiveTargetDepartmentId;
          const isAdmin = user.role === 'admin';
          hasRequiredRole = isManagerOfDept || isAdmin;

          console.log(`--- Permission Check [${action}] Details ---`);
          console.log(
            `- User Role: ${user.role}, User Department: ${user.departmentId}`,
          );
          console.log(
            `- Effective Target Department ID: ${effectiveTargetDepartmentId}`,
          );
          console.log(`- Is Manager of Department? ${isManagerOfDept}`);
          console.log(`- Is Admin? ${isAdmin}`);
          console.log(
            `- Final Permission Result for Dept Action: ${hasRequiredRole}`,
          );
        }
        break;

      case 'MANAGER_APPROVE':
      case 'MANAGER_REJECT':
        const isManager = user.role === 'manager';
        const isAdmin = user.role === 'admin';
        hasRequiredRole = isManager || isAdmin;

        console.log(`--- Permission Check [${action}] Details ---`);
        console.log(`- User Role: ${user.role}`);
        console.log(`- Is Manager? ${isManager}`);
        console.log(`- Is Admin? ${isAdmin}`);
        console.log(
          `- Final Permission Result for Manager Action: ${hasRequiredRole}`,
        );
        break;

      default:
        console.warn(
          `Permission check: Unknown action '${action}'. Denying access.`,
        );
        hasRequiredRole = false;
        break;
    }

    if (!hasRequiredRole) {
      console.warn(
        `--- Access DENIED by checkPermission --- UserID: ${userId}, AssignmentID: ${assignmentId}, Action: ${action}`,
      );
    } else {
      console.log(
        `--- Access GRANTED by checkPermission --- UserID: ${userId}, AssignmentID: ${assignmentId}, Action: ${action}`,
      );
    }

    return hasRequiredRole;
  }

  private async logWorkflowHistory(
    kpiValue: KpiValue,
    statusBefore: KpiValueStatus | null | undefined,
    action: string,
    changedById: number,
    reason?: string,
  ): Promise<void> {
    const assignment =
      kpiValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: kpiValue.kpi_assigment_id,
      }));

    const historyEntryData = {
      kpi_value_id: kpiValue.id,
      kpi_assigment_id: kpiValue.kpi_assigment_id,
      kpi_id: assignment?.kpi_id,
      value: kpiValue.value,
      timestamp: kpiValue.timestamp,
      notes: reason
        ? `Action: ${action}. Reason: ${reason}`
        : `Action: ${action}.`,
      reason: reason ?? null,
      status_before: statusBefore ?? null,
      status_after: kpiValue.status,
      action: action,
      changed_by: changedById,
      changed_at: new Date(),
    };
    const historyEntry = this.kpiValueHistoryRepository.create(
      historyEntryData as DeepPartial<KpiValueHistory>,
    );
    try {
      await this.kpiValueHistoryRepository.save(historyEntry);
    } catch (historyError) {
      console.error(
        `Failed to save KPI Value history for value ID ${kpiValue.id}:`,
        historyError,
      );
    }
  }

  async getPendingApprovals(user: Employee): Promise<KpiValue[]> {
    console.log(
      '--- getPendingApprovals called for user:',
      JSON.stringify(user, null, 2),
    );
    if (!user || !user.role) {
      console.error('getPendingApprovals: Invalid user object received.');
      throw new UnauthorizedException(
        'Invalid user data for fetching pending approvals.',
      );
    }

    const query = this.kpiValuesRepository
      .createQueryBuilder('kpiValue')
      .innerJoinAndSelect('kpiValue.kpiAssignment', 'assignment')
      .leftJoinAndSelect('assignment.kpi', 'kpi')
      .leftJoinAndSelect('assignment.employee', 'assignedEmployee')
      .leftJoinAndSelect('assignment.section', 'assignedSection')
      .leftJoinAndSelect('assignment.department', 'assignedDepartment')
      .leftJoinAndSelect(
        'assignedSection.department',
        'departmentOfAssignedSection',
      )
      .leftJoinAndSelect('assignedEmployee.section', 'employeeSection')
      .leftJoinAndSelect('assignedEmployee.department', 'employeeDepartment')
      .leftJoinAndSelect('kpi.perspective', 'perspective');

    switch (user.role) {
      case 'leader':
        console.log(
          `Applying filter for role: leader, sectionId: ${user.sectionId}`,
        );
        if (!user.sectionId) {
          console.warn('Leader user has no sectionId, returning empty array.');
          return [];
        }
        query
          .where('kpiValue.status = :status', {
            status: KpiValueStatus.PENDING_SECTION_APPROVAL,
          })
          .andWhere(
            new Brackets((qb) => {
              qb.where('assignment.assigned_to_section = :sectionId', {
                sectionId: user.sectionId,
              })

                .orWhere('assignedEmployee.sectionId = :sectionId', {
                  sectionId: user.sectionId,
                });
            }),
          );
        break;

      case 'manager':
        console.log(
          `Applying filter for role: manager, departmentId: ${user.departmentId}, sectionId: ${user.sectionId}`,
        );

        if (user.departmentId && !user.sectionId) {
          console.log('Applying filter for Dept Manager');
          query
            .where('kpiValue.status = :status', {
              status: KpiValueStatus.PENDING_DEPT_APPROVAL,
            })
            .andWhere(
              new Brackets((qb) => {
                qb.where('assignment.assigned_to_department = :deptId', {
                  deptId: user.departmentId,
                })

                  .orWhere('departmentOfAssignedSection.id = :deptId', {
                    deptId: user.departmentId,
                  })

                  .orWhere('assignedEmployee.departmentId = :deptId', {
                    deptId: user.departmentId,
                  });
              }),
            );
        } else {
          console.log('Applying filter for Final Manager');
          query.where('kpiValue.status = :status', {
            status: KpiValueStatus.PENDING_MANAGER_APPROVAL,
          });
        }
        break;

      case 'admin':
        console.log('Applying filter for role: admin (all pending)');
        query.where('kpiValue.status IN (:...statuses)', {
          statuses: [
            KpiValueStatus.PENDING_SECTION_APPROVAL,
            KpiValueStatus.PENDING_DEPT_APPROVAL,
            KpiValueStatus.PENDING_MANAGER_APPROVAL,
          ],
        });
        break;

      default:
        console.log(
          `No pending approvals logic defined for role: ${user.role}`,
        );
        return [];
    }

    query.orderBy('kpiValue.timestamp', 'ASC');

    try {
      console.log('SQL Query:', query.getSql());
      console.log('Parameters:', query.getParameters());
      const results = await query.getMany();
      console.log(`Found ${results.length} pending approvals.`);
      return results;
    } catch (error) {
      console.error('Error executing getPendingApprovals query:', error);
      throw error;
    }
  }
}
