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

        const submitter = await transactionalEntityManager
          .getRepository(Employee)
          .findOneBy({ id: userId });
        if (!submitter) {
          throw new UnauthorizedException('Submitter information not found.');
        }

        let initialStatusAfterSubmit: KpiValueStatus;

        if (submitter.role === 'department') {
          initialStatusAfterSubmit = KpiValueStatus.PENDING_MANAGER_APPROVAL;
          this.logger.log(
            `Submitter role is 'department', next status: PENDING_MANAGER_APPROVAL`,
          );
        } else if (submitter.role === 'section') {
          initialStatusAfterSubmit = KpiValueStatus.PENDING_DEPT_APPROVAL;
          this.logger.log(
            `Submitter role is 'section', next status: PENDING_DEPT_APPROVAL`,
          );
        } else {
          // Default for 'employee' or other roles considered lower
          if (submitter.sectionId) {
            // Employee in a section
            initialStatusAfterSubmit = KpiValueStatus.PENDING_SECTION_APPROVAL;
            this.logger.log(
              `Submitter role '${submitter.role}' in section ${submitter.sectionId}, next status: PENDING_SECTION_APPROVAL`,
            );
          } else if (submitter.departmentId) {
            // Employee in a department but not a specific section (or section structure not used)
            initialStatusAfterSubmit = KpiValueStatus.PENDING_DEPT_APPROVAL;
            this.logger.log(
              `Submitter role '${submitter.role}' in department ${submitter.departmentId} (no section), next status: PENDING_DEPT_APPROVAL`,
            );
          } else {
            // Employee not in a section or department (e.g., direct report to manager/admin)
            initialStatusAfterSubmit = KpiValueStatus.PENDING_MANAGER_APPROVAL;
            this.logger.log(
              `Submitter role '${submitter.role}' (no section/dept), next status: PENDING_MANAGER_APPROVAL`,
            );
          }
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

        // Emit event khi nhân viên submit và cần section duyệt
        if (assignment.kpi) {
          // Ensure kpi is loaded
          if (
            savedKpiValue.status === KpiValueStatus.PENDING_SECTION_APPROVAL
          ) {
            this.eventEmitter.emit('kpi_value.submitted_for_section_approval', {
              kpiValue: savedKpiValue,
              submitter: submitter,
              kpiName: assignment.kpi.name,
              assignmentId: assignment.id, // Thêm assignmentId để dễ truy vấn
              kpiId: assignment.kpi_id, // Thêm kpiId
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

    const assignment =
      savedValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: savedValue.kpi_assigment_id,
      }));

    if (savedValue.status === KpiValueStatus.APPROVED) {
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
      // Thông báo cho người submit rằng KPI value của họ đã được duyệt (nếu người duyệt không phải là người submit)
      if (
        assignment &&
        assignment.employee_id &&
        assignment.employee_id !== userId
      ) {
        this.eventEmitter.emit('kpi_value.approved_by_user', {
          kpiValue: savedValue,
          submitterId: assignment.employee_id,
          kpiName: assignment.kpi?.name || 'N/A',
        });
      }
    } else if (savedValue.status === KpiValueStatus.PENDING_DEPT_APPROVAL) {
      // Emit event khi section đã duyệt và chuyển cho department duyệt
      const submitter = assignment?.employee_id
        ? await this.employeeRepository.findOneBy({
            id: assignment.employee_id,
          })
        : null;
      if (submitter && assignment?.kpi) {
        this.eventEmitter.emit('kpi_value.submitted_for_dept_approval', {
          // Event mới
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

    if (user.role === 'admin' || user.role === 'manager') {
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
    // Thông báo cho người submit rằng KPI value của họ đã bị từ chối
    const assignment =
      rejectedValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: rejectedValue.kpi_assigment_id,
      }));
    if (assignment && assignment.employee_id) {
      this.eventEmitter.emit('kpi_value.rejected_by_user', {
        kpiValue: rejectedValue,
        submitterId: assignment.employee_id,
        kpiName: assignment.kpi?.name || 'N/A',
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

    const assignment =
      savedValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: savedValue.kpi_assigment_id,
      }));

    if (savedValue.status === KpiValueStatus.APPROVED) {
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
      // Thông báo cho người submit rằng KPI value của họ đã được duyệt (nếu người duyệt không phải là người submit)
      if (
        assignment &&
        assignment.employee_id &&
        assignment.employee_id !== userId
      ) {
        this.eventEmitter.emit('kpi_value.approved_by_user', {
          kpiValue: savedValue,
          submitterId: assignment.employee_id,
          kpiName: assignment.kpi?.name || 'N/A',
        });
      }
    } else if (savedValue.status === KpiValueStatus.PENDING_MANAGER_APPROVAL) {
      // Emit event khi department đã duyệt và chuyển cho manager duyệt
      const submitter = assignment?.employee_id
        ? await this.employeeRepository.findOneBy({
            id: assignment.employee_id,
          })
        : null;
      if (submitter && assignment?.kpi) {
        this.eventEmitter.emit('kpi_value.submitted_for_manager_approval', {
          // Event mới
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

    if (user.role === 'admin' || user.role === 'manager') {
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
    // Thông báo cho người submit rằng KPI value của họ đã bị từ chối
    const assignment =
      rejectedValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: rejectedValue.kpi_assigment_id,
      }));
    if (assignment && assignment.employee_id) {
      this.eventEmitter.emit('kpi_value.rejected_by_user', {
        kpiValue: rejectedValue,
        submitterId: assignment.employee_id,
        kpiName: assignment.kpi?.name || 'N/A',
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
    // Thông báo cho người submit rằng KPI value của họ đã được duyệt (nếu người duyệt không phải là người submit)
    if (
      assignment &&
      assignment.employee_id &&
      assignment.employee_id !== userId
    ) {
      this.eventEmitter.emit('kpi_value.approved_by_user', {
        kpiValue: savedValue,
        submitterId: assignment.employee_id,
        kpiName: assignment.kpi?.name || 'N/A',
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

    // Notify the submitter that their KPI value has been rejected
    const assignment =
      rejectedValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: rejectedValue.kpi_assigment_id,
      }));
    if (assignment?.employee_id) {
      this.eventEmitter.emit('kpi_value.rejected_by_user', {
        kpiValue: rejectedValue,
        submitterId: assignment.employee_id,
        kpiName: assignment.kpi?.name || 'N/A',
        reason,
      });
    }

    return rejectedValue;
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
      this.logger.warn(`User with ID ${userId} not found.`);
      return false;
    }

    const assignment = await this.kpiAssignmentRepository.findOne({
      where: { id: assignmentId },
      relations: ['section', 'department', 'section.department', 'employee'],
    });

    if (!assignment) {
      this.logger.warn(`Assignment with ID ${assignmentId} not found.`);
      return false;
    }

    const effectiveTargetSectionId =
      assignment.assigned_to_section || assignment.employee?.sectionId;
    const effectiveTargetDepartmentId =
      assignment.assigned_to_department || assignment.employee?.departmentId;

    let hasRequiredRole = false;

    switch (action) {
      case 'SECTION_APPROVE':
      case 'SECTION_REJECT':
        // Các vai trò được phép bởi controller: 'manager', 'admin', 'department', 'section'
        if (user.role === 'section') {
          hasRequiredRole = user.sectionId === effectiveTargetSectionId;
        } else if (user.role === 'department') {
          // Trưởng phòng có thể hành động ở cấp section nếu section đó thuộc phòng của họ,
          // hoặc nếu KPI được giao trực tiếp cho phòng của họ.
          // Điều này giả định trưởng phòng có thể thực hiện hành động ở cấp section cho các section của mình.
          // Cần xem xét kỹ logic này dựa trên quy tắc nghiệp vụ chính xác của bạn.
          hasRequiredRole =
            (assignment.section?.department.id === user.departmentId &&
              effectiveTargetSectionId === assignment.section.id) ||
            (user.departmentId === effectiveTargetDepartmentId &&
              assignment.assigned_to_department === user.departmentId);
        } else if (user.role === 'manager' || user.role === 'admin') {
          hasRequiredRole = true; // Manager/Admin có thể thực hiện hành động ở cấp section
        }
        break;
      case 'DEPT_APPROVE':
      case 'DEPT_REJECT':
        // Các vai trò được phép bởi controller: 'manager', 'admin', 'department'
        if (user.role === 'department') {
          hasRequiredRole = user.departmentId === effectiveTargetDepartmentId;
        } else if (user.role === 'manager' || user.role === 'admin') {
          hasRequiredRole = true; // Manager/Admin có thể thực hiện hành động ở cấp department
        }
        break;
      case 'MANAGER_APPROVE':
      case 'MANAGER_REJECT':
        // Các vai trò được phép bởi controller: 'manager', 'admin'
        hasRequiredRole = user.role === 'manager' || user.role === 'admin';
        break;
      default:
        this.logger.warn(`Unknown action '${action}' for permission check.`);
    }

    if (!hasRequiredRole) {
      this.logger.warn(
        `Access denied for UserID: ${userId}, Role: ${user.role}, Action: ${action}, TargetSection: ${effectiveTargetSectionId}, TargetDept: ${effectiveTargetDepartmentId}, UserSection: ${user.sectionId}, UserDept: ${user.departmentId}`,
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
      .leftJoinAndSelect(
        'assignedSection.department',
        'departmentOfAssignedSection',
      )
      .leftJoinAndSelect('assignedEmployee.section', 'employeeSection')
      .leftJoinAndSelect('assignedEmployee.department', 'employeeDepartment')
      .leftJoinAndSelect('kpi.perspective', 'perspective');

    switch (user.role) {
      case 'section':
        this.logger.debug(
          `Applying filter for role: leader, sectionId: ${user.sectionId}`,
        );
        if (!user.sectionId) {
          this.logger.warn(
            'Leader user has no sectionId, returning empty array.',
          );
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

      case 'department': // Thêm case riêng cho vai trò 'department'
        this.logger.debug(
          `Applying filter for role: manager, departmentId: ${user.departmentId}, sectionId: ${user.sectionId}`,
        );
        if (!user.departmentId) {
          // Người dùng department phải có departmentId
          this.logger.warn(
            'Department user has no departmentId, returning empty array.',
          );
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
        break;

      case 'manager':
        this.logger.debug(
          `Applying filter for role: manager. DepartmentId: ${user.departmentId}, SectionId: ${user.sectionId}`,
        );
        // Manager duyệt các mục đã được department duyệt (PENDING_MANAGER_APPROVAL)
        query.where('kpiValue.status = :status', {
          status: KpiValueStatus.PENDING_MANAGER_APPROVAL,
        });
        // Nếu manager cũng là người quản lý một phòng ban cụ thể và có thể duyệt PENDING_DEPT_APPROVAL
        // của phòng ban đó, bạn có thể thêm logic orWhere tương tự như case 'department'.
        // Ví dụ:
        // if (user.departmentId) {
        //   query.orWhere(
        //       new Brackets((qb) => {
        //           qb.where('kpiValue.status = :deptStatus', { deptStatus: KpiValueStatus.PENDING_DEPT_APPROVAL})
        //             .andWhere(
        //               new Brackets((subQb) => {
        //                   subQb.where('assignedEmployee.departmentId = :deptId', { deptId: user.departmentId })
        //                   .orWhere('departmentOfAssignedSection.id = :deptId', { deptId: user.departmentId })
        //                   .orWhere('assignment.assigned_to_department = :deptId', { deptId: user.departmentId });
        //               })
        //             );
        //       })
        //   );
        // }
        break;

      case 'admin':
        this.logger.debug(
          'Applying filter for role: admin (all pending types)',
        );
        query.where('kpiValue.status IN (:...statuses)', {
          statuses: [
            KpiValueStatus.PENDING_SECTION_APPROVAL,
            KpiValueStatus.PENDING_DEPT_APPROVAL,
            KpiValueStatus.PENDING_MANAGER_APPROVAL,
          ],
        });
        break;

      default:
        this.logger.warn(
          `No pending approvals logic defined for role: ${user.role}`,
        );
        return [];
    }

    query.orderBy('kpiValue.timestamp', 'ASC');

    try {
      this.logger.debug('SQL Query:', query.getSql());
      this.logger.debug('Parameters:', query.getParameters());
      const results = await query.getMany();
      this.logger.debug(`Found ${results.length} pending approvals.`);
      return results;
    } catch (error) {
      this.logger.error('Error executing getPendingApprovals query:', error);
      throw error;
    }
  }
}
