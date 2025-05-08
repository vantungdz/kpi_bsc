import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardsService } from './dashboard.service';
import { DashboardsController } from './dashboard.controller';
import { KpiValue } from '../entities/kpi-value.entity';
import { Employee } from '../entities/employee.entity';
import { KpiValueHistory } from '../entities/kpi-value-history.entity';
import { Kpi } from '../entities/kpi.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KpiValue,
      KpiValueHistory, // <-- This was missing
      Kpi, // KpiRepository is also injected
      Employee, // Good to include as Employee entity is used
    ]), // Thêm Employee nếu service có inject EmployeeRepository
  ],
  providers: [DashboardsService],
  controllers: [DashboardsController],
})
export class DashboardsModule {}
