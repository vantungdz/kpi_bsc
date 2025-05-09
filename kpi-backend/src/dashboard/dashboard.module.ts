import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardsService } from './dashboard.service';
import { DashboardsController } from './dashboard.controller';
import { KpiValue } from '../entities/kpi-value.entity';
import { Employee } from '../entities/employee.entity';
import { KpiValueHistory } from '../entities/kpi-value-history.entity';
import { Kpi } from '../entities/kpi.entity';
import { KPIAssignment } from 'src/entities/kpi-assignment.entity';

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
})
export class DashboardsModule {}
