import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository, LessThan, Not, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { KpiReview, ReviewStatus } from '../evaluation/entities/kpi-review.entity';
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
   * Chạy mỗi ngày để nhắc nhở các review đang chờ duyệt quá 3 ngày
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async sendReviewReminders() {
    this.logger.log('Running review reminder check...');
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    // Các trạng thái cần nhắc nhở
    const waitingStatuses: ReviewStatus[] = [
      ReviewStatus.SELF_REVIEWED,
      ReviewStatus.SECTION_REVIEWED,
      ReviewStatus.DEPARTMENT_REVIEWED,
      ReviewStatus.MANAGER_REVIEWED,
      ReviewStatus.EMPLOYEE_FEEDBACK,
    ];
    // Lấy các review ở trạng thái chờ duyệt quá 3 ngày
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
      if (review.status === ReviewStatus.SELF_REVIEWED && review.section && review.section.id) {
        // Nhắc section leader duyệt
        const sectionLeader = await this.employeesService.findLeaderOfSection(review.section.id);
        if (sectionLeader) {
          notifyUserId = sectionLeader.id;
          type = NotificationType.REVIEW_PENDING_SECTION_REVIEW;
          message = `Nhắc nhở: Có review KPI "${review.kpi.name}" của nhân viên ${review.employee.first_name || ''} ${review.employee.last_name || ''} chờ bạn duyệt (section).`;
        }
      } else if (review.status === ReviewStatus.SECTION_REVIEWED && review.department && review.department.id) {
        // Nhắc department leader duyệt
        const deptLeader = await this.employeesService.findManagerOfDepartment(review.department.id);
        if (deptLeader) {
          notifyUserId = deptLeader.id;
          type = NotificationType.REVIEW_PENDING_DEPARTMENT_REVIEW;
          message = `Nhắc nhở: Có review KPI "${review.kpi.name}" của nhân viên ${review.employee.first_name || ''} ${review.employee.last_name || ''} chờ bạn duyệt (department).`;
        }
      } else if (review.status === ReviewStatus.DEPARTMENT_REVIEWED && review.department && review.department.id) {
        // Nhắc manager duyệt
        const manager = await this.employeesService.findManagerOfDepartment(review.department.id);
        if (manager) {
          notifyUserId = manager.id;
          type = NotificationType.REVIEW_PENDING_MANAGER_REVIEW;
          message = `Nhắc nhở: Có review KPI "${review.kpi.name}" của nhân viên ${review.employee.first_name || ''} ${review.employee.last_name || ''} chờ bạn duyệt (manager).`;
        }
      } else if (review.status === ReviewStatus.EMPLOYEE_FEEDBACK) {
        // Nhắc nhân viên phản hồi
        notifyUserId = review.employee.id;
        type = NotificationType.REVIEW_PENDING_EMPLOYEE_FEEDBACK;
        message = `Nhắc nhở: Bạn cần phản hồi đánh giá KPI "${review.kpi.name}".`;
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
