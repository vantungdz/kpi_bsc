import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StrategicObjective } from '../entities/strategic-objective.entity';
import { StrategicObjectivesService } from './strategic-objectives.service';
import { StrategicObjectivesController } from './strategic-objectives.controller';
import { Perspective } from '../entities/perspective.entity';
import { Kpi } from '../entities/kpi.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StrategicObjective, Perspective, Kpi])],
  providers: [StrategicObjectivesService],
  controllers: [StrategicObjectivesController],
  exports: [StrategicObjectivesService],
})
export class StrategicObjectivesModule {}
