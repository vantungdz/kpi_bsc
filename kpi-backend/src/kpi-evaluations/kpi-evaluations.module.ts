import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KpiEvaluation } from './entities/kpi-evaluation.entity';
import { KpiEvaluationsService } from './kpi-evaluations.service';
import { KpiEvaluationsController } from './kpi-evaluations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([KpiEvaluation])],
  providers: [KpiEvaluationsService],
  controllers: [KpiEvaluationsController],
})
export class KpiEvaluationsModule {}
