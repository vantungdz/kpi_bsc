
import { Injectable, Logger } from '@nestjs/common'; 
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from './notification.service'; 
import { KPIAssignment } from 'src/entities/kpi-assignment.entity';
import { KpiValue } from 'src/entities/kpi-value.entity';
import { EmployeesService } from 'src/employees/employees.service'; 
import { NotificationType } from 'src/entities/notification.entity'; 
import { Employee } from 'src/entities/employee.entity';

@Injectable()
export class NotificationEventListener {
  private readonly logger = new Logger(NotificationEventListener.name); 
  constructor(
    private readonly notificationService: NotificationService,
    private readonly employeeService: EmployeesService,
  ) {}

  @OnEvent('kpi.assigned')
  async handleKpiAssigned(payload: {
    assignment: KPIAssignment;
    kpiName: string;
  }) {
    if (payload.assignment.assigned_to_employee) {
      await this.notificationService.createNotification(
        payload.assignment.assigned_to_employee,
        NotificationType.NEW_KPI_ASSIGNMENT,
        `Bạn có KPI mới: ${payload.kpiName}`,
        payload.assignment.id,
        'KPI_ASSIGNMENT',
        payload.assignment.kpi_id,
      );
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
        await this.notificationService.createNotification(
          sectionLeader.id,
          NotificationType.KPI_APPROVAL_PENDING,
          `KPI "${payload.kpiName}" của ${payload.submitter.first_name} ${payload.submitter.last_name} đang chờ bạn duyệt.`,
          payload.kpiValue.id,
          'KPI_VALUE',
          payload.kpiId, 
        );
        this.logger.log(`Notification sent to Section Leader: ${sectionLeader.username} for KPI: ${payload.kpiName}`);
      }
    }

    
    const adminUsers = await this.employeeService.findAllAdmins(); 
    if (adminUsers && adminUsers.length > 0) {
      for (const admin of adminUsers) {
        
        if (admin.id !== notifiedSectionLeaderId) {
          await this.notificationService.createNotification(
            admin.id,
            NotificationType.KPI_APPROVAL_PENDING, 
            `[Admin View] KPI "${payload.kpiName}" của ${payload.submitter.first_name} ${payload.submitter.last_name} đã được submit và đang chờ Section Leader duyệt.`,
            payload.kpiValue.id,
            'KPI_VALUE',
            payload.kpiId, 
          );
          this.logger.log(`Notification sent to Admin: ${admin.username} for KPI: ${payload.kpiName}`);
        }
      }
    }

    if (!notifiedSectionLeaderId && (!adminUsers || adminUsers.length === 0)) {
      this.logger.warn(`No one was notified for KPI submission: ${payload.kpiName} by ${payload.submitter.username}`);
    }
  }

  @OnEvent('kpi_value.approved_by_user')
  async handleKpiValueApproved(payload: {
    kpiValue: KpiValue;
    submitterId: number;
    kpiName: string;
  }) {
    await this.notificationService.createNotification(
      payload.submitterId,
      NotificationType.KPI_VALUE_APPROVED,
      `Giá trị bạn submit cho KPI "${payload.kpiName}" đã được duyệt.`,
      payload.kpiValue.id,
      'KPI_VALUE',
      
      payload.kpiValue.kpiAssignment?.kpi_id, 
    );
  }

  @OnEvent('kpi_value.rejected_by_user')
  async handleKpiValueRejected(payload: {
    kpiValue: KpiValue;
    submitterId: number;
    kpiName: string;
    reason: string;
  }) {
    await this.notificationService.createNotification(
      payload.submitterId,
      NotificationType.KPI_VALUE_REJECTED,
      `Giá trị bạn submit cho KPI "${payload.kpiName}" đã bị từ chối. Lý do: ${payload.reason}`,
      payload.kpiValue.id,
      'KPI_VALUE',
      
      payload.kpiValue.kpiAssignment?.kpi_id, 
    );
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
      const departmentManager = await this.employeeService.findManagerOfDepartment(departmentId);
      if (departmentManager) {
        await this.notificationService.createNotification(
          departmentManager.id,
          NotificationType.KPI_APPROVAL_PENDING,
          `KPI "${payload.kpiName}" của ${payload.submitter.first_name} ${payload.submitter.last_name} (Section đã duyệt) đang chờ Department duyệt.`,
          payload.kpiValue.id,
          'KPI_VALUE',
          payload.kpiId, 
        );
        this.logger.log(`Notification sent to Department Manager: ${departmentManager.username} for KPI: ${payload.kpiName}`);
      } else {
        this.logger.warn(`No Department Manager found for departmentId: ${departmentId} to notify for KPI: ${payload.kpiName}`);
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
        await this.notificationService.createNotification(
          admin.id,
          NotificationType.KPI_APPROVAL_PENDING,
          `KPI "${payload.kpiName}" của ${payload.submitter.first_name} ${payload.submitter.last_name} (Department đã duyệt) đang chờ bạn (Admin/Manager) duyệt.`,
          payload.kpiValue.id,
          'KPI_VALUE',
          payload.kpiId, 
        );
        this.logger.log(`Notification sent to Admin/Manager: ${admin.username} for KPI: ${payload.kpiName}`);
      }
    } else {
      this.logger.warn(`No Admin/Manager users found to notify for final approval of KPI: ${payload.kpiName}`);
    }
  }
}
