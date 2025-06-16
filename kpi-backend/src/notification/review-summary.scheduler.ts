import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { KpiReview, ReviewStatus } from '../entities/kpi-review.entity';
import { NotificationService } from './notification.service';
import { EmployeesService } from '../employees/employees.service';
import { NotificationType } from '../entities/notification.entity';

@Injectable()
export class ReviewSummaryScheduler {
  private readonly logger = new Logger(ReviewSummaryScheduler.name);
  constructor(
    @InjectRepository(KpiReview)
    private readonly kpiReviewRepository: Repository<KpiReview>,
    private readonly notificationService: NotificationService,
    private readonly employeesService: EmployeesService,
  ) {}

  /**
   * Gửi thông báo tổng hợp hàng tuần cho từng vai trò về các review còn tồn đọng
   */
  @Cron('0 8 * * 1') // Every Monday at 8AM
  async sendWeeklyReviewSummary() {
    this.logger.log('Running weekly review summary...');
    // Các trạng thái còn tồn đọng
    const waitingStatuses: ReviewStatus[] = [
      ReviewStatus.SELF_REVIEWED,
      ReviewStatus.SECTION_REVIEWED,
      ReviewStatus.DEPARTMENT_REVIEWED,
      ReviewStatus.MANAGER_REVIEWED,
      ReviewStatus.EMPLOYEE_FEEDBACK,
    ];
    // Lấy tất cả review còn tồn đọng
    const reviews = await this.kpiReviewRepository.find({
      where: { status: In(waitingStatuses) },
      relations: ['kpi', 'employee', 'department', 'section'],
    });
    // Tổng hợp cho từng vai trò
    const sectionMap = new Map<number, number>();
    const deptMap = new Map<number, number>();
    const managerMap = new Map<number, number>();
    const employeeMap = new Map<number, number>();
    for (const review of reviews) {
      if (review.status === ReviewStatus.SELF_REVIEWED && review.section && review.section.id) {
        // Section leader
        sectionMap.set(review.section.id, (sectionMap.get(review.section.id) || 0) + 1);
      } else if (review.status === ReviewStatus.SECTION_REVIEWED && review.department && review.department.id) {
        // Department leader
        deptMap.set(review.department.id, (deptMap.get(review.department.id) || 0) + 1);
      } else if (review.status === ReviewStatus.DEPARTMENT_REVIEWED && review.department && review.department.id) {
        // Manager
        managerMap.set(review.department.id, (managerMap.get(review.department.id) || 0) + 1);
      } else if (review.status === ReviewStatus.EMPLOYEE_FEEDBACK && review.employee && review.employee.id) {
        // Employee
        employeeMap.set(review.employee.id, (employeeMap.get(review.employee.id) || 0) + 1);
      }
    }
    // Gửi cho section leader
    for (const [sectionId, count] of sectionMap.entries()) {
      const sectionLeader = await this.employeesService.findLeaderOfSection(sectionId);
      if (sectionLeader) {
        await this.notificationService.createNotification(
          sectionLeader.id,
          NotificationType.REVIEW_PENDING_SECTION_REVIEW,
          `Bạn có ${count} review KPI đang chờ duyệt (section) trong tuần này.`,
        );
      }
    }
    // Gửi cho department leader
    for (const [deptId, count] of deptMap.entries()) {
      const deptLeader = await this.employeesService.findManagerOfDepartment(deptId);
      if (deptLeader) {
        await this.notificationService.createNotification(
          deptLeader.id,
          NotificationType.REVIEW_PENDING_DEPARTMENT_REVIEW,
          `Bạn có ${count} review KPI đang chờ duyệt (department) trong tuần này.`,
        );
      }
    }
    // Gửi cho manager
    for (const [deptId, count] of managerMap.entries()) {
      const manager = await this.employeesService.findManagerOfDepartment(deptId);
      if (manager) {
        await this.notificationService.createNotification(
          manager.id,
          NotificationType.REVIEW_PENDING_MANAGER_REVIEW,
          `Bạn có ${count} review KPI đang chờ duyệt (manager) trong tuần này.`,
        );
      }
    }
    // Gửi cho nhân viên cần phản hồi
    for (const [employeeId, count] of employeeMap.entries()) {
      await this.notificationService.createNotification(
        employeeId,
        NotificationType.REVIEW_PENDING_EMPLOYEE_FEEDBACK,
        `Bạn có ${count} review KPI đang chờ phản hồi trong tuần này.`,
      );
    }
  }
}
