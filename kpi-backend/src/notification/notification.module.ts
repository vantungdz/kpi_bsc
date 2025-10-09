import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from 'src/notification/entities/notification.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { NotificationService } from './notification.service';
import { NotificationEventListener } from './notification.listener';
import { NotificationsController } from './notification.controller';
import { EmployeesModule } from '../employees/employees.module';
import { NotificationGateway } from './notification.gateway';
import { KpiExpiryScheduler } from './kpi-expiry.scheduler';
import { KpisModule } from '../kpis/kpis.module';
import { ReviewReminderScheduler } from './review-reminder.scheduler';
import { ReviewSummaryScheduler } from './review-summary.scheduler';
import { KpiReview } from '../evaluation/entities/kpi-review.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, Employee, KpiReview]),
    EmployeesModule,
    KpisModule,
  ],
  providers: [
    NotificationService,
    NotificationEventListener,
    NotificationGateway,
    KpiExpiryScheduler,
    ReviewReminderScheduler,
    ReviewSummaryScheduler,
  ],
  controllers: [NotificationsController],
  exports: [NotificationService, NotificationGateway],
})
export class NotificationModule {}
