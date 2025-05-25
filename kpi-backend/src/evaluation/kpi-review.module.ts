import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KpiReview } from '../entities/kpi-review.entity';
import { Kpi } from '../entities/kpi.entity';
import { KpiReviewService } from './kpi-review.service';
import { KpiReviewController } from './kpi-review.controller';
import { KPIAssignment } from '../entities/kpi-assignment.entity';
import { KpiValue } from '../entities/kpi-value.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([KpiReview, Kpi, KPIAssignment, KpiValue]),
  ],
  providers: [KpiReviewService],
  controllers: [KpiReviewController],
  exports: [KpiReviewService],
})
export class KpiReviewModule {}
