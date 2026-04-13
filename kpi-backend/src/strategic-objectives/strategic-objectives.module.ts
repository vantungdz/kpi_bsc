import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StrategicObjective } from './entities/strategic-objective.entity';
import { StrategicObjectivesService } from './strategic-objectives.service';
import { StrategicObjectivesController } from './strategic-objectives.controller';
import { Perspective } from '../perspective/entities/perspective.entity';
import { Kpi } from '../kpis/entities/kpi.entity';

/**
 * Module quản lý các mục tiêu chiến lược (StrategicObjective)
 * Combined with related entities like Perspective, KPI
 */
@Module({
  imports: [TypeOrmModule.forFeature([StrategicObjective, Perspective, Kpi])],
  providers: [StrategicObjectivesService],
  controllers: [StrategicObjectivesController],
  exports: [StrategicObjectivesService],
})
export class StrategicObjectivesModule {}
