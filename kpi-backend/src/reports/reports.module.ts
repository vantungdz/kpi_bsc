import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { KpisModule } from '../kpis/kpis.module';
import { EmployeesModule } from 'src/employees/employees.module';
import { DashboardsModule } from '../dashboard/dashboard.module';
import { StrategicObjectivesModule } from '../strategic-objectives/strategic-objectives.module';
import { KpiValuesModule } from '../kpi-values/kpi-values.module';

@Module({
  imports: [
    KpisModule,
    EmployeesModule,
    DashboardsModule,
    StrategicObjectivesModule,
    KpiValuesModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
