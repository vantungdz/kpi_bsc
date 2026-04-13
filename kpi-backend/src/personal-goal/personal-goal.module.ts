import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonalGoal } from './entities/personal-goal.entity';
import { PersonalGoalService } from './personal-goal.service';
import { PersonalGoalController } from './personal-goal.controller';
import { KPIAssignment } from '../kpi-assessments/entities/kpi-assignment.entity';
import { KpiValue } from '../kpi-values/entities/kpi-value.entity';
import { PersonalGoalKpi } from './entities/personal-goal-kpi.entity';

/**
 * Module quản lý các mục tiêu cá nhân (PersonalGoal)
 * Combined with related entities like KPI, KPIAssignment, KpiValue
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PersonalGoal,
      PersonalGoalKpi,
      KPIAssignment,
      KpiValue,
    ]),
  ],
  providers: [PersonalGoalService],
  controllers: [PersonalGoalController],
  exports: [PersonalGoalService],
})
export class PersonalGoalModule {}
