import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KpiReview } from './entities/kpi-review.entity';
import { Kpi } from '../kpis/entities/kpi.entity';
import { KpiReviewService } from './kpi-review.service';
import { KpiReviewController } from './kpi-review.controller';
import { KPIAssignment } from '../kpi-assessments/entities/kpi-assignment.entity';
import { KpiValue } from '../kpi-values/entities/kpi-value.entity';
import { KpiReviewHistory } from '../kpi-evaluations/entities/kpi-review-history.entity';
import { NotificationModule } from '../notification/notification.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([KpiReview, Kpi, KPIAssignment, KpiValue, KpiReviewHistory]),
    NotificationModule, // Import NotificationModule to provide NotificationService
    EmployeesModule, // Import EmployeesModule to provide EmployeesService
  ],
  providers: [KpiReviewService],
  controllers: [KpiReviewController],
  exports: [KpiReviewService],
})
export class KpiReviewModule {}
