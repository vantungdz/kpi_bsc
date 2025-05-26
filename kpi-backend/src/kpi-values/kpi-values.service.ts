import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
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

        const submitter = await transactionalEntityManager
          .getRepository(Employee)
          .findOne({ where: { id: userId }, relations: ['role'] });
        if (!submitter) {
          throw new UnauthorizedException('Submitter information not found.');
        }

        let initialStatusAfterSubmit: KpiValueStatus;

        // Lấy danh sách role name
        const userRoles: string[] = Array.isArray(submitter.roles)
          ? submitter.roles.map((r: any) =>
              typeof r === 'string' ? r : r?.name,
            )
          : [];
        // Ưu tiên quyền cao nhất
        if (userRoles.includes('admin') || userRoles.includes('manager')) {
          initialStatusAfterSubmit = KpiValueStatus.APPROVED;
        } else if (userRoles.includes('department')) {
          initialStatusAfterSubmit = KpiValueStatus.PENDING_MANAGER_APPROVAL;
        } else if (userRoles.includes('section')) {
          initialStatusAfterSubmit = KpiValueStatus.PENDING_DEPT_APPROVAL;
        } else {
          initialStatusAfterSubmit = KpiValueStatus.PENDING_SECTION_APPROVAL;
        }

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

        if (assignment.kpi) {
          if (
            savedKpiValue.status === KpiValueStatus.PENDING_SECTION_APPROVAL
          ) {
            this.eventEmitter.emit('kpi_value.submitted_for_section_approval', {
              kpiValue: savedKpiValue,
              submitter: submitter,
              kpiName: assignment.kpi.name,
              assignmentId: assignment.id,
              kpiId: assignment.kpi_id,
            });
          } else if (
            savedKpiValue.status === KpiValueStatus.PENDING_DEPT_APPROVAL
          ) {
            this.eventEmitter.emit('kpi_value.submitted_for_dept_approval', {
              kpiValue: savedKpiValue,
              submitter,
              kpiName: assignment.kpi.name,
              assignmentId: assignment.id,
              kpiId: assignment.kpi_id,
            });
          } else if (
            savedKpiValue.status === KpiValueStatus.PENDING_MANAGER_APPROVAL
          ) {
            this.eventEmitter.emit('kpi_value.submitted_for_manager_approval', {
              kpiValue: savedKpiValue,
              submitter,
              kpiName: assignment.kpi.name,
              assignmentId: assignment.id,
              kpiId: assignment.kpi_id,
            });
          }
        }

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
    const user = await this.employeeRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });
    if (!user) {
      throw new UnauthorizedException('Approving user not found.');
    }
    const assignment =
      kpiValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: kpiValue.kpi_assigment_id,
      }));
    const canApprove = await this.hasDynamicRole(
      user,
      'kpi-value',
      'approve',
      'section',
      assignment,
    );
    if (!canApprove) {
      throw new UnauthorizedException(
        'User does not have permission for section approval.',
      );
    }
    if (kpiValue.status !== KpiValueStatus.PENDING_SECTION_APPROVAL) {
      throw new BadRequestException(
        `Cannot perform Section Approval on value with status '${kpiValue.status}'. Expected '${KpiValueStatus.PENDING_SECTION_APPROVAL}'.`,
      );
    }
    // Quyết định trạng thái tiếp theo
    const userRoles: string[] = Array.isArray(user.roles)
      ? user.roles.map((r: any) => (typeof r === 'string' ? r : r?.name))
      : [];
    const newStatus =
      userRoles.includes('manager') || userRoles.includes('admin')
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
    await this.logWorkflowHistory(
      savedValue,
      statusBefore,
      'APPROVE_SECTION',
      userId,
    );

    const assignmentFound =
      savedValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: savedValue.kpi_assigment_id,
      }));
    if (savedValue.status === KpiValueStatus.APPROVED) {
      if (assignmentFound && typeof assignmentFound.kpi_id === 'number') {
        this.eventEmitter.emit('kpi_value.approved', {
          kpiId: assignmentFound.kpi_id,
        });
      }
      if (
        assignmentFound &&
        assignmentFound.employee_id &&
        assignmentFound.employee_id !== userId
      ) {
        this.eventEmitter.emit('kpi_value.approved_by_user', {
          kpiValue: savedValue,
          submitterId: assignmentFound.employee_id,
          kpiName: assignmentFound.kpi?.name || '',
        });
      }
    } else if (savedValue.status === KpiValueStatus.PENDING_DEPT_APPROVAL) {
      const submitter = assignmentFound?.employee_id
        ? await this.employeeRepository.findOne({
            where: { id: assignmentFound.employee_id },
          })
        : null;
      if (submitter && assignmentFound?.kpi) {
        this.eventEmitter.emit('kpi_value.submitted_for_dept_approval', {
          kpiValue: savedValue,
          submitter,
          kpiName: assignmentFound.kpi.name,
          assignmentId: assignmentFound.id,
          kpiId: assignmentFound.kpi_id,
        });
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
    const user = await this.employeeRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });
    if (!user) throw new UnauthorizedException('Rejecting user not found.');
    const assignment =
      kpiValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: kpiValue.kpi_assigment_id,
      }));
    const canReject = await this.hasDynamicRole(
      user,
      'kpi-value',
      'reject',
      'section',
      assignment,
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
    // Quyết định trạng thái tiếp theo
    const userRoles: string[] = Array.isArray(user.roles)
      ? user.roles.map((r: any) => (typeof r === 'string' ? r : r?.name))
      : [];
    let newStatus: KpiValueStatus;
    let logAction: string;
    if (userRoles.includes('admin') || userRoles.includes('manager')) {
      newStatus = KpiValueStatus.REJECTED_BY_MANAGER;
      logAction = 'REJECT_MANAGER';
    } else if (userRoles.includes('department')) {
      newStatus = KpiValueStatus.REJECTED_BY_DEPT;
      logAction = 'REJECT_DEPT';
    } else {
      newStatus = KpiValueStatus.REJECTED_BY_SECTION;
      logAction = 'REJECT_SECTION';
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
    const rejectedValue = await this.kpiValuesRepository.save(kpiValue);
    const assignmentFound =
      rejectedValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: rejectedValue.kpi_assigment_id,
      }));
    if (assignmentFound && assignmentFound.employee_id) {
      this.eventEmitter.emit('kpi_value.rejected_by_user', {
        kpiValue: rejectedValue,
        submitterId: assignmentFound.employee_id,
        kpiName: assignmentFound.kpi?.name || '',
        reason,
      });
    }
    return rejectedValue;
  }

  async approveValueByDepartment(
    valueId: number,
    userId: number,
  ): Promise<KpiValue> {
    const kpiValue = await this.findKpiValueForWorkflow(valueId);
    const statusBefore = kpiValue.status;
    const user = await this.employeeRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!user) {
      throw new UnauthorizedException('Approving user not found.');
    }
    const assignment =
      kpiValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: kpiValue.kpi_assigment_id,
      }));
    const canApprove = await this.hasDynamicRole(
      user,
      'kpi-value',
      'approve',
      'department',
      assignment,
    );
    if (!canApprove) {
      throw new UnauthorizedException(
        'User does not have permission for department approval.',
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
    const userRoles: string[] = Array.isArray(user.roles)
      ? user.roles.map((r: any) => (typeof r === 'string' ? r : r?.name))
      : [];
    const newStatus =
      userRoles.includes('manager') || userRoles.includes('admin')
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
    await this.logWorkflowHistory(
      savedValue,
      statusBefore,
      'APPROVE_DEPT',
      userId,
    );

    const assignmentFound =
      savedValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: savedValue.kpi_assigment_id,
      }));

    if (savedValue.status === KpiValueStatus.APPROVED) {
      if (assignmentFound && typeof assignmentFound.kpi_id === 'number') {
        this.eventEmitter.emit('kpi_value.approved', {
          kpiId: assignmentFound.kpi_id,
        });
      }
      if (
        assignmentFound &&
        assignmentFound.employee_id &&
        assignmentFound.employee_id !== userId
      ) {
        this.eventEmitter.emit('kpi_value.approved_by_user', {
          kpiValue: savedValue,
          submitterId: assignmentFound.employee_id,
          kpiName: assignmentFound.kpi?.name || '',
        });
      }
    } else if (savedValue.status === KpiValueStatus.PENDING_MANAGER_APPROVAL) {
      const submitter = assignmentFound?.employee_id
        ? await this.employeeRepository.findOne({
            where: { id: assignmentFound.employee_id },
          })
        : null;
      if (submitter && assignmentFound?.kpi) {
        this.eventEmitter.emit('kpi_value.submitted_for_manager_approval', {
          kpiValue: savedValue,
          submitter,
          kpiName: assignmentFound.kpi.name,
          assignmentId: assignmentFound.id,
          kpiId: assignmentFound.kpi_id,
        });
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
    const user = await this.employeeRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!user) throw new UnauthorizedException('Rejecting user not found.');
    const assignment =
      kpiValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: kpiValue.kpi_assigment_id,
      }));
    const canReject = await this.hasDynamicRole(
      user,
      'kpi-value',
      'reject',
      'department',
      assignment,
    );
    if (!canReject) {
      throw new UnauthorizedException(
        'User does not have permission for Department level rejection.',
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
    const userRoles: string[] = Array.isArray(user.roles)
      ? user.roles.map((r: any) => (typeof r === 'string' ? r : r?.name))
      : [];
    let newStatus: KpiValueStatus;
    let logAction: string;
    if (userRoles.includes('admin') || userRoles.includes('manager')) {
      newStatus = KpiValueStatus.REJECTED_BY_MANAGER;
      logAction = 'REJECT_MANAGER';
    } else if (userRoles.includes('department')) {
      newStatus = KpiValueStatus.REJECTED_BY_DEPT;
      logAction = 'REJECT_DEPT';
    } else {
      newStatus = KpiValueStatus.REJECTED_BY_SECTION;
      logAction = 'REJECT_SECTION';
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
    const rejectedValue = await this.kpiValuesRepository.save(kpiValue);
    const assignmentFound =
      rejectedValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: rejectedValue.kpi_assigment_id,
      }));
    if (assignmentFound && assignmentFound.employee_id) {
      this.eventEmitter.emit('kpi_value.rejected_by_user', {
        kpiValue: rejectedValue,
        submitterId: assignmentFound.employee_id,
        kpiName: assignmentFound.kpi?.name || '',
        reason,
      });
    }
    return rejectedValue;
  }

  async approveValueByManager(
    valueId: number,
    userId: number,
  ): Promise<KpiValue> {
    const kpiValue = await this.findKpiValueForWorkflow(valueId);
    const statusBefore = kpiValue.status;
    const user = await this.employeeRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!user) {
      throw new UnauthorizedException('Approving user not found.');
    }
    const assignment =
      kpiValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: kpiValue.kpi_assigment_id,
      }));
    const canApprove = await this.hasDynamicRole(
      user,
      'kpi-value',
      'approve',
      'manager',
      assignment,
    );
    if (!canApprove) {
      throw new UnauthorizedException(
        'User does not have permission for manager approval.',
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
        `Cannot perform final Manager Approval on value with status '${kpiValue.status}'. Expected a pending status.`,
      );
    }
    kpiValue.status = KpiValueStatus.APPROVED;
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = userId;
    kpiValue.rejection_reason = null;
    await this.logWorkflowHistory(
      kpiValue,
      statusBefore,
      'APPROVE_MANAGER',
      userId,
    );
    const savedValue = await this.kpiValuesRepository.save(kpiValue);
    await this.logWorkflowHistory(
      savedValue,
      statusBefore,
      'APPROVE_MANAGER',
      userId,
    );

    const assignmentFound =
      savedValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: savedValue.kpi_assigment_id,
      }));
    if (assignmentFound && typeof assignmentFound.kpi_id === 'number') {
      this.eventEmitter.emit('kpi_value.approved', {
        kpiId: assignmentFound.kpi_id,
      });
    }
    if (
      assignmentFound &&
      assignmentFound.employee_id &&
      assignmentFound.employee_id !== userId
    ) {
      this.eventEmitter.emit('kpi_value.approved_by_user', {
        kpiValue: savedValue,
        submitterId: assignmentFound.employee_id,
        kpiName: assignmentFound.kpi?.name || '',
      });
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
    const user = await this.employeeRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!user) throw new UnauthorizedException('Rejecting user not found.');
    const assignment =
      kpiValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: kpiValue.kpi_assigment_id,
      }));
    const canReject = await this.hasDynamicRole(
      user,
      'kpi-value',
      'reject',
      'manager',
      assignment,
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
    const userRoles: string[] = Array.isArray(user.roles)
      ? user.roles.map((r: any) => (typeof r === 'string' ? r : r?.name))
      : [];
    let newStatus: KpiValueStatus;
    let logAction: string;
    if (userRoles.includes('admin') || userRoles.includes('manager')) {
      newStatus = KpiValueStatus.REJECTED_BY_MANAGER;
      logAction = 'REJECT_MANAGER';
    } else {
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
    const rejectedValue = await this.kpiValuesRepository.save(kpiValue);

    const assignmentFound =
      rejectedValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: rejectedValue.kpi_assigment_id,
      }));
    if (assignmentFound?.employee_id) {
      this.eventEmitter.emit('kpi_value.rejected_by_user', {
        kpiValue: rejectedValue,
        submitterId: assignmentFound.employee_id,
        kpiName: assignmentFound.kpi?.name || '',
        reason,
      });
    }

    return rejectedValue;
  }

  async approveKpiReview(
    id: number,
    approverRoles: string[],
  ): Promise<KpiValue> {
    const kpiValue = await this.findOne(id);
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found.`);
    }
    // Ưu tiên quyền cao nhất
    if (approverRoles.includes('admin') || approverRoles.includes('manager')) {
      kpiValue.status = KpiValueStatus.APPROVED;
    } else if (approverRoles.includes('department')) {
      kpiValue.status = KpiValueStatus.PENDING_MANAGER_APPROVAL;
    } else if (approverRoles.includes('section')) {
      kpiValue.status = KpiValueStatus.PENDING_DEPT_APPROVAL;
    } else {
      throw new BadRequestException('Invalid approver role.');
    }
    return await this.kpiValuesRepository.save(kpiValue);
  }

  async rejectKpiReview(
    id: number,
    approverRoles: string[],
  ): Promise<KpiValue> {
    const kpiValue = await this.findOne(id);
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found.`);
    }
    if (approverRoles.includes('admin') || approverRoles.includes('manager')) {
      kpiValue.status = KpiValueStatus.REJECTED_BY_MANAGER;
    } else if (approverRoles.includes('department')) {
      kpiValue.status = KpiValueStatus.REJECTED_BY_DEPT;
    } else if (approverRoles.includes('section')) {
      kpiValue.status = KpiValueStatus.REJECTED_BY_SECTION;
    } else {
      throw new BadRequestException('Invalid approver role.');
    }
    return await this.kpiValuesRepository.save(kpiValue);
  }

  async resubmitKpiReview(id: number): Promise<KpiValue> {
    const kpiValue = await this.findOne(id);
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found.`);
    }

    if (
      kpiValue.status !== KpiValueStatus.REJECTED_BY_SECTION &&
      kpiValue.status !== KpiValueStatus.REJECTED_BY_DEPT &&
      kpiValue.status !== KpiValueStatus.REJECTED_BY_MANAGER
    ) {
      throw new BadRequestException(
        'Only rejected KPI reviews can be resubmitted.',
      );
    }

    kpiValue.status = KpiValueStatus.RESUBMITTED;
    return await this.kpiValuesRepository.save(kpiValue);
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

  // Helper kiểm tra quyền động resource:action:scope
  private async hasDynamicRole(
    user: Employee,
    resource: string,
    action: string,
    scope: string,
    assignment?: any,
  ): Promise<boolean> {
    if (!user || !user.roles) return false;
    const userRoles: string[] = Array.isArray(user.roles)
      ? user.roles.map((r: any) => (typeof r === 'string' ? r : r?.name))
      : [];
    // Admin/manager luôn có quyền
    if (userRoles.includes('admin') || userRoles.includes('manager'))
      return true;
    // Gom nhóm scope
    if (scope === 'section') {
      return (
        userRoles.includes('section') &&
        user.sectionId &&
        assignment &&
        (assignment.assigned_to_section === user.sectionId ||
          assignment.employee?.sectionId === user.sectionId)
      );
    }
    if (scope === 'department') {
      return (
        userRoles.includes('department') &&
        user.departmentId &&
        assignment &&
        (assignment.assigned_to_department === user.departmentId ||
          assignment.employee?.departmentId === user.departmentId ||
          assignment.section?.department?.id === user.departmentId)
      );
    }
    return false;
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
    } catch (historyError) {}
  }

  async getPendingApprovals(user: Employee): Promise<KpiValue[]> {
    if (
      !user ||
      !user.roles ||
      !Array.isArray(user.roles) ||
      user.roles.length === 0
    ) {
      throw new UnauthorizedException(
        'Invalid user data for fetching pending approvals.',
      );
    }
    const userRoles: string[] = user.roles.map((r: any) =>
      typeof r === 'string' ? r : r?.name,
    );
    // Ưu tiên quyền cao nhất: admin > manager > department > section
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

    // Định nghĩa filter cho từng role
    const roleFilters: Record<string, () => void> = {
      section: () => {
        if (!user.sectionId) return;
        query
          .where('kpiValue.status = :status', {
            status: KpiValueStatus.PENDING_SECTION_APPROVAL,
          })
          .andWhere(
            new Brackets((qb) => {
              qb.where('assignment.assigned_to_section = :sectionId', {
                sectionId: user.sectionId,
              }).orWhere('assignedEmployee.sectionId = :sectionId', {
                sectionId: user.sectionId,
              });
            }),
          );
      },
      department: () => {
        if (!user.departmentId) return;
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
      },
      manager: () => {
        query.where('kpiValue.status = :status', {
          status: KpiValueStatus.PENDING_MANAGER_APPROVAL,
        });
      },
      admin: () => {
        query.where('kpiValue.status IN (:...statuses)', {
          statuses: [
            KpiValueStatus.PENDING_SECTION_APPROVAL,
            KpiValueStatus.PENDING_DEPT_APPROVAL,
            KpiValueStatus.PENDING_MANAGER_APPROVAL,
          ],
        });
      },
    };

    // Ưu tiên quyền cao nhất
    let applied = false;
    if (userRoles.includes('admin')) {
      roleFilters.admin();
      applied = true;
    } else if (userRoles.includes('manager')) {
      roleFilters.manager();
      applied = true;
    } else if (userRoles.includes('department')) {
      roleFilters.department();
      applied = true;
    } else if (userRoles.includes('section')) {
      roleFilters.section();
      applied = true;
    }
    if (!applied) {
      return [];
    }
    query.orderBy('kpiValue.timestamp', 'ASC');
    try {
      const results = await query.getMany();
      return results;
    } catch (error) {
      throw error;
    }
  }
}
