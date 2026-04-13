import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KpisService } from './kpis.service';
import { KpisController } from './kpis.controller';
import { KpiCalculationService } from './services/kpi-calculation.service';
import { KpiCrudService } from './services/kpi-crud.service';
import { KpiQueryService } from './services/kpi-query.service';
import { KpiAssignmentService } from './services/kpi-assignment.service';
import { KpiApprovalService } from './services/kpi-approval.service';
import { Kpi } from './entities/kpi.entity';
import { KpiValue } from '../kpi-values/entities/kpi-value.entity';
import { KpiEvaluation } from '../kpi-evaluations/entities/kpi-evaluation.entity';
import { Employee } from '../employees/entities/employee.entity';
import { Perspective } from '../perspective/entities/perspective.entity';
import { Department } from '../departments/entities/department.entity';
import { Section } from '../sections/entities/section.entity';
import { KPIAssignment } from '../kpi-assessments/entities/kpi-assignment.entity';
import { KpiReview } from '../evaluation/entities/kpi-review.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { EmployeesModule } from '../employees/employees.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Kpi,
      KpiValue,
      KpiEvaluation,
      Employee,
      Perspective,
      Department,
      Section,
      KPIAssignment,
      KpiReview,
    ]),
    AuditLogModule,
    EmployeesModule,
    forwardRef(() => NotificationModule),
  ],
  providers: [
    KpisService,
    KpiCalculationService,
    KpiCrudService,
    KpiQueryService,
    KpiAssignmentService,
    KpiApprovalService,
  ],
  controllers: [KpisController],
  exports: [
    KpisService,
    KpiCalculationService,
    KpiCrudService,
    KpiQueryService,
    KpiAssignmentService,
    KpiApprovalService,
  ],
})
export class KpisModule {}
