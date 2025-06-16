import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KpisService } from './kpis.service';
import { KpisController } from './kpis.controller';
import { Kpi } from '../entities/kpi.entity';
import { KpiValue } from '../entities/kpi-value.entity';
import { KpiEvaluation } from '../entities/kpi-evaluation.entity';
import { Employee } from '../entities/employee.entity';
import { Perspective } from 'src/entities/perspective.entity';
import { Department } from 'src/entities/department.entity';
import { Section } from 'src/entities/section.entity';
import { KPIAssignment } from 'src/entities/kpi-assignment.entity';
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
