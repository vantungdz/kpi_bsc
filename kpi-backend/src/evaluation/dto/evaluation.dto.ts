import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsArray,
  IsOptional,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class KpiReviewItemDto {
  @ApiProperty()
  @IsNumber()
  assignmentId: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  managerScore?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  managerComment?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  selfScore?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  selfComment?: string;
}

export class SubmitKpiReviewDto {
  @ApiProperty()
  @IsNumber()
  targetId: number;

  @ApiProperty()
  @IsString()
  targetType: 'employee' | 'section' | 'department';

  @ApiProperty()
  @IsString()
  cycleId: string;

  @ApiProperty({ type: [KpiReviewItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KpiReviewItemDto)
  kpiReviews: KpiReviewItemDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  overallComment?: string;
}

export class SubmitEmployeeFeedbackDto {
  @ApiProperty()
  @IsNumber()
  cycleId: number;

  @ApiProperty()
  @IsString()
  employeeComment: string;
}

export class SubmitSelfKpiReviewDto {
  @ApiProperty()
  @IsString()
  cycleId: string;

  @ApiProperty({ type: [KpiReviewItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KpiReviewItemDto)
  kpiReviews: KpiReviewItemDto[];
}

export class ReviewableTargetDto {
  id: number;
  name: string;
  type: 'employee' | 'section' | 'department';
}

export class ReviewCycleDto {
  id: string;
  name: string;
}

export class KpiToReviewDto {
  assignmentId: number;
  kpiId: number;
  kpiName: string;
  kpiDescription?: string | null;
  targetValue: number | null;
  actualValue: number | null;
  unit: string | null;
  weight?: number | null;
  existingManagerComment?: string | null;
  existingManagerScore?: number | null;
  selfScore?: number | null;
  selfComment?: string | null;
}

export class ExistingOverallReviewDto {
  overallComment?: string | null;
  status?: string;
  employeeComment?: string | null;
  employeeFeedbackDate?: Date | null;
  totalWeightedScoreSupervisor?: number | null;
}

export class KpisForReviewResponseDto {
  kpisToReview: KpiToReviewDto[];
  existingOverallReview?: ExistingOverallReviewDto | null;
}

export class CompleteReviewDto {
  targetId: number;
  targetType: 'employee' | 'section' | 'department';
  cycleId: string;
}

export class EmployeeReviewResponseDto {
  kpisReviewedByManager: KpiToReviewDto[];
  overallReviewByManager: ExistingOverallReviewDto | null;
  totalWeightedScoreSupervisor?: number | null;
}

export class ReviewHistoryItemDto {
  overallReviewId: number;
  cycleId: string;
  overallComment?: string | null;
  status: string; // OverallReviewStatus
  reviewedByUsername: string; // Username of the manager
  reviewedAt: Date; // Date of the overall review
  employeeComment?: string | null;
  employeeFeedbackDate?: Date | null;
}

export type ReviewHistoryResponseDto = ReviewHistoryItemDto[];

export class PerformanceObjectiveItemDto {
  id: number; // Corresponds to KPIAssignment ID
  name: string; // KPI Name
  kpiDescription?: string | null;
  target: number | string | null; // Target value from KPIAssignment, can be number or string
  actualResult: number | string | null; // Actual result, can be number or string
  unit?: string | null;
  weight?: number | null;
  bscAspect: string; // Name of the BSC Perspective
  supervisorEvalScore?: number | null; // Supervisor's score for this objective
  note?: string | null; // Supervisor's note for this objective
  start_date?: Date | null; // Start date of the assignment
  end_date?: Date | null; // End date of the assignment
}

export class PerformanceObjectivesResponseDto {
  @ApiProperty({ type: [PerformanceObjectiveItemDto] })
  objectives: PerformanceObjectiveItemDto[];

  @ApiProperty({ type: 'number', nullable: true })
  totalWeightedScoreSupervisor?: number;
}

export class EmployeeKpiScoreDto {
  employeeId: number;
  fullName: string;
  department: string;
  totalWeightedScore: number;
  reviewStatus?: string; // Add review status for UI distinction
}

export class RejectObjectiveEvaluationPayloadDto {
  @ApiProperty({
    description: 'Reason for rejection',
    example: 'Targets not clearly defined.',
  })
  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class ObjectiveEvaluationHistoryItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ nullable: true })
  reason: string | null;

  @ApiProperty({
    type: 'object',
    properties: {
      id: { type: 'number' },
      first_name: { type: 'string' },
      last_name: { type: 'string' },
      username: { type: 'string' },
    },
    nullable: true,
  })
  changedBy: {
    id: number;
    first_name: string;
    last_name: string;
    username: string;
  } | null;

  @ApiProperty()
  timestamp: Date;
}

export class ObjectiveEvaluationListItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty({
    type: 'object',
    properties: {
      id: { type: 'number' },
      first_name: { type: 'string' },
      last_name: { type: 'string' },
      username: { type: 'string' },
    },
    nullable: true,
  })
  employee: {
    id: number;
    first_name: string;
    last_name: string;
    username: string;
  } | null;

  @ApiProperty({
    type: 'object',
    properties: {
      id: { type: 'number' },
      first_name: { type: 'string' },
      last_name: { type: 'string' },
      username: { type: 'string' },
    },
    nullable: true,
  })
  evaluator: {
    id: number;
    first_name: string;
    last_name: string;
    username: string;
  } | null;

  @ApiProperty()
  cycleId: string;

  @ApiProperty({ nullable: true })
  totalWeightedScoreSupervisor?: number;

  @ApiProperty({ nullable: true })
  averageScoreSupervisor?: number;

  @ApiProperty()
  updated_at: Date;

  // Add other fields if needed by the frontend list
}
