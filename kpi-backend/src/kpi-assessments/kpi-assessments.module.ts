import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Kpi } from '../kpis/entities/kpi.entity';
import { KpiValue } from '../kpi-values/entities/kpi-value.entity';
import { KPIAssignment } from 'src/kpi-assessments/entities/kpi-assignment.entity';
import { KpiAssignmentsController } from './kpi-assessments.controller';
import { KpiAssignmentsService } from './kpi-assessments.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { KpiReview } from '../evaluation/entities/kpi-review.entity';
import { Employee } from '../employees/entities/employee.entity';
import { KpiReviewModule } from '../evaluation/kpi-review.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([KPIAssignment, Kpi, KpiValue, KpiReview, Employee]),
    KpiReviewModule,
    AuditLogModule,
  ],
  controllers: [KpiAssignmentsController],
  providers: [KpiAssignmentsService],
  exports: [KpiAssignmentsService],
})
export class KpiAssignmentsModule {}
