import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  KpiReview,
  ReviewStatus,
} from '../evaluation/entities/kpi-review.entity';
import { NotificationService } from './notification.service';
import { EmployeesService } from '../employees/employees.service';
import { NotificationType } from './entities/notification.entity';

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
   * Send weekly summary notifications to each role about pending reviews
   * Runs every Monday at 8 AM
   */
  @Cron('0 8 * * 1')
  async sendWeeklyReviewSummary() {
    const waitingStatuses: ReviewStatus[] = [
      ReviewStatus.SELF_REVIEWED,
      ReviewStatus.SECTION_REVIEWED,
      ReviewStatus.DEPARTMENT_REVIEWED,
      ReviewStatus.MANAGER_REVIEWED,
      ReviewStatus.EMPLOYEE_FEEDBACK,
    ];

    const reviews = await this.kpiReviewRepository.find({
      where: { status: In(waitingStatuses) },
      relations: ['kpi', 'employee', 'department', 'section'],
    });

    const sectionMap = new Map<number, number>();
    const deptMap = new Map<number, number>();
    const managerMap = new Map<number, number>();
    const employeeMap = new Map<number, number>();
    for (const review of reviews) {
      if (
        review.status === ReviewStatus.SELF_REVIEWED &&
        review.section &&
        review.section.id
      ) {
        sectionMap.set(
          review.section.id,
          (sectionMap.get(review.section.id) || 0) + 1,
        );
      } else if (
        review.status === ReviewStatus.SECTION_REVIEWED &&
        review.department &&
        review.department.id
      ) {
        deptMap.set(
          review.department.id,
          (deptMap.get(review.department.id) || 0) + 1,
        );
      } else if (
        review.status === ReviewStatus.DEPARTMENT_REVIEWED &&
        review.department &&
        review.department.id
      ) {
        managerMap.set(
          review.department.id,
          (managerMap.get(review.department.id) || 0) + 1,
        );
      } else if (
        review.status === ReviewStatus.EMPLOYEE_FEEDBACK &&
        review.employee &&
        review.employee.id
      ) {
        employeeMap.set(
          review.employee.id,
          (employeeMap.get(review.employee.id) || 0) + 1,
        );
      }
    }

    for (const [sectionId, count] of sectionMap.entries()) {
      const sectionLeader =
        await this.employeesService.findLeaderOfSection(sectionId);
      if (sectionLeader) {
        await this.notificationService.createNotification(
          sectionLeader.id,
          NotificationType.REVIEW_PENDING_SECTION_REVIEW,
          `You have ${count} KPI reviews pending approval (section) this week.`,
        );
      }
    }

    for (const [deptId, count] of deptMap.entries()) {
      const deptLeader =
        await this.employeesService.findManagerOfDepartment(deptId);
      if (deptLeader) {
        await this.notificationService.createNotification(
          deptLeader.id,
          NotificationType.REVIEW_PENDING_DEPARTMENT_REVIEW,
          `You have ${count} KPI reviews pending approval (department) this week.`,
        );
      }
    }

    for (const [managerId, count] of managerMap.entries()) {
      const manager =
        await this.employeesService.findManagerOfDepartment(managerId);
      if (manager) {
        await this.notificationService.createNotification(
          manager.id,
          NotificationType.REVIEW_PENDING_MANAGER_REVIEW,
          `You have ${count} KPI reviews pending approval (manager) this week.`,
        );
      }
    }

    for (const [employeeId, count] of employeeMap.entries()) {
      await this.notificationService.createNotification(
        employeeId,
        NotificationType.REVIEW_PENDING_EMPLOYEE_FEEDBACK,
        `You have ${count} KPI reviews pending feedback this week.`,
      );
    }
  }
}
