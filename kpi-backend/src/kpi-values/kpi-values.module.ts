import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KpiValue } from '../kpi-values/entities/kpi-value.entity';
import { KpiValuesService } from './kpi-values.service';
import { KpiValuesController } from './kpi-values.controller';
import { KpiValueHistory } from 'src/kpi-values/entities/kpi-value-history.entity';
import { KPIAssignment } from 'src/kpi-assessments/entities/kpi-assignment.entity';
import { Employee } from '../employees/entities/employee.entity';
import { ReviewCycle } from '../review-cycle/entities/review-cycle.entity';
import { KpiReview } from '../evaluation/entities/kpi-review.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { KpiReviewModule } from '../evaluation/kpi-review.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KpiValue,
      KpiValueHistory,
      KPIAssignment,
      Employee,
      ReviewCycle,
      KpiReview,
    ]),
    KpiReviewModule,
    AuditLogModule,
  ],
  providers: [KpiValuesService],
  controllers: [KpiValuesController],
  exports: [KpiValuesService], // Add this line to export service
})
export class KpiValuesModule {}
