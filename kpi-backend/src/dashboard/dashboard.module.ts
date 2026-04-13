import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardsService } from './dashboard.service';
import { DashboardsController } from './dashboard.controller';
import { KpiValue } from '../kpi-values/entities/kpi-value.entity';
import { Employee } from '../employees/entities/employee.entity';
import { KpiValueHistory } from '../kpi-values/entities/kpi-value-history.entity';
import { Kpi } from '../kpis/entities/kpi.entity';
import { KPIAssignment } from '../kpi-assessments/entities/kpi-assignment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KpiValue,
      KpiValueHistory,
      Kpi,
      Employee,
      KPIAssignment,
    ]),
  ],
  providers: [DashboardsService],
  controllers: [DashboardsController],
  exports: [DashboardsService],
})
export class DashboardsModule {}
