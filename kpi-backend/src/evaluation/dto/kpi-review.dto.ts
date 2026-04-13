import { IsNumber, IsString, IsOptional, IsEnum } from 'class-validator';
import { EvaluationPhase, ReviewStatus } from '../entities/kpi-review.entity';

export class CreateKpiReviewDto {
  @IsNumber()
  kpiId: number;

  @IsString()
  cycle: string;

  @IsEnum(EvaluationPhase)
  evaluationPhase: EvaluationPhase;

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
  @IsNumber()
  selfScore?: number;

  @IsOptional()
  @IsNumber()
  sectionScore?: number;

  @IsOptional()
  @IsString()
  sectionComment?: string;

  @IsOptional()
  @IsNumber()
  departmentScore?: number;

  @IsOptional()
  @IsString()
  departmentComment?: string;

  @IsOptional()
  @IsNumber()
  managerScore?: number;

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

export class SubmitReviewDto {
  @IsNumber()
  reviewId: number;

  @IsNumber()
  score: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  isDraft?: boolean;
}

export class BatchApproveDto {
  @IsNumber({}, { each: true })
  employeeIds: number[];
}
