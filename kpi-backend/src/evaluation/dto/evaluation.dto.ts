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
  cycleId: string;

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
