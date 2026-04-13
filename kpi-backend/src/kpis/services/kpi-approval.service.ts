import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Kpi, KpiDefinitionStatus } from '../entities/kpi.entity';
import { KPIAssignment } from '../../kpi-assessments/entities/kpi-assignment.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { RBAC_ACTIONS, RBAC_RESOURCES } from '../../common/rbac/rbac.constants';
import { EmployeesService } from '../../employees/employees.service';
import { NotificationService } from '../../notification/notification.service';
import { NotificationType } from '../../notification/entities/notification.entity';

@Injectable()
export class KpiApprovalService {
  private readonly logger = new Logger(KpiApprovalService.name);

  constructor(
    private dataSource: DataSource,
    @InjectRepository(Kpi)
    private readonly kpisRepository: Repository<Kpi>,
    @InjectRepository(KPIAssignment)
    private readonly kpiAssignmentRepository: Repository<KPIAssignment>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    private employeesService: EmployeesService,
    private notificationService: NotificationService,
  ) {}

  /**
   * Bulk submit KPIs for approval
   * Changes status from DRAFT to PENDING_APPROVAL or APPROVED
   * If user has "Approve KPI Value (Manager)" permission, KPI is auto-approved
   */
  async bulkSubmitKpis(
    kpiIds: number[],
    userId: number,
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    // Check if user has Manager approval permission
    const user = await this.employeeRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      this.logger.error(`User ${userId} not found`);
      return { success: 0, failed: kpiIds.length };
    }

    const allPermissions = Array.isArray(user.roles)
      ? user.roles.flatMap((role: any) =>
          Array.isArray(role.permissions) ? role.permissions : [],
        )
      : [];

    const hasApproveManager = allPermissions.some(
      (p: any) =>
        p.action === RBAC_ACTIONS.APPROVE &&
        p.resource === RBAC_RESOURCES.KPI_VALUE &&
        p.scope === 'manager',
    );

    this.logger.log(
      `User ${userId} has Manager approval permission: ${hasApproveManager}`,
    );

