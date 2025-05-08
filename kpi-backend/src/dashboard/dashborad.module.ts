import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardsService } from './dashboard.service';
import { DashboardsController } from './dashboard.controller';
import { KpiValue } from '../entities/kpi-value.entity';
import { Employee } from '../entities/employee.entity'; // Import Employee nếu service cần

@Module({
  imports: [
    TypeOrmModule.forFeature([KpiValue, Employee]), // Thêm Employee nếu service có inject EmployeeRepository
  ],
  providers: [DashboardsService],
  controllers: [DashboardsController],
})
export class DashboardsModule {} // Đổi tên class cho đúng với tên file và module
