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
 * Kết hợp với các entity liên quan như KPI, KPIAssignment, KpiValue
 */
@Module({
  imports: [TypeOrmModule.forFeature([PersonalGoal, PersonalGoalKpi, KPIAssignment, KpiValue])],
  providers: [PersonalGoalService],
  controllers: [PersonalGoalController],
  exports: [PersonalGoalService],
})
export class PersonalGoalModule {}
