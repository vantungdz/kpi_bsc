import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository, LessThan, Not, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  KpiReview,
  ReviewStatus,
} from '../evaluation/entities/kpi-review.entity';
import { NotificationService } from './notification.service';
import { NotificationType } from './entities/notification.entity';
import { EmployeesService } from '../employees/employees.service';

@Injectable()
export class ReviewReminderScheduler {
  private readonly logger = new Logger(ReviewReminderScheduler.name);
  constructor(
    @InjectRepository(KpiReview)
    private readonly kpiReviewRepository: Repository<KpiReview>,
    private readonly notificationService: NotificationService,
    private readonly employeesService: EmployeesService,
  ) {}

  /**
   * Runs daily to remind about reviews pending approval for more than 3 days
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async sendReviewReminders() {
    this.logger.log('Running review reminder check...');
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const waitingStatuses: ReviewStatus[] = [
      ReviewStatus.SELF_REVIEWED,
      ReviewStatus.SECTION_REVIEWED,
      ReviewStatus.DEPARTMENT_REVIEWED,
      ReviewStatus.MANAGER_REVIEWED,
      ReviewStatus.EMPLOYEE_FEEDBACK,
    ];

    const reviews = await this.kpiReviewRepository.find({
      where: {
        status: In(waitingStatuses),
        updatedAt: LessThan(threeDaysAgo),
      },
      relations: ['kpi', 'employee', 'department', 'section'],
    });
    for (const review of reviews) {
      let notifyUserId: number | null = null;
      let message = '';
      let type: NotificationType | null = null;
      if (
        review.status === ReviewStatus.SELF_REVIEWED &&
        review.section &&
        review.section.id
      ) {
        const sectionLeader = await this.employeesService.findLeaderOfSection(
          review.section.id,
        );
        if (sectionLeader) {
          notifyUserId = sectionLeader.id;
          type = NotificationType.REVIEW_PENDING_SECTION_REVIEW;
          message = `Reminder: KPI review "${review.kpi.name}" for employee ${review.employee.first_name || ''} ${review.employee.last_name || ''} is waiting for your approval (section).`;
        }
      } else if (
        review.status === ReviewStatus.SECTION_REVIEWED &&
        review.department &&
        review.department.id
      ) {
        const deptLeader = await this.employeesService.findManagerOfDepartment(
          review.department.id,
        );
        if (deptLeader) {
          notifyUserId = deptLeader.id;
          type = NotificationType.REVIEW_PENDING_DEPARTMENT_REVIEW;
          message = `Reminder: KPI review "${review.kpi.name}" for employee ${review.employee.first_name || ''} ${review.employee.last_name || ''} is waiting for your approval (department).`;
        }
      } else if (
        review.status === ReviewStatus.DEPARTMENT_REVIEWED &&
        review.department &&
        review.department.id
      ) {
        const manager = await this.employeesService.findManagerOfDepartment(
          review.department.id,
        );
        if (manager) {
          notifyUserId = manager.id;
          type = NotificationType.REVIEW_PENDING_MANAGER_REVIEW;
          message = `Reminder: KPI review "${review.kpi.name}" for employee ${review.employee.first_name || ''} ${review.employee.last_name || ''} is waiting for your approval (manager).`;
        }
      } else if (review.status === ReviewStatus.EMPLOYEE_FEEDBACK) {
        notifyUserId = review.employee.id;
        type = NotificationType.REVIEW_PENDING_EMPLOYEE_FEEDBACK;
        message = `Reminder: You need to respond to KPI review "${review.kpi.name}".`;
      }
      if (notifyUserId && type) {
        await this.notificationService.createNotification(
          notifyUserId,
          type,
          message,
          review.id,
          'KPI_REVIEW',
          review.kpi.id,
        );
      }
    }
  }
}
