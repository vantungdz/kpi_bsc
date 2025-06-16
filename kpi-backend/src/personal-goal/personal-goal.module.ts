import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonalGoal } from './personal-goal.entity';
import { PersonalGoalService } from './personal-goal.service';
import { PersonalGoalController } from './personal-goal.controller';
import { KPIAssignment } from '../entities/kpi-assignment.entity';
import { KpiValue } from '../entities/kpi-value.entity';
import { PersonalGoalKpi } from './personal-goal-kpi.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PersonalGoal, PersonalGoalKpi, KPIAssignment, KpiValue])],
  providers: [PersonalGoalService],
  controllers: [PersonalGoalController],
  exports: [PersonalGoalService],
})
export class PersonalGoalModule {}
