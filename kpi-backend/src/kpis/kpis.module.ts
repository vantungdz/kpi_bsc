import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KpisService } from './kpis.service';
import { KpisController } from './kpis.controller';
import { Kpi } from './entities/kpi.entity';
import { KpiValue } from '../kpi-values/entities/kpi-value.entity';
import { KpiEvaluation } from '../kpi-evaluations/entities/kpi-evaluation.entity';
import { Employee } from '../employees/entities/employee.entity';
import { Perspective } from '../perspective/entities/perspective.entity';
import { Department } from '../departments/entities/department.entity';
import { Section } from '../sections/entities/section.entity';
import { KPIAssignment } from '../kpi-assessments/entities/kpi-assignment.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Kpi,
      KpiValue,
      KpiEvaluation,
      Employee,
      Perspective,
      Department,
      KpiValue,
      Section,
      KPIAssignment,
    ]),
    AuditLogModule,
  ],
  providers: [KpisService],
  controllers: [KpisController],
  exports: [KpisService],
})
export class KpisModule {}
