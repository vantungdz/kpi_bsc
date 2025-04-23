import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Kpi } from '../entities/kpi.entity';
import { KpiValue } from '../entities/kpi-value.entity';
import { KPIAssignment } from 'src/entities/kpi-assignment.entity';
import { KpiAssignmentsController } from './kpi-assessments.controller';
import { KpiAssignmentsService } from './kpi-assessments.service';

@Module({
  imports: [TypeOrmModule.forFeature([KPIAssignment, Kpi, KpiValue])],
  controllers: [KpiAssignmentsController],
  providers: [KpiAssignmentsService],
  exports: [KpiAssignmentsService],
})
export class KpiAssignmentsModule {}
