import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Kpi } from '../kpis/entities/kpi.entity';
import { KpiValue } from '../kpi-values/entities/kpi-value.entity';
import { KPIAssignment } from 'src/kpi-assessments/entities/kpi-assignment.entity';
import { KpiAssignmentsController } from './kpi-assessments.controller';
import { KpiAssignmentsService } from './kpi-assessments.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([KPIAssignment, Kpi, KpiValue]),
    AuditLogModule,
  ],
  controllers: [KpiAssignmentsController],
  providers: [KpiAssignmentsService],
  exports: [KpiAssignmentsService],
})
export class KpiAssignmentsModule {}
