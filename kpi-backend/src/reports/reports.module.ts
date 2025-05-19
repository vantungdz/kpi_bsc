import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { KpisModule } from '../kpis/kpis.module';
import { EmployeesModule } from 'src/employees/employees.module';
import { DashboardsModule } from '../dashboard/dashboard.module';

@Module({
  imports: [
    KpisModule, // Import KpisModule để sử dụng KpisService
    EmployeesModule, // Import EmployeesModule để sử dụng EmployeesService
    DashboardsModule, // Import DashboardsModule để sử dụng DashboardsService
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
