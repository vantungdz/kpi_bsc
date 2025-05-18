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
  UseInterceptors,
  ClassSerializerInterceptor,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
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
  SubmitSelfKpiReviewDto,
  KpisForReviewResponseDto,
  CompleteReviewDto,
  EmployeeReviewResponseDto,
  SubmitEmployeeFeedbackDto,
  ReviewHistoryItemDto,
  ReviewHistoryResponseDto,
  PerformanceObjectiveItemDto,
  PerformanceObjectivesResponseDto,
  EmployeeKpiScoreDto,
} from './dto/evaluation.dto';
import { SavePerformanceObjectivesDto } from './dto/save-performance-objectives.dto';
import { OverallReview } from '../entities/overall-review.entity';
import { ApproveRejectOverallReviewDto } from './dto/approve-reject-overall-review.dto';

@ApiTags('Evaluation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('evaluation')
@UseInterceptors(ClassSerializerInterceptor)
export class EvaluationController {
  private validateUser(req: Request & { user?: Employee }): Employee {
    if (!req.user) {
      throw new UnauthorizedException('User information not available.');
    }
    return req.user;
  }

  constructor(private readonly evaluationService: EvaluationService) {}

  @Get('reviewable-targets')
  @Roles('admin', 'manager', 'section', 'department')
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
  @Roles('admin', 'manager', 'section', 'department')
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
  @Roles('admin', 'manager', 'section', 'department')
  @ApiOperation({ summary: 'Submit KPI review results' })
  @ApiResponse({ status: 200, description: 'Review submitted successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async submitKpiReview(
    @Req() req: Request & { user?: Employee },
    @Body() reviewData: SubmitKpiReviewDto,
  ): Promise<KpisForReviewResponseDto> {
    const user = this.validateUser(req);

    if (
      !['employee', 'section', 'department'].includes(reviewData.targetType)
    ) {
      throw new UnauthorizedException('Invalid targetType in review data.');
    }

    await this.evaluationService.submitKpiReview(user, reviewData);
    return this.evaluationService.getKpisForReview(
      user,
      reviewData.targetId,
      reviewData.targetType,
      reviewData.cycleId,
    );
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
  ): Promise<KpisForReviewResponseDto> {
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
    await this.evaluationService.completeOverallReview(user, completeReviewDto);
    return this.evaluationService.getKpisForReview(
      user,
      completeReviewDto.targetId,
      completeReviewDto.targetType,
      completeReviewDto.cycleId,
    );
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
  ): Promise<void> {
    const user = this.validateUser(req);
    await this.evaluationService.submitEmployeeFeedback(user, feedbackDto);
  }

  @Post('my-review/submit-self-review')
  @Roles('employee', 'section', 'department', 'manager', 'admin')
  @ApiOperation({ summary: 'Nhân viên gửi selfScore/selfComment cho từng KPI' })
  async submitSelfKpiReview(
    @Req() req: Request & { user?: Employee },
    @Body() dto: SubmitSelfKpiReviewDto,
  ): Promise<EmployeeReviewResponseDto> {
    const user = this.validateUser(req);
    return this.evaluationService.submitSelfKpiReview(user, dto);
  }

  @Get('review-history/:targetId')
  @Roles('admin', 'manager', 'employee')
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

  @Get('performance-objectives')
  @Roles('admin', 'manager', 'department', 'section')
  @ApiOperation({
    summary:
      'Get assigned performance objectives for an employee (optionally by cycle)',
  })
  @ApiQuery({ name: 'employeeId', required: true, type: Number })
  @ApiQuery({
    name: 'cycleId',
    required: false,
    type: String,
    description:
      'Optional: If not provided, fetches currently active objectives or based on backend default logic.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of assigned performance objectives.',
    type: PerformanceObjectivesResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getPerformanceObjectives(
    @Req() req: Request & { user?: Employee },
    @Query('employeeId', ParseIntPipe) employeeId: number,
    @Query('cycleId') cycleId?: string,
  ): Promise<PerformanceObjectivesResponseDto> {
    const user = this.validateUser(req);
    const result = await this.evaluationService.getPerformanceObjectivesForEmployee(
      employeeId,
      cycleId,
    );
    // Only return the fields present in the new service response
    return {
      objectives: result.objectives,
      totalWeightedScoreSupervisor: result.totalWeightedScoreSupervisor,
    };
  }

  @Get('employee-kpi-scores')
  @Roles('admin', 'manager', 'department')
  @ApiOperation({
    summary:
      'Get list of employees and their total Weighted Score (Supervisor) for a review cycle',
  })
  @ApiQuery({ name: 'cycleId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of employees and their total Weighted Score',
    type: [EmployeeKpiScoreDto],
  })
  async getEmployeeKpiScores(
    @Req() req: Request & { user?: Employee },
    @Query('cycleId') cycleId: string,
  ): Promise<EmployeeKpiScoreDto[]> {
    const user = this.validateUser(req);
    return this.evaluationService.getEmployeeKpiScores(user, cycleId);
  }

  @Post('overall-reviews/:id/approve-section')
  @Roles('admin', 'manager', 'section')
  @ApiOperation({
    summary: 'Approve an overall review at the section level',
  })
  @ApiResponse({
    status: 200,
    description: 'Overall review approved at section level.',
    type: OverallReview,
  })
  async approveOverallReviewSection(
    @Req() req: Request & { user?: Employee },
    @Param('id', ParseIntPipe) reviewId: number,
  ): Promise<OverallReview> {
    const user = this.validateUser(req);
    return this.evaluationService.approveSectionReview(reviewId, user);
  }

  @Post('overall-reviews/:id/reject-section')
  @Roles('admin', 'manager', 'section')
  @ApiOperation({
    summary: 'Reject an overall review at the section level',
  })
  @ApiBody({ type: ApproveRejectOverallReviewDto })
  @ApiResponse({
    status: 200,
    description: 'Overall review rejected at section level.',
    type: OverallReview,
  })
  async rejectOverallReviewSection(
    @Req() req: Request & { user?: Employee },
    @Param('id', ParseIntPipe) reviewId: number,
    @Body() payload: ApproveRejectOverallReviewDto,
  ): Promise<OverallReview> {
    const user = this.validateUser(req);
    return this.evaluationService.rejectSectionReview(
      reviewId,
      user,
      payload.comment,
    );
  }

  @Post('overall-reviews/:id/approve-dept')
  @Roles('admin', 'manager', 'department')
  @ApiOperation({
    summary: 'Approve an overall review at the department level',
  })
  @ApiResponse({
    status: 200,
    description: 'Overall review approved at department level.',
    type: OverallReview,
  })
  async approveOverallReviewDept(
    @Req() req: Request & { user?: Employee },
    @Param('id', ParseIntPipe) reviewId: number,
  ): Promise<OverallReview> {
    const user = this.validateUser(req);
    return this.evaluationService.approveDepartmentReview(reviewId, user);
  }

  @Post('overall-reviews/:id/reject-dept')
  @Roles('admin', 'manager', 'department')
  @ApiOperation({
    summary: 'Reject an overall review at the department level',
  })
  @ApiBody({ type: ApproveRejectOverallReviewDto })
  @ApiResponse({
    status: 200,
    description: 'Overall review rejected at department level.',
    type: OverallReview,
  })
  async rejectOverallReviewDept(
    @Req() req: Request & { user?: Employee },
    @Param('id', ParseIntPipe) reviewId: number,
    @Body() payload: ApproveRejectOverallReviewDto,
  ): Promise<OverallReview> {
    const user = this.validateUser(req);
    return this.evaluationService.rejectDepartmentReview(
      reviewId,
      user,
      payload.comment,
    );
  }

  @Post('overall-reviews/:id/approve-manager')
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Approve an overall review at the manager/final level',
  })
  @ApiResponse({
    status: 200,
    description: 'Overall review approved at manager/final level.',
    type: OverallReview,
  })
  async approveOverallReviewManager(
    @Req() req: Request & { user?: Employee },
    @Param('id', ParseIntPipe) reviewId: number,
  ): Promise<OverallReview> {
    const user = this.validateUser(req);
    return this.evaluationService.approveManagerReview(reviewId, user);
  }

  @Post('overall-reviews/:id/reject-manager')
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Reject an overall review at the manager/final level',
  })
  @ApiBody({ type: ApproveRejectOverallReviewDto })
  @ApiResponse({
    status: 200,
    description: 'Overall review rejected at manager/final level.',
    type: OverallReview,
  })
  async rejectOverallReviewManager(
    @Req() req: Request & { user?: Employee },
    @Param('id', ParseIntPipe) reviewId: number,
    @Body() payload: ApproveRejectOverallReviewDto,
  ): Promise<OverallReview> {
    const user = this.validateUser(req);
    return this.evaluationService.rejectManagerReview(
      reviewId,
      user,
      payload.comment,
    );
  }

  @Get('employee-reviews-list')
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Get all employee KPI reviews and feedbacks for a manager in a cycle',
  })
  @ApiQuery({ name: 'cycleId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of employee reviews and feedbacks.',
    type: [EmployeeReviewResponseDto],
  })
  async getEmployeeReviewsListForManager(
    @Req() req: Request & { user?: Employee },
    @Query('cycleId') cycleId: string,
  ): Promise<EmployeeReviewResponseDto[]> {
    const user = this.validateUser(req);
    return this.evaluationService.getEmployeeReviewsListForManager(user, cycleId);
  }

  @Get('overall-reviews/managed')
  @Roles('admin', 'manager', 'department', 'section')
  async getManagedEmployeeOverallReviews(
    @Req() req: Request & { user?: Employee },
    @Query('statuses') statuses?: string, // comma-separated
  ) {
    const user = this.validateUser(req);
    let statusList: string[] | undefined = undefined;
    if (statuses) {
      statusList = statuses.split(',').map(s => s.trim());
    }
    return this.evaluationService.getManagedEmployeeOverallReviews(user, statusList);
  }
}
