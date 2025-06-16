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
    KpisModule, // Import KpisModule để sử dụng KpisService
    EmployeesModule, // Import EmployeesModule để sử dụng EmployeesService
    DashboardsModule, // Import DashboardsModule để sử dụng DashboardsService
    StrategicObjectivesModule, // Thêm để inject StrategicObjectivesService
    KpiValuesModule, // Thêm để inject KpiValuesService
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
