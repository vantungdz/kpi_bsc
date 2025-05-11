import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvaluationService } from './evaluation.service';
import { EvaluationController } from './evaluation.controller';
import { Employee } from '../entities/employee.entity';
import { Section } from '../entities/section.entity';
import { Department } from '../entities/department.entity';
import { KPIAssignment } from '../entities/kpi-assignment.entity';
import { KpiValue } from '../entities/kpi-value.entity';
import { KpiReview } from '../entities/kpi-review.entity';
import { OverallReview } from '../entities/overall-review.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      Section,
      Department,
      KPIAssignment,
      KpiValue,
      KpiReview,
      OverallReview,
    ]),
  ],
  controllers: [EvaluationController],
  providers: [EvaluationService],
})
export class EvaluationModule {}
