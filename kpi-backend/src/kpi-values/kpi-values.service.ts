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
import { KpiValue, KpiValueStatus } from './entities/kpi-value.entity';
import { KpiValueHistory } from './entities/kpi-value-history.entity';
import { KPIAssignment } from '../kpi-assessments/entities/kpi-assignment.entity';
import { Employee } from '../employees/entities/employee.entity';
import { userHasPermission } from '../common/utils/permission.utils';
import { KpiDefinitionStatus } from '../kpis/entities/kpi.entity';
import { getKpiStatus } from '../kpis/kpis.service';

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
      relations: ['kpiAssignment', 'kpiAssignment.kpi'],
    });
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found`);
    }

    // Check if KPI has expired
    if (kpiValue.kpiAssignment?.kpi) {
      const kpiValidityStatus = getKpiStatus(
        kpiValue.kpiAssignment.kpi.start_date,
        kpiValue.kpiAssignment.kpi.end_date,
      );
      if (kpiValidityStatus === 'expired') {
        throw new BadRequestException(
          'Cannot update values for expired KPI. This KPI is no longer valid.',
        );
      }
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

        // Check if KPI has expired
        const kpiValidityStatus = getKpiStatus(
          assignment.kpi.start_date,
          assignment.kpi.end_date,
        );
        if (kpiValidityStatus === 'expired') {
          throw new BadRequestException(
            'Cannot update values for expired KPI. This KPI is no longer valid.',
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
          .findOne({
            where: { id: userId },
            relations: ['roles', 'roles.permissions'],
          });
        if (!submitter) {
          throw new UnauthorizedException('Submitter information not found.');
        }

        let initialStatusAfterSubmit: KpiValueStatus;

        if (userHasPermission(submitter, 'approve', 'kpi-value', 'manager')) {
          initialStatusAfterSubmit = KpiValueStatus.APPROVED;
        } else if (
          userHasPermission(submitter, 'approve', 'kpi-value', 'department')
        ) {
          initialStatusAfterSubmit = KpiValueStatus.PENDING_MANAGER_APPROVAL;
        } else if (
          userHasPermission(submitter, 'approve', 'kpi-value', 'section')
        ) {
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
      relations: ['roles', 'roles.permissions'],
    });
    if (!user) {
      throw new UnauthorizedException('Approving user not found.');
    }

    const assignment =
      kpiValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOne({
        where: { id: kpiValue.kpi_assigment_id },
        relations: ['employee', 'section', 'department'],
      }));

    // Check basic permission first
    let canApprove = userHasPermission(user, 'approve', 'kpi-value', 'section');

    // If no basic permission, check section-specific logic
    if (!canApprove && user.sectionId && assignment) {
      canApprove =
        userHasPermission(user, 'approve', 'kpi-value', 'section') &&
        (assignment.assigned_to_section === user.sectionId ||
          assignment.employee?.sectionId === user.sectionId);
    }

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

    const newStatus = userHasPermission(user, 'approve', 'kpi-value', 'manager')
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
      (await this.kpiAssignmentRepository.findOne({
        where: { id: savedValue.kpi_assigment_id },
        relations: ['kpi'],
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
      relations: ['roles', 'roles.permissions'],
    });
    if (!user) throw new UnauthorizedException('Rejecting user not found.');
    const assignment =
      kpiValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: kpiValue.kpi_assigment_id,
      }));
    // Check basic permission first
    let canReject = userHasPermission(user, 'reject', 'kpi-value', 'section');

    // If no basic permission, check section-specific logic
    if (!canReject && user.sectionId && assignment) {
      canReject =
        userHasPermission(user, 'reject', 'kpi-value', 'section') &&
        (assignment.assigned_to_section === user.sectionId ||
          assignment.employee?.sectionId === user.sectionId);
    }
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
    if (userHasPermission(user, 'reject', 'kpi-value', 'manager')) {
      newStatus = KpiValueStatus.REJECTED_BY_MANAGER;
      logAction = 'REJECT_MANAGER';
    } else if (userHasPermission(user, 'reject', 'kpi-value', 'department')) {
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
    const assignmentFound = await this.kpiAssignmentRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.kpi', 'kpi')
      .where('assignment.id = :id', { id: rejectedValue.kpi_assigment_id })
      .getOne();
    if (!assignmentFound) {
      console.error(
        'No assignment found for ID:',
        rejectedValue.kpi_assigment_id,
      );
    }
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
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new UnauthorizedException('Approving user not found.');
    }
    const assignment =
      kpiValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: kpiValue.kpi_assigment_id,
      }));
    // Check basic permission first
    let canApprove = userHasPermission(
      user,
      'approve',
      'kpi-value',
      'department',
    );

    // If no basic permission, check department-specific logic
    if (!canApprove && user.departmentId && assignment) {
      canApprove =
        userHasPermission(user, 'approve', 'kpi-value', 'department') &&
        (assignment.assigned_to_department === user.departmentId ||
          assignment.employee?.departmentId === user.departmentId ||
          assignment.section?.department?.id === user.departmentId);
    }
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

    const newStatus = userHasPermission(user, 'approve', 'kpi-value', 'manager')
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
      (await this.kpiAssignmentRepository.findOne({
        where: { id: savedValue.kpi_assigment_id },
        relations: ['kpi'],
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
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) throw new UnauthorizedException('Rejecting user not found.');
    const assignment =
      kpiValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: kpiValue.kpi_assigment_id,
      }));
    // Check basic permission first
    let canReject = userHasPermission(
      user,
      'reject',
      'kpi-value',
      'department',
    );

    // If no basic permission, check department-specific logic
    if (!canReject && user.departmentId && assignment) {
      canReject =
        userHasPermission(user, 'reject', 'kpi-value', 'department') &&
        (assignment.assigned_to_department === user.departmentId ||
          assignment.employee?.departmentId === user.departmentId ||
          assignment.section?.department?.id === user.departmentId);
    }
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
    if (userHasPermission(user, 'reject', 'kpi-value', 'manager')) {
      newStatus = KpiValueStatus.REJECTED_BY_MANAGER;
      logAction = 'REJECT_MANAGER';
    } else if (userHasPermission(user, 'reject', 'kpi-value', 'department')) {
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
    const assignmentFound = await this.kpiAssignmentRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.kpi', 'kpi')
      .where('assignment.id = :id', { id: rejectedValue.kpi_assigment_id })
      .getOne();
    if (!assignmentFound) {
      console.error(
        'No assignment found for ID:',
        rejectedValue.kpi_assigment_id,
      );
    }
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
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new UnauthorizedException('Approving user not found.');
    }
    const assignment =
      kpiValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: kpiValue.kpi_assigment_id,
      }));
    // Check basic permission first
    let canApprove = userHasPermission(user, 'approve', 'kpi-value', 'manager');

    // If no basic permission, check manager-specific logic
    if (!canApprove && user.departmentId && assignment) {
      canApprove =
        userHasPermission(user, 'approve', 'kpi-value', 'manager') &&
        (assignment.assigned_to_department === user.departmentId ||
          assignment.employee?.departmentId === user.departmentId ||
          assignment.section?.department?.id === user.departmentId);
    }
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
      (await this.kpiAssignmentRepository.findOne({
        where: { id: savedValue.kpi_assigment_id },
        relations: ['kpi'],
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
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) throw new UnauthorizedException('Rejecting user not found.');
    const assignment =
      kpiValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: kpiValue.kpi_assigment_id,
      }));
    // Check basic permission first
    let canReject = userHasPermission(user, 'reject', 'kpi-value', 'manager');

    // If no basic permission, check manager-specific logic
    if (!canReject && user.departmentId && assignment) {
      canReject =
        userHasPermission(user, 'reject', 'kpi-value', 'manager') &&
        (assignment.assigned_to_department === user.departmentId ||
          assignment.employee?.departmentId === user.departmentId ||
          assignment.section?.department?.id === user.departmentId);
    }
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

    let newStatus: KpiValueStatus;
    let logAction: string;
    if (userHasPermission(user, 'reject', 'kpi-value', 'manager')) {
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
      (await this.kpiAssignmentRepository.findOne({
        where: { id: rejectedValue.kpi_assigment_id },
        relations: ['kpi'],
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

  async approveKpiReview(id: number, approver: Employee): Promise<KpiValue> {
    const kpiValue = await this.kpiValuesRepository.findOne({
      where: { id },
      relations: ['kpiAssignment', 'kpiAssignment.kpi'],
    });
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found.`);
    }

    // Check if KPI has expired
    if (kpiValue.kpiAssignment?.kpi) {
      const kpiValidityStatus = getKpiStatus(
        kpiValue.kpiAssignment.kpi.start_date,
        kpiValue.kpiAssignment.kpi.end_date,
      );
      if (kpiValidityStatus === 'expired') {
        throw new BadRequestException(
          'Cannot change approval status for expired KPI. This KPI is no longer valid.',
        );
      }
    }

    if (userHasPermission(approver, 'approve', 'kpi-value', 'manager')) {
      kpiValue.status = KpiValueStatus.APPROVED;
    } else if (
      userHasPermission(approver, 'approve', 'kpi-value', 'department')
    ) {
      kpiValue.status = KpiValueStatus.PENDING_MANAGER_APPROVAL;
    } else if (userHasPermission(approver, 'approve', 'kpi-value', 'section')) {
      kpiValue.status = KpiValueStatus.PENDING_DEPT_APPROVAL;
    } else {
      throw new BadRequestException('Invalid approver permission.');
    }
    return await this.kpiValuesRepository.save(kpiValue);
  }

  async rejectKpiReview(id: number, approver: Employee): Promise<KpiValue> {
    const kpiValue = await this.kpiValuesRepository.findOne({
      where: { id },
      relations: ['kpiAssignment', 'kpiAssignment.kpi'],
    });
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found.`);
    }

    // Check if KPI has expired
    if (kpiValue.kpiAssignment?.kpi) {
      const kpiValidityStatus = getKpiStatus(
        kpiValue.kpiAssignment.kpi.start_date,
        kpiValue.kpiAssignment.kpi.end_date,
      );
      if (kpiValidityStatus === 'expired') {
        throw new BadRequestException(
          'Cannot change approval status for expired KPI. This KPI is no longer valid.',
        );
      }
    }

    if (userHasPermission(approver, 'reject', 'kpi-value', 'manager')) {
      kpiValue.status = KpiValueStatus.REJECTED_BY_MANAGER;
    } else if (
      userHasPermission(approver, 'reject', 'kpi-value', 'department')
    ) {
      kpiValue.status = KpiValueStatus.REJECTED_BY_DEPT;
    } else if (userHasPermission(approver, 'reject', 'kpi-value', 'section')) {
      kpiValue.status = KpiValueStatus.REJECTED_BY_SECTION;
    } else {
      throw new BadRequestException('Invalid approver permission.');
    }
    return await this.kpiValuesRepository.save(kpiValue);
  }

  async resubmitKpiReview(id: number): Promise<KpiValue> {
    const kpiValue = await this.kpiValuesRepository.findOne({
      where: { id },
      relations: ['kpiAssignment', 'kpiAssignment.kpi'],
    });
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found.`);
    }

    // Check if KPI has expired
    if (kpiValue.kpiAssignment?.kpi) {
      const kpiValidityStatus = getKpiStatus(
        kpiValue.kpiAssignment.kpi.start_date,
        kpiValue.kpiAssignment.kpi.end_date,
      );
      if (kpiValidityStatus === 'expired') {
        throw new BadRequestException(
          'Cannot update values for expired KPI. This KPI is no longer valid.',
        );
      }
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
    // Debug: Check if there are any pending KPI values in database
    const allPendingValues = await this.kpiValuesRepository.find({
      where: [
        { status: KpiValueStatus.PENDING_SECTION_APPROVAL },
        { status: KpiValueStatus.PENDING_DEPT_APPROVAL },
        { status: KpiValueStatus.PENDING_MANAGER_APPROVAL },
      ],
      relations: [
        'kpiAssignment',
        'kpiAssignment.kpi',
        'kpiAssignment.employee',
      ],
    });

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

    const canApproveSection = userHasPermission(
      user,
      'approve',
      'kpi-value',
      'section',
    );
    const canApproveDepartment = userHasPermission(
      user,
      'approve',
      'kpi-value',
      'department',
    );
    const canApproveManager = userHasPermission(
      user,
      'approve',
      'kpi-value',
      'manager',
    );
    // Add view permission checks
    const canViewSection = userHasPermission(
      user,
      'view',
      'kpi-value',
      'section',
    );
    const canViewDepartment = userHasPermission(
      user,
      'view',
      'kpi-value',
      'department',
    );
    const canViewManager = userHasPermission(
      user,
      'view',
      'kpi-value',
      'manager',
    );

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

    let applied = false;
    const allowedStatuses: KpiValueStatus[] = [];

    // Collect all statuses user can view or approve
    if (canApproveSection || canViewSection) {
      allowedStatuses.push(KpiValueStatus.PENDING_SECTION_APPROVAL);
    }
    if (canApproveDepartment || canViewDepartment) {
      allowedStatuses.push(KpiValueStatus.PENDING_DEPT_APPROVAL);
    }
    if (canApproveManager || canViewManager) {
      allowedStatuses.push(KpiValueStatus.PENDING_MANAGER_APPROVAL);
    }

    if (allowedStatuses.length > 0) {
      // Remove duplicates
      const uniqueStatuses = [...new Set(allowedStatuses)];
      query.where('kpiValue.status IN (:...statuses)', {
        statuses: uniqueStatuses,
      });

      // Check highest scope first - if user has manager scope, see all
      const hasManagerScope = canApproveManager || canViewManager;

      // Apply department/section filters only if NOT manager level
      if (!hasManagerScope) {
        if (user.departmentId && (canApproveDepartment || canViewDepartment)) {
          // Filter by department
          query.andWhere(
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
        } else if (user.sectionId && (canApproveSection || canViewSection)) {
          // Filter by section only
          query.andWhere(
            new Brackets((qb) => {
              qb.where('assignment.assigned_to_section = :sectionId', {
                sectionId: user.sectionId,
              }).orWhere('assignedEmployee.sectionId = :sectionId', {
                sectionId: user.sectionId,
              });
            }),
          );
        }
      }
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
