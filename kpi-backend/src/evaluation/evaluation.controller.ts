import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Get,
  Query,
} from '@nestjs/common';
import { EvaluationService } from './evaluation.service';
import {
  SubmitKpiReviewDto,
  SubmitSelfKpiReviewDto,
  SubmitEmployeeFeedbackDto,
} from './dto/evaluation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../common/rbac/permission.guard';
import { Permission } from '../common/rbac/permission.decorator';
import { RBAC_ACTIONS, RBAC_RESOURCES } from '../common/rbac/rbac.constants';

@Controller('evaluation')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Post('submit-review')
  @Permission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_REVIEW)
  async submitKpiReview(@Body() dto: SubmitKpiReviewDto, @Req() req) {
    const reviewerId = req.user?.id;
    return this.evaluationService.submitKpiReview(dto, reviewerId);
  }

  @Post('submit-self-review')
  @Permission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.MY_KPI_REVIEW)
  async submitSelfKpiReview(@Body() dto: SubmitSelfKpiReviewDto, @Req() req) {
    const employeeId = req.user?.id;
    return this.evaluationService.submitSelfKpiReview(dto, employeeId);
  }

  @Post('submit-employee-feedback')
  @Permission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_REVIEW)
  async submitEmployeeFeedback(
    @Body() dto: SubmitEmployeeFeedbackDto,
    @Req() req,
  ) {
    const employeeId = req.user?.id;
    return this.evaluationService.submitEmployeeFeedback(dto, employeeId);
  }

  @Get('overall-review')
  @Permission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_REVIEW)
  async getOverallReview(
    @Query('targetId') targetId: number,
    @Query('targetType') targetType: 'employee' | 'section' | 'department',
    @Query('cycleId') cycleId: string,
    @Req() req,
  ) {
    const reviewerId = req.user?.id;
    return this.evaluationService.getOverallReview(
      targetId,
      targetType,
      cycleId,
      reviewerId,
    );
  }

  @Get('kpi-reviews')
  @Permission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_REVIEW)
  async getKpiReviews(
    @Query('targetId') targetId: number,
    @Query('targetType') targetType: 'employee' | 'section' | 'department',
    @Query('cycleId') cycleId: string,
    @Req() req,
  ) {
    const reviewerId = req.user?.id;
    return this.evaluationService.getKpiReviews(
      targetId,
      targetType,
      cycleId,
      reviewerId,
    );
  }
}
