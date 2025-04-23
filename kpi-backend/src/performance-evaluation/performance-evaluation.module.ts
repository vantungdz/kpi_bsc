import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; 
import { PerformanceEvaluationService } from './performance-evaluation.service';
import { PerformanceEvaluationController } from './performance-evaluation.controller';
import { PerformanceEvaluation } from 'src/entities/performance-evaluation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PerformanceEvaluation])],
  providers: [PerformanceEvaluationService],
  controllers: [PerformanceEvaluationController],
})
export class PerformanceEvaluationModule {}