    for (const kpiId of kpiIds) {
      try {
        const kpi = await this.kpisRepository.findOne({
          where: { id: kpiId },
          relations: ['createdBy'],
        });

        if (!kpi) {
          this.logger.warn(`KPI ${kpiId} not found`);
          failed++;
          continue;
        }

        // Check if user is the creator
        if (kpi.created_by !== userId) {
          this.logger.warn(
            `User ${userId} is not the creator of KPI ${kpiId}`,
          );
          failed++;
          continue;
        }

        // Check if KPI is in DRAFT status
        if (kpi.status !== KpiDefinitionStatus.DRAFT) {
          this.logger.warn(`KPI ${kpiId} is not in DRAFT status`);
          failed++;
          continue;
        }

        // If user has Manager permission, auto-approve. Otherwise, set to PENDING_APPROVAL
        let newStatus: KpiDefinitionStatus;
        if (hasApproveManager) {
          newStatus = KpiDefinitionStatus.APPROVED;
          this.logger.log(`KPI ${kpiId} auto-approved by Manager`);
        } else {
          newStatus = KpiDefinitionStatus.PENDING_APPROVAL;
          this.logger.log(`KPI ${kpiId} submitted for approval`);
        }

        kpi.status = newStatus;
        kpi.updated_by = userId;
        kpi.updated_at = new Date();
        await this.kpisRepository.save(kpi);

        const assignmentStatus = newStatus === KpiDefinitionStatus.APPROVED
          ?  KpiDefinitionStatus.DRAFT
          : newStatus;
        await this.kpiAssignmentRepository.update(
          { kpi_id: kpiId },
          { status: assignmentStatus, updated_at: new Date() },
        );

        success++;
      } catch (error) {
        this.logger.error(
          `Error submitting KPI ${kpiId}: ${error.message}`,
          error.stack,
        );
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Get KPIs pending approval for current user
   * Logic:
   * - If user has "Approve KPI Value (Section)" permission -> show KPIs created by employees in their section
   * - If user has "Approve KPI Value (Department)" permission -> show KPIs created by anyone in their department
   * - If user has "Approve KPI Value (Manager)" permission -> show KPIs created by department leads
   * - Never includes KPIs where created_by is the current user (no self-approval of definitions).
   * - Optional startDate/endDate (review cycle window): same rules as list filters — KPI must satisfy start_date >= startDate and end_date <= endDate when provided.
   */
  async getPendingKpisForApproval(
    userId: number,
    options?: { startDate?: string; endDate?: string },
  ): Promise<Kpi[]> {
    this.logger.log(`Getting pending KPIs for approval for user ${userId}`);

    const user = await this.employeeRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions', 'section', 'department'],
    });

    if (!user) {
      this.logger.error(`User ${userId} not found`);
      throw new UnauthorizedException('User not found.');
    }

    // Get section and department IDs (with fallback)
    const userSectionId = user.sectionId || (user.section as any)?.id;
    const userDepartmentId = user.departmentId || (user.department as any)?.id;

    this.logger.log(`User ${userId} found: sectionId=${userSectionId}, departmentId=${userDepartmentId}`);

    const allPermissions = Array.isArray(user.roles)
      ? user.roles.flatMap((role: any) =>
          Array.isArray(role.permissions) ? role.permissions : [],
        )
      : [];

    const hasApproveSection = allPermissions.some(
      (p: any) =>
        p.action === RBAC_ACTIONS.APPROVE &&
        p.resource === RBAC_RESOURCES.KPI_VALUE &&
        p.scope === 'section',
    );

    const hasApproveDepartment = allPermissions.some(
      (p: any) =>
        p.action === RBAC_ACTIONS.APPROVE &&
        p.resource === RBAC_RESOURCES.KPI_VALUE &&
        p.scope === 'department',
    );

    const hasApproveManager = allPermissions.some(
      (p: any) =>
        p.action === RBAC_ACTIONS.APPROVE &&
        p.resource === RBAC_RESOURCES.KPI_VALUE &&
        p.scope === 'manager',
    );

    this.logger.log(`Permissions: section=${hasApproveSection}, department=${hasApproveDepartment}, manager=${hasApproveManager}`);

    const query = this.kpisRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.createdBy', 'createdBy')
      .leftJoinAndSelect('createdBy.section', 'creatorSection')
      .leftJoinAndSelect('createdBy.department', 'creatorDepartment')
      .leftJoinAndSelect('kpi.perspective', 'perspective')
      .where('kpi.status = :status', {
        status: KpiDefinitionStatus.PENDING_APPROVAL,
      })
      .andWhere('kpi.deleted_at IS NULL')
      // Không hiển thị KPI do chính mình tạo (vd: section lead gửi duyệt — không tự duyệt)
      .andWhere('kpi.created_by != :viewerId', { viewerId: userId });

    const conditions: string[] = [];
    const parameters: any = {};

    // Section Manager: approve KPIs created by employees in their section
    if (hasApproveSection && userSectionId) {
      conditions.push(
        `(createdBy.sectionId = :userSectionId AND kpi.created_by_type IN ('employee', 'section'))`,
      );
      parameters.userSectionId = userSectionId;
    }

    // Department Manager: approve KPIs created by anyone in their department
    // (employees, section leads, and department-level KPIs)
    if (hasApproveDepartment && userDepartmentId) {
      conditions.push(
        `(createdBy.departmentId = :userDepartmentId)`,
      );
      parameters.userDepartmentId = userDepartmentId;
    }

    // Manager: approve KPIs created by department leads
    if (hasApproveManager) {
      conditions.push(`(kpi.created_by_type = 'department')`);
    }

    if (conditions.length > 0) {
      this.logger.log(`Applying conditions: ${conditions.join(' OR ')}`);
      this.logger.log(`With parameters: ${JSON.stringify(parameters)}`);
      query.andWhere(`(${conditions.join(' OR ')})`, parameters);
    } else {
      // User has no approval permissions
      this.logger.warn(`User ${userId} has no approval permissions`);
      return [];
    }

    if (options?.startDate) {
      query.andWhere('kpi.start_date >= :pendingCycleStart', {
        pendingCycleStart: options.startDate,
      });
    }
    if (options?.endDate) {
      query.andWhere('kpi.end_date <= :pendingCycleEnd', {
        pendingCycleEnd: options.endDate,
      });
    }

    const result = await query.orderBy('kpi.created_at', 'DESC').getMany();
    this.logger.log(`Found ${result.length} pending KPIs for approval`);
    return result;
  }

  /**
   * Approve a pending KPI
   * Changes status from PENDING_APPROVAL to APPROVED
   * Sends notification to KPI creator
   */
  async approveKpi(kpiId: number, approverId: number): Promise<Kpi> {
    const kpi = await this.kpisRepository.findOne({
      where: { id: kpiId },
      relations: ['createdBy', 'createdBy.section', 'createdBy.department'],
    });

    if (!kpi) {
      throw new NotFoundException(`KPI with ID ${kpiId} not found`);
    }

    // Check if KPI is in PENDING_APPROVAL status
    if (kpi.status !== KpiDefinitionStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'KPI is not in PENDING_APPROVAL status. Current status: ' + kpi.status,
      );
    }

