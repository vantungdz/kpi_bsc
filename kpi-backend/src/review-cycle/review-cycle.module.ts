import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewCycle } from '../entities/review-cycle.entity';
import { ReviewCycleService } from './review-cycle.service';
import { ReviewCycleController } from './review-cycle.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ReviewCycle])],
  providers: [ReviewCycleService],
  controllers: [ReviewCycleController],
  exports: [ReviewCycleService],
})
export class ReviewCycleModule {}
