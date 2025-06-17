import { IsNumber, IsString, IsOptional, IsEnum } from 'class-validator';
import { ReviewStatus } from '../entities/kpi-review.entity';

export class CreateKpiReviewDto {
  @IsNumber()
  kpiId: number;

  @IsString()
  cycle: string;

  @IsNumber()
  targetValue: number;

  @IsNumber()
  actualValue: number;

  @IsOptional()
  @IsNumber()
  score?: number;

  @IsOptional()
  @IsString()
  managerComment?: string;

  @IsOptional()
  @IsString()
  actionPlan?: string;

  @IsOptional()
  @IsString()
  employeeFeedback?: string;

  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;
}

export class UpdateKpiReviewDto {
  @IsOptional()
  @IsNumber()
  score?: number;

  @IsOptional()
  @IsString()
  managerComment?: string;

  @IsOptional()
  @IsString()
  actionPlan?: string;

  @IsOptional()
  @IsString()
  employeeFeedback?: string;

  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;
}

export class RejectKpiReviewDto {
  @IsNumber()
  reviewId: number;

  @IsString()
  rejectionReason: string;
}
