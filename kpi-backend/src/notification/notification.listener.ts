import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from './notification.service';
import { KPIAssignment } from 'src/entities/kpi-assignment.entity';
import { KpiValue } from 'src/entities/kpi-value.entity';
import { EmployeesService } from 'src/employees/employees.service';
import { NotificationType } from 'src/entities/notification.entity';
import { OverallReview } from 'src/entities/overall-review.entity'; // Thêm import
import { Employee } from 'src/entities/employee.entity';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class NotificationEventListener {
  private readonly logger = new Logger(NotificationEventListener.name);
  constructor(
    private readonly notificationService: NotificationService,
    private readonly employeeService: EmployeesService,
    private readonly notificationGateway: NotificationGateway, // Inject gateway
  ) {}

  @OnEvent('kpi.assigned')
  async handleKpiAssigned(payload: {
    assignment: KPIAssignment;
    kpiName: string;
  }) {
    if (payload.assignment.assigned_to_employee) {
      const notification = await this.notificationService.createNotification(
        payload.assignment.assigned_to_employee,
        NotificationType.NEW_KPI_ASSIGNMENT,
        `Bạn có KPI mới: ${payload.kpiName}`,
        payload.assignment.id,
        'KPI_ASSIGNMENT',
        payload.assignment.kpi_id,
      );
      this.notificationGateway.sendNotificationToUser(payload.assignment.assigned_to_employee, notification);
    }
  }

  @OnEvent('kpi_value.submitted_for_section_approval')
  async handleKpiValueSubmittedForSection(payload: {
    kpiValue: KpiValue;
    submitter: Employee;
    kpiName: string;
    assignmentId: number;
    kpiId: number;
  }) {
    this.logger.log(
      `Caught event: kpi_value.submitted_for_section_approval for KPI: ${payload.kpiName} by ${payload.submitter.username}`,
    );
    let notifiedSectionLeaderId: number | null = null;

    if (payload.submitter.sectionId) {
      const sectionLeader = await this.employeeService.findLeaderOfSection(
        payload.submitter.sectionId,
      );
      if (sectionLeader) {
        notifiedSectionLeaderId = sectionLeader.id;
        const notification = await this.notificationService.createNotification(
          sectionLeader.id,
          NotificationType.KPI_APPROVAL_PENDING,
          `KPI "${payload.kpiName}" của ${payload.submitter.first_name} ${payload.submitter.last_name} đang chờ bạn duyệt.`,
          payload.kpiValue.id,
          'KPI_VALUE',
          payload.kpiId,
        );
        this.notificationGateway.sendNotificationToUser(sectionLeader.id, notification);
        this.logger.log(
          `Notification sent to Section Leader: ${sectionLeader.username} for KPI: ${payload.kpiName}`,
        );
      }
    }

    const adminUsers = await this.employeeService.findAllAdmins();
    if (adminUsers && adminUsers.length > 0) {
      for (const admin of adminUsers) {
        if (admin.id !== notifiedSectionLeaderId) {
          const notification = await this.notificationService.createNotification(
            admin.id,
            NotificationType.KPI_APPROVAL_PENDING,
            `[Admin View] KPI "${payload.kpiName}" của ${payload.submitter.first_name} ${payload.submitter.last_name} đã được submit và đang chờ Section Leader duyệt.`,
            payload.kpiValue.id,
            'KPI_VALUE',
            payload.kpiId,
          );
          this.notificationGateway.sendNotificationToUser(admin.id, notification);
          this.logger.log(
            `Notification sent to Admin: ${admin.username} for KPI: ${payload.kpiName}`,
          );
        }
      }
    }

    if (!notifiedSectionLeaderId && (!adminUsers || adminUsers.length === 0)) {
      this.logger.warn(
        `No one was notified for KPI submission: ${payload.kpiName} by ${payload.submitter.username}`,
      );
    }
  }

  @OnEvent('kpi_value.approved_by_user')
  async handleKpiValueApproved(payload: {
    kpiValue: KpiValue;
    submitterId: number;
    kpiName: string;
  }) {
    const notification = await this.notificationService.createNotification(
      payload.submitterId,
      NotificationType.KPI_VALUE_APPROVED,
      `Giá trị bạn submit cho KPI "${payload.kpiName}" đã được duyệt.`,
      payload.kpiValue.id,
      'KPI_VALUE',
      payload.kpiValue.kpiAssignment?.kpi_id,
    );
    this.notificationGateway.sendNotificationToUser(payload.submitterId, notification);
  }

  @OnEvent('kpi_value.rejected_by_user')
  async handleKpiValueRejected(payload: {
    kpiValue: KpiValue;
    submitterId: number;
    kpiName: string;
    reason: string;
  }) {
    const notification = await this.notificationService.createNotification(
      payload.submitterId,
      NotificationType.KPI_VALUE_REJECTED,
      `Giá trị bạn submit cho KPI "${payload.kpiName}" đã bị từ chối. Lý do: ${payload.reason}`,
      payload.kpiValue.id,
      'KPI_VALUE',
      payload.kpiValue.kpiAssignment?.kpi_id,
    );
    this.notificationGateway.sendNotificationToUser(payload.submitterId, notification);
  }

  @OnEvent('kpi_value.submitted_for_dept_approval')
  async handleKpiValueSubmittedForDept(payload: {
    kpiValue: KpiValue;
    submitter: Employee;
    kpiName: string;
    assignmentId: number;
    kpiId: number;
  }) {
    this.logger.log(
      `Caught event: kpi_value.submitted_for_dept_approval for KPI: ${payload.kpiName} by ${payload.submitter.username}`,
    );

    const departmentId =
      payload.kpiValue.kpiAssignment?.department?.id ||
      payload.submitter.departmentId;

    if (departmentId) {
      const departmentManager =
        await this.employeeService.findManagerOfDepartment(departmentId);
      if (departmentManager) {
        const notification = await this.notificationService.createNotification(
          departmentManager.id,
          NotificationType.KPI_APPROVAL_PENDING,
          `KPI "${payload.kpiName}" của ${payload.submitter.first_name} ${payload.submitter.last_name} (Section đã duyệt) đang chờ Department duyệt.`,
          payload.kpiValue.id,
          'KPI_VALUE',
          payload.kpiId,
        );
        this.notificationGateway.sendNotificationToUser(departmentManager.id, notification);
        this.logger.log(
          `Notification sent to Department Manager: ${departmentManager.username} for KPI: ${payload.kpiName}`,
        );
      } else {
        this.logger.warn(
          `No Department Manager found for departmentId: ${departmentId} to notify for KPI: ${payload.kpiName}`,
        );
      }
    }
  }

  @OnEvent('kpi_value.submitted_for_manager_approval')
  async handleKpiValueSubmittedForManagerApproval(payload: {
    kpiValue: KpiValue;
    submitter: Employee;
    kpiName: string;
    assignmentId: number;
    kpiId: number;
  }) {
    this.logger.log(
      `Caught event: kpi_value.submitted_for_manager_approval for KPI: ${payload.kpiName} by ${payload.submitter.username}`,
    );

    const adminUsers = await this.employeeService.findAllAdmins();
    if (adminUsers && adminUsers.length > 0) {
      for (const admin of adminUsers) {
        const notification = await this.notificationService.createNotification(
          admin.id,
          NotificationType.KPI_APPROVAL_PENDING,
          `KPI "${payload.kpiName}" của ${payload.submitter.first_name} ${payload.submitter.last_name} (Department đã duyệt) đang chờ bạn (Admin/Manager) duyệt.`,
          payload.kpiValue.id,
          'KPI_VALUE',
          payload.kpiId,
        );
        this.notificationGateway.sendNotificationToUser(admin.id, notification);
        this.logger.log(
          `Notification sent to Admin/Manager: ${admin.username} for KPI: ${payload.kpiName}`,
        );
      }
    } else {
      this.logger.warn(
        `No Admin/Manager users found to notify for final approval of KPI: ${payload.kpiName}`,
      );
    }
  }

  // Listener cho sự kiện quản lý review xong, chờ nhân viên phản hồi
  @OnEvent('overall_review.employee_feedback_pending')
  async handleOverallReviewPendingEmployeeFeedback(payload: {
    overallReview: OverallReview;
    manager: Employee;
    targetId: number;
    targetType: string;
  }) {
    this.logger.log(
      `Caught event: overall_review.employee_feedback_pending for target ${payload.targetType}:${payload.targetId} by manager ${payload.manager.username}`,
    );
    // Chỉ gửi thông báo nếu target là employee
    if (payload.targetType === 'employee') {
      const employeeToNotify = await this.employeeService.findOne(
        payload.targetId,
      );
      if (employeeToNotify) {
        const notification = await this.notificationService.createNotification(
          employeeToNotify.id,
          NotificationType.REVIEW_PENDING_EMPLOYEE_FEEDBACK,
          `Đánh giá KPI của bạn cho chu kỳ ${payload.overallReview.cycleId} đã được quản lý cập nhật và đang chờ phản hồi của bạn.`,
          payload.overallReview.id,
          'OVERALL_REVIEW',
          null, // kpiId không trực tiếp liên quan ở đây, có thể để null hoặc dùng targetId
        );
        this.notificationGateway.sendNotificationToUser(employeeToNotify.id, notification);
        this.logger.log(
          `Notification sent to employee ${employeeToNotify.username} for pending feedback.`,
        );
      } else {
        this.logger.warn(
          `Employee with ID ${payload.targetId} not found for notification.`,
        );
      }
    }
  }

  // Listener cho sự kiện nhân viên đã phản hồi
  @OnEvent('overall_review.employee_responded')
  async handleOverallReviewEmployeeResponded(payload: {
    overallReview: OverallReview;
    employee: Employee;
  }) {
    this.logger.log(
      `Caught event: overall_review.employee_responded for review ID ${payload.overallReview.id} by employee ${payload.employee.username}`,
    );
    // Thông báo cho người quản lý đã thực hiện review (overallReview.reviewedById)
    const managerToNotify = await this.employeeService.findOne(
      payload.overallReview.reviewedById,
    );
    if (managerToNotify) {
      const notification = await this.notificationService.createNotification(
        managerToNotify.id,
        NotificationType.REVIEW_EMPLOYEE_RESPONDED,
        `Nhân viên ${payload.employee.first_name} ${payload.employee.last_name} đã gửi phản hồi về đánh giá KPI chu kỳ ${payload.overallReview.cycleId}.`,
        payload.overallReview.id,
        'OVERALL_REVIEW',
        null,
      );
      this.notificationGateway.sendNotificationToUser(managerToNotify.id, notification);
      this.logger.log(
        `Notification sent to manager ${managerToNotify.username} about employee feedback.`,
      );
    }
  }

  // Listener cho sự kiện review đã hoàn tất
  @OnEvent('overall_review.completed')
  async handleOverallReviewCompleted(payload: {
    overallReview: OverallReview;
    manager: Employee;
    targetId: number;
    targetType: string;
  }) {
    this.logger.log(
      `Caught event: overall_review.completed for target ${payload.targetType}:${payload.targetId} by manager ${payload.manager.username}`,
    );
    if (payload.targetType === 'employee') {
      const notification = await this.notificationService.createNotification(
        payload.targetId, // ID của nhân viên được review
        NotificationType.REVIEW_COMPLETED,
        `Đánh giá KPI của bạn cho chu kỳ ${payload.overallReview.cycleId} đã được hoàn tất.`,
        payload.overallReview.id,
        'OVERALL_REVIEW',
        null,
      );
      this.notificationGateway.sendNotificationToUser(payload.targetId, notification);
    }
  }
}
