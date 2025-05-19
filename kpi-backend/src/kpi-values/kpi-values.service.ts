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
          .findOneBy({ id: userId });
        if (!submitter) {
          throw new UnauthorizedException('Submitter information not found.');
        }

        let initialStatusAfterSubmit: KpiValueStatus;

        const roleName = typeof submitter.role === 'string' ? submitter.role : submitter.role?.name ?? '';
        switch (roleName) {
          case 'admin':
          case 'manager':
            initialStatusAfterSubmit = KpiValueStatus.APPROVED;
            break;
          case 'department':
            initialStatusAfterSubmit = KpiValueStatus.PENDING_MANAGER_APPROVAL;
            break;
          case 'section':
            initialStatusAfterSubmit = KpiValueStatus.PENDING_DEPT_APPROVAL;
            break;
          case 'employee':
          default:
            initialStatusAfterSubmit = KpiValueStatus.PENDING_SECTION_APPROVAL;
            break;
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

    const roleName = typeof user.role === 'string' ? user.role : user.role?.name ?? '';
    const newStatus =
      roleName === 'manager' || roleName === 'admin'
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

    const assignment =
      savedValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: savedValue.kpi_assigment_id,
      }));

    if (savedValue.status === KpiValueStatus.APPROVED) {
      if (assignment && typeof assignment.kpi_id === 'number') {
        this.eventEmitter.emit('kpi_value.approved', {
          kpiId: assignment.kpi_id,
        });
      }
      if (
        assignment &&
        assignment.employee_id &&
        assignment.employee_id !== userId
      ) {
        this.eventEmitter.emit('kpi_value.approved_by_user', {
          kpiValue: savedValue,
          submitterId: assignment.employee_id,
          kpiName: assignment.kpi?.name || '',
        });
      }
    } else if (savedValue.status === KpiValueStatus.PENDING_DEPT_APPROVAL) {
      const submitter = assignment?.employee_id
        ? await this.employeeRepository.findOneBy({
            id: assignment.employee_id,
          })
        : null;
      if (submitter && assignment?.kpi) {
        this.eventEmitter.emit('kpi_value.submitted_for_dept_approval', {
          kpiValue: savedValue,
          submitter,
          kpiName: assignment.kpi.name,
          assignmentId: assignment.id,
          kpiId: assignment.kpi_id,
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
    const roleName = typeof user.role === 'string' ? user.role : user.role?.name ?? '';
    if (roleName === 'admin' || roleName === 'manager') {
      newStatus = KpiValueStatus.REJECTED_BY_MANAGER;
      logAction = 'REJECT_MANAGER';
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
    const assignment =
      rejectedValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: rejectedValue.kpi_assigment_id,
      }));
    if (assignment && assignment.employee_id) {
      this.eventEmitter.emit('kpi_value.rejected_by_user', {
        kpiValue: rejectedValue,
        submitterId: assignment.employee_id,
        kpiName: assignment.kpi?.name || '',
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
        'User does not have permission for Department level approval.',
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

    const roleName = typeof user.role === 'string' ? user.role : user.role?.name ?? '';
    const newStatus =
      roleName === 'manager' || roleName === 'admin'
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

    const assignment =
      savedValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: savedValue.kpi_assigment_id,
      }));

    if (savedValue.status === KpiValueStatus.APPROVED) {
      if (assignment && typeof assignment.kpi_id === 'number') {
        this.eventEmitter.emit('kpi_value.approved', {
          kpiId: assignment.kpi_id,
        });
      }
      if (
        assignment &&
        assignment.employee_id &&
        assignment.employee_id !== userId
      ) {
        this.eventEmitter.emit('kpi_value.approved_by_user', {
          kpiValue: savedValue,
          submitterId: assignment.employee_id,
          kpiName: assignment.kpi?.name || '',
        });
      }
    } else if (savedValue.status === KpiValueStatus.PENDING_MANAGER_APPROVAL) {
      const submitter = assignment?.employee_id
        ? await this.employeeRepository.findOneBy({
            id: assignment.employee_id,
          })
        : null;
      if (submitter && assignment?.kpi) {
        this.eventEmitter.emit('kpi_value.submitted_for_manager_approval', {
          kpiValue: savedValue,
          submitter,
          kpiName: assignment.kpi.name,
          assignmentId: assignment.id,
          kpiId: assignment.kpi_id,
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
    const user = await this.employeeRepository.findOneBy({ id: userId });

    if (!user) throw new UnauthorizedException('Rejecting user not found.');

    const canReject = await this.checkPermission(
      userId,
      kpiValue.kpi_assigment_id,
      'DEPT_REJECT',
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

    let newStatus: KpiValueStatus;
    let logAction: string;
    const roleName = typeof user.role === 'string' ? user.role : user.role?.name ?? '';
    if (roleName === 'admin' || roleName === 'manager') {
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
    const assignment =
      rejectedValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: rejectedValue.kpi_assigment_id,
      }));
    if (assignment && assignment.employee_id) {
      this.eventEmitter.emit('kpi_value.rejected_by_user', {
        kpiValue: rejectedValue,
        submitterId: assignment.employee_id,
        kpiName: assignment.kpi?.name || '',
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
    const user = await this.employeeRepository.findOneBy({ id: userId });

    if (!user) {
      throw new UnauthorizedException('Approving user not found.');
    }

    const canApprove = await this.checkPermission(
      userId,
      kpiValue.kpi_assigment_id,
      'MANAGER_APPROVE',
    );
    if (!canApprove) {
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
      throw new BadRequestException(
        `Cannot perform final Manager Approval on value with status '${kpiValue.status}'. Expected a pending status.`,
      );
    }
    const newStatus = KpiValueStatus.APPROVED;

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

    const savedValue = await this.kpiValuesRepository.save(kpiValue);
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
      this.eventEmitter.emit('kpi_value.approved', {
        kpiId: assignment.kpi_id,
      });
    }
    if (
      assignment &&
      assignment.employee_id &&
      assignment.employee_id !== userId
    ) {
      this.eventEmitter.emit('kpi_value.approved_by_user', {
        kpiValue: savedValue,
        submitterId: assignment.employee_id,
        kpiName: assignment.kpi?.name || '',
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

    const assignment =
      rejectedValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: rejectedValue.kpi_assigment_id,
      }));
    if (assignment?.employee_id) {
      this.eventEmitter.emit('kpi_value.rejected_by_user', {
        kpiValue: rejectedValue,
        submitterId: assignment.employee_id,
        kpiName: assignment.kpi?.name || '',
        reason,
      });
    }

    return rejectedValue;
  }

  async approveKpiReview(id: number, approverRole: string): Promise<KpiValue> {
    const kpiValue = await this.findOne(id);
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found.`);
    }

    switch (approverRole) {
      case 'SECTION':
        kpiValue.status = KpiValueStatus.PENDING_DEPT_APPROVAL;
        break;
      case 'DEPARTMENT':
        kpiValue.status = KpiValueStatus.PENDING_MANAGER_APPROVAL;
        break;
      case 'MANAGER':
        kpiValue.status = KpiValueStatus.APPROVED;
        break;
      default:
        throw new BadRequestException('Invalid approver role.');
    }

    return await this.kpiValuesRepository.save(kpiValue);
  }

  async rejectKpiReview(id: number, approverRole: string): Promise<KpiValue> {
    const kpiValue = await this.findOne(id);
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found.`);
    }

    switch (approverRole) {
      case 'SECTION':
        kpiValue.status = KpiValueStatus.REJECTED_BY_SECTION;
        break;
      case 'DEPARTMENT':
        kpiValue.status = KpiValueStatus.REJECTED_BY_DEPT;
        break;
      case 'MANAGER':
        kpiValue.status = KpiValueStatus.REJECTED_BY_MANAGER;
        break;
      default:
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
      throw new BadRequestException('Only rejected KPI reviews can be resubmitted.');
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

  private async checkPermission(
    userId: number,
    assignmentId: number,
    action: string,
  ): Promise<boolean> {
    const user = await this.employeeRepository.findOneBy({ id: userId });
    if (!user) {
      return false;
    }

    const assignment = await this.kpiAssignmentRepository.findOne({
      where: { id: assignmentId },
      relations: ['section', 'department', 'section.department', 'employee'],
    });

    if (!assignment) {
      return false;
    }

    const effectiveTargetSectionId =
      assignment.assigned_to_section || assignment.employee?.sectionId;
    const effectiveTargetDepartmentId =
      assignment.assigned_to_department || assignment.employee?.departmentId;

    let hasRequiredRole = false;

    switch (action) {
      case 'SECTION_APPROVE':
      case 'SECTION_REJECT': {
        const userRoleName = typeof user.role === 'string' ? user.role : user.role?.name ?? '';
        if (userRoleName === 'section') {
          hasRequiredRole = user.sectionId === effectiveTargetSectionId;
        } else if (userRoleName === 'department') {
          hasRequiredRole =
            (assignment.section?.department.id === user.departmentId &&
              effectiveTargetSectionId === assignment.section.id) ||
            (user.departmentId === effectiveTargetDepartmentId &&
              assignment.assigned_to_department === user.departmentId);
        } else if (userRoleName === 'manager' || userRoleName === 'admin') {
          hasRequiredRole = true;
        }
        break;
      }
      case 'DEPT_APPROVE':
      case 'DEPT_REJECT': {
        const userRoleName = typeof user.role === 'string' ? user.role : user.role?.name ?? '';
        if (userRoleName === 'department') {
          hasRequiredRole = user.departmentId === effectiveTargetDepartmentId;
        } else if (userRoleName === 'manager' || userRoleName === 'admin') {
          hasRequiredRole = true;
        }
        break;
      }
      case 'MANAGER_APPROVE':
      case 'MANAGER_REJECT': {
        const userRoleName = typeof user.role === 'string' ? user.role : user.role?.name ?? '';
        hasRequiredRole = userRoleName === 'manager' || userRoleName === 'admin';
        break;
      }
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
    } catch (historyError) {}
  }

  async getPendingApprovals(user: Employee): Promise<KpiValue[]> {
    if (!user || !user.role) {
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
      .leftJoinAndSelect('assignedSection.department', 'departmentOfAssignedSection')
      .leftJoinAndSelect('assignedEmployee.section', 'employeeSection')
      .leftJoinAndSelect('assignedEmployee.department', 'employeeDepartment')
      .leftJoinAndSelect('kpi.perspective', 'perspective');

    const roleName = typeof user.role === 'string' ? user.role : user.role?.name ?? '';
    const roleFilters: Record<string, () => void> = {
      section: () => {
        if (!user.sectionId) {
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
              }).orWhere('assignedEmployee.sectionId = :sectionId', {
                sectionId: user.sectionId,
              });
            }),
          );
      },
      department: () => {
        if (!user.departmentId) {
          return [];
        }
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

    const applyFilter = roleFilters[roleName];
    if (!applyFilter) {
      return [];
    }

    applyFilter();

    query.orderBy('kpiValue.timestamp', 'ASC');

    try {
      const results = await query.getMany();
      return results;
    } catch (error) {
      throw error;
    }
  }
}