    if (kpi.created_by === approverId) {
      throw new BadRequestException(
        'You cannot approve a KPI definition that you created.',
      );
    }

    const approver = await this.employeeRepository.findOne({
      where: { id: approverId },
      relations: ['roles', 'roles.permissions', 'section', 'department'],
    });

    if (!approver) {
      throw new UnauthorizedException('Approver not found.');
    }

    const allPermissions = Array.isArray(approver.roles)
      ? approver.roles.flatMap((role: any) =>
          Array.isArray(role.permissions) ? role.permissions : [],
        )
      : [];

    // Check if approver has permission to approve this KPI
    const hasApproveSection = allPermissions.some(
      (p: any) =>
        p.action === RBAC_ACTIONS.APPROVE &&
        p.resource === RBAC_RESOURCES.KPI_VALUE &&
        p.scope === 'section',
    );

    const hasApproveDepartment = allPermissions.some(
      (p: any) =>
        p.action === RBAC_ACTIONS.APPROVE &&
        p.resource === RBAC_RESOURCES.KPI_VALUE &&
        p.scope === 'department',
    );

    const hasApproveManager = allPermissions.some(
      (p: any) =>
        p.action === RBAC_ACTIONS.APPROVE &&
        p.resource === RBAC_RESOURCES.KPI_VALUE &&
        p.scope === 'manager',
    );

    let canApprove = false;

    // Section Manager: can approve KPIs created by employees in their section
    if (
      hasApproveSection &&
      approver.sectionId &&
      kpi.createdBy?.sectionId === approver.sectionId &&
      ['employee', 'section'].includes(kpi.created_by_type || '')
    ) {
      canApprove = true;
    }

    // Department Manager: can approve KPIs created by anyone in their department
    if (
      hasApproveDepartment &&
      approver.departmentId &&
      kpi.createdBy?.departmentId === approver.departmentId
    ) {
      canApprove = true;
    }

    // Manager: can approve KPIs created by department leads
    if (hasApproveManager && kpi.created_by_type === 'department') {
      canApprove = true;
    }

    if (!canApprove) {
      throw new UnauthorizedException(
        'You do not have permission to approve this KPI',
      );
    }

    // Update KPI status to APPROVED
    kpi.status = KpiDefinitionStatus.APPROVED;
    kpi.updated_by = approverId;
    kpi.updated_at = new Date();
    const updatedKpi = await this.kpisRepository.save(kpi);

    // Also update assignments status to APPROVED
    await this.kpiAssignmentRepository.update(
      { kpi_id: kpiId },
      { status: KpiDefinitionStatus.NOT_SUBMIT, updated_at: new Date() },
    );

