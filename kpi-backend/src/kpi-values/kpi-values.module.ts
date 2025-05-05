import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KpiValue } from '../entities/kpi-value.entity';
import { KpiValuesService } from './kpi-values.service';
import { KpiValuesController } from './kpi-values.controller';
import { KpiValueHistory } from 'src/entities/kpi-value-history.entity';
import { KPIAssignment } from 'src/entities/kpi-assignment.entity';
import { Employee } from '../entities/employee.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KpiValue,
      KpiValueHistory,
      KPIAssignment,
      Employee,
    ]),
  ],
  providers: [KpiValuesService],
  controllers: [KpiValuesController],
})
export class KpiValuesModule {}
