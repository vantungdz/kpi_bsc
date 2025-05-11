import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UnauthorizedException,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { Employee } from '../entities/employee.entity';
import { EvaluationService } from './evaluation.service';
import {
  ReviewableTargetDto,
  ReviewCycleDto,
  KpiToReviewDto,
  SubmitKpiReviewDto,
  KpisForReviewResponseDto,
  CompleteReviewDto,
  EmployeeReviewResponseDto,
  SubmitEmployeeFeedbackDto,
  ReviewHistoryItemDto,
  ReviewHistoryResponseDto,
} from './dto/evaluation.dto';
import { OverallReview } from 'src/entities/overall-review.entity';

@ApiTags('Evaluation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('evaluation')
export class EvaluationController {
  private validateUser(req: Request & { user?: Employee }): Employee {
    if (!req.user) {
      throw new UnauthorizedException('User information not available.');
    }
    return req.user;
  }

  constructor(private readonly evaluationService: EvaluationService) {}

  @Get('reviewable-targets')
  @Roles('admin', 'manager')
  @ApiOperation({
    summary:
      'Get list of employees/sections/departments the current user can review',
  })
  @ApiResponse({
    status: 200,
    description: 'List of reviewable targets.',
    type: [ReviewableTargetDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getReviewableTargets(
    @Req() req: Request & { user?: Employee },
  ): Promise<ReviewableTargetDto[]> {
    const user = this.validateUser(req);
    return this.evaluationService.getReviewableTargets(user);
  }

  @Get('review-cycles')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Get list of available review cycles' })
  @ApiResponse({
    status: 200,
    description: 'List of review cycles.',
    type: [ReviewCycleDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getReviewCycles(
    @Req() req: Request & { user?: Employee },
  ): Promise<ReviewCycleDto[]> {
    const user = this.validateUser(req);
    return this.evaluationService.getReviewCycles(user);
  }

  @Get('kpis-for-review')
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Get list of KPIs to review for a specific target and cycle',
  })
  @ApiQuery({ name: 'targetId', required: true, type: Number })
  @ApiQuery({
    name: 'targetType',
    required: true,
    enum: ['employee', 'section', 'department'],
  })
  @ApiQuery({ name: 'cycleId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of KPIs and existing overall review.',
    type: KpisForReviewResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getKpisForReview(
    @Req() req: Request & { user?: Employee },
    @Query('targetId', ParseIntPipe) targetId: number,
    @Query('targetType') targetType: 'employee' | 'section' | 'department',
    @Query('cycleId') cycleId: string,
  ): Promise<KpisForReviewResponseDto> {
    const user = this.validateUser(req);

    if (!['employee', 'section', 'department'].includes(targetType)) {
      throw new UnauthorizedException('Invalid targetType.');
    }
    return this.evaluationService.getKpisForReview(
      user,
      targetId,
      targetType,
      cycleId,
    );
  }

  @Post('submit-review')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Submit KPI review results' })
  @ApiResponse({ status: 200, description: 'Review submitted successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async submitKpiReview(
    @Req() req: Request & { user?: Employee },
    @Body() reviewData: SubmitKpiReviewDto,
  ): Promise<OverallReview | null> {
    const user = this.validateUser(req);

    if (
      !['employee', 'section', 'department'].includes(reviewData.targetType)
    ) {
      throw new UnauthorizedException('Invalid targetType in review data.');
    }

    return this.evaluationService.submitKpiReview(user, reviewData);
  }

  @Post('complete-review')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Mark an overall review as completed' })
  @ApiResponse({
    status: 200,
    description: 'Review marked as completed successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or review not found/not in correct state.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async completeReview(
    @Req() req: Request & { user?: Employee },
    @Body() completeReviewDto: CompleteReviewDto,
  ): Promise<{ message: string; updatedReview: OverallReview }> {
    const user = this.validateUser(req);
    if (
      !['employee', 'section', 'department'].includes(
        completeReviewDto.targetType,
      )
    ) {
      throw new UnauthorizedException(
        'Invalid targetType in complete review data.',
      );
    }
    const updatedReview = await this.evaluationService.completeOverallReview(
      user,
      completeReviewDto,
    );
    return { message: 'Review completed successfully', updatedReview };
  }

  @Get('my-review/:cycleId')
  @Roles('employee', 'section', 'department', 'manager', 'admin')
  async getMyReview(
    @Req() req: Request & { user?: Employee },
    @Param('cycleId') cycleId: string,
  ): Promise<EmployeeReviewResponseDto> {
    const user = this.validateUser(req);
    return this.evaluationService.getEmployeeReviewDetails(user, cycleId);
  }

  @Post('my-review/submit-feedback')
  @Roles('employee', 'section', 'department', 'manager', 'admin')
  async submitEmployeeFeedback(
    @Req() req: Request & { user?: Employee },
    @Body() feedbackDto: SubmitEmployeeFeedbackDto,
  ): Promise<OverallReview> {
    const user = this.validateUser(req);
    return this.evaluationService.submitEmployeeFeedback(user, feedbackDto);
  }

  @Get('review-history/:targetId')
  @Roles('admin', 'manager', 'employee') // Employee can view their own, manager/admin can view others they manage
  @ApiOperation({
    summary:
      'Get review history for a specific target (employee/section/department)',
  })
  @ApiQuery({
    name: 'targetType',
    required: true,
    enum: ['employee', 'section', 'department'],
  })
  @ApiResponse({
    status: 200,
    description: 'Review history retrieved successfully.',
    type: [ReviewHistoryItemDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({
    status: 404,
    description: 'Target not found or no history available.',
  })
  async getReviewHistory(
    @Req() req: Request & { user?: Employee },
    @Param('targetId', ParseIntPipe) targetId: number,
    @Query('targetType') targetType: 'employee' | 'section' | 'department',
  ): Promise<ReviewHistoryResponseDto> {
    const user = this.validateUser(req);
    if (!['employee', 'section', 'department'].includes(targetType)) {
      throw new BadRequestException('Invalid targetType for review history.');
    }
    return this.evaluationService.getReviewHistory(user, targetId, targetType);
  }
}