    // Send notification to KPI creator
    if (kpi.created_by) {
      try {
        await this.notificationService.createNotification(
          kpi.created_by,
          NotificationType.KPI_APPROVED,
          `Your KPI "${kpi.name}" has been approved`,
          kpiId,
          'kpi',
          kpiId,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send notification for KPI ${kpiId}: ${error.message}`,
          error.stack,
        );
        // Don't throw error, approval is still successful
      }
    }

    return updatedKpi;
  }

  /**
   * Batch approve multiple KPIs
   * Approve nhiều KPIs cùng lúc trong một transaction
   * Nếu bất kỳ KPI nào lỗi, toàn bộ transaction sẽ rollback
   * @param kpiIds - Mảng các KPI ID cần approve
   * @param approverId - ID của người approve
   * @returns Object chứa danh sách success và failed KPIs
   */
  async batchApproveKpis(
    kpiIds: number[],
    approverId: number,
  ): Promise<{ success: number[]; failed: Array<{ id: number; reason: string }> }> {
    const success: number[] = [];
    const failed: Array<{ id: number; reason: string }> = [];

    if (!kpiIds || kpiIds.length === 0) {
      throw new BadRequestException('KPI IDs array cannot be empty');
    }

    try {
      await this.dataSource.transaction(async (transactionalEntityManager) => {
        const kpiRepo = transactionalEntityManager.getRepository(Kpi);
        const assignmentRepo =
          transactionalEntityManager.getRepository(KPIAssignment);

        // Get approver once for all KPIs
        const approver = await transactionalEntityManager
          .getRepository(Employee)
          .findOne({
            where: { id: approverId },
            relations: ['roles', 'roles.permissions', 'section', 'department'],
          });

        if (!approver) {
          throw new UnauthorizedException('Approver not found.');
        }

        const allPermissions = Array.isArray(approver.roles)
          ? approver.roles.flatMap((role: any) =>
              Array.isArray(role.permissions) ? role.permissions : [],
            )
          : [];

        // Check permissions
        const hasApproveSection = allPermissions.some(
          (p: any) =>
            p.action === RBAC_ACTIONS.APPROVE &&
            p.resource === RBAC_RESOURCES.KPI_VALUE &&
            p.scope === 'section',
        );

        const hasApproveDepartment = allPermissions.some(
          (p: any) =>
            p.action === RBAC_ACTIONS.APPROVE &&
            p.resource === RBAC_RESOURCES.KPI_VALUE &&
            p.scope === 'department',
        );

        const hasApproveManager = allPermissions.some(
          (p: any) =>
            p.action === RBAC_ACTIONS.APPROVE &&
            p.resource === RBAC_RESOURCES.KPI_VALUE &&
            p.scope === 'manager',
        );

        // Process each KPI
        for (const kpiId of kpiIds) {
          const kpi = await kpiRepo.findOne({
            where: { id: kpiId },
            relations: ['createdBy', 'createdBy.section', 'createdBy.department'],
          });

          if (!kpi) {
            throw new Error(`KPI with ID ${kpiId} not found`);
          }

          // Check if KPI is in PENDING_APPROVAL status
          if (kpi.status !== KpiDefinitionStatus.PENDING_APPROVAL) {
            throw new Error(
              `KPI ${kpiId} is not in PENDING_APPROVAL status. Current status: ${kpi.status}`,
            );
          }

          if (kpi.created_by === approverId) {
            throw new Error(
              `You cannot approve KPI ${kpiId} that you created`,
            );
          }

          // Check permission for this KPI
          let canApprove = false;

          // Section Manager: can approve KPIs created by employees in their section
          if (
            hasApproveSection &&
            approver.sectionId &&
            kpi.createdBy?.sectionId === approver.sectionId &&
            ['employee', 'section'].includes(kpi.created_by_type || '')
          ) {
            canApprove = true;
          }

          // Department Manager: can approve KPIs created by anyone in their department
          if (
            hasApproveDepartment &&
            approver.departmentId &&
            kpi.createdBy?.departmentId === approver.departmentId
          ) {
            canApprove = true;
          }

          // Manager: can approve KPIs created by department leads
          if (hasApproveManager && kpi.created_by_type === 'department') {
            canApprove = true;
          }

          if (!canApprove) {
            throw new Error(
              `You do not have permission to approve KPI ${kpiId}`,
            );
          }

          // Update KPI status to APPROVED
          kpi.status = KpiDefinitionStatus.APPROVED;
          kpi.updated_by = approverId;
          kpi.updated_at = new Date();
          await kpiRepo.save(kpi);

          // Also update assignments status
          await assignmentRepo.update(
            { kpi_id: kpiId },
            { status: KpiDefinitionStatus.NOT_SUBMIT, updated_at: new Date() },
          );

          success.push(kpiId);
        }
      });

      // Send notifications after transaction commits successfully
      for (const kpiId of success) {
        const kpi = await this.kpisRepository.findOne({
          where: { id: kpiId },
          relations: ['createdBy'],
        });

        if (kpi?.created_by) {
          try {
            await this.notificationService.createNotification(
              kpi.created_by,
              NotificationType.KPI_APPROVED,
              `Your KPI "${kpi.name}" has been approved`,
              kpiId,
              'kpi',
              kpiId,
            );
          } catch (error) {
            this.logger.error(
              `Failed to send notification for KPI ${kpiId}: ${error.message}`,
              error.stack,
            );
            // Don't throw error, approval is still successful
          }
        }
      }
    } catch (error) {
      // If any KPI fails, all will be rolled back
      // Mark all KPIs as failed since transaction rolled back
      const errorMessage = error.message || 'Unknown error';

      // Try to identify which KPI caused the error
      const kpiIdMatch = errorMessage.match(/KPI (\d+)/);
      const failedKpiId = kpiIdMatch ? parseInt(kpiIdMatch[1]) : null;

      for (const id of kpiIds) {
        if (failedKpiId && id === failedKpiId) {
          failed.push({
            id: id,
            reason: errorMessage,
          });
        } else {
          failed.push({
            id: id,
            reason: failedKpiId
              ? `Transaction rolled back due to error in KPI ${failedKpiId}: ${errorMessage}`
              : `Transaction rolled back: ${errorMessage}`,
          });
        }
      }
    }

    return { success, failed };
  }
}
