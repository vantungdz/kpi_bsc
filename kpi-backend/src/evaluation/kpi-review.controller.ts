import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { KpiReviewService } from './kpi-review.service';
import { CreateKpiReviewDto, UpdateKpiReviewDto } from './dto/kpi-review.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { Request } from 'express';

@Controller('kpi-review')
export class KpiReviewController {
  constructor(private readonly kpiReviewService: KpiReviewService) {}

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMyKpisForReview(@Req() req: Request, @Query('cycle') cycle: string) {
    return this.kpiReviewService.getMyKpisForReview((req as any).user.id, cycle);
  }

  @UseGuards(JwtAuthGuard)
  @Post('my/self-review')
  async submitMyKpiSelfReview(@Req() req: Request, @Body() body: any) {
    return this.kpiReviewService.submitMyKpiSelfReview((req as any).user.id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  async getKpiReviews(@Req() req: Request, @Query() query: any) {
    return this.kpiReviewService.getKpiReviews(query, (req as any).user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  async getKpiReviewById(@Param('id') id: number, @Req() req: Request) {
    return this.kpiReviewService.getKpiReviewById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  async createKpiReview(@Req() req: Request, @Body() dto: CreateKpiReviewDto) {
    return this.kpiReviewService.createKpiReview(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Put(':id')
  async updateKpiReview(
    @Param('id') id: number,
    @Body() dto: UpdateKpiReviewDto,
    @Req() req: Request,
  ) {
    return this.kpiReviewService.updateKpiReview(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('history/:kpiId/:cycle')
  async getKpiReviewHistory(
    @Param('kpiId') kpiId: number,
    @Param('cycle') cycle: string,
    @Query('employeeId') employeeId?: number,
  ) {
    return this.kpiReviewService.getKpiReviewHistory(kpiId, cycle, employeeId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('section-review')
  async submitSectionReview(@Req() req: Request, @Body() body: any) {
    return this.kpiReviewService.submitSectionReview((req as any).user.id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('department-review')
  async submitDepartmentReview(@Req() req: Request, @Body() body: any) {
    return this.kpiReviewService.submitDepartmentReview((req as any).user.id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('manager-review')
  async submitManagerReview(@Req() req: Request, @Body() body: any) {
    return this.kpiReviewService.submitManagerReview((req as any).user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('complete-review')
  async completeReview(@Req() req: Request, @Body() body: { reviewId: number }) {
    return this.kpiReviewService.completeReview(body.reviewId, (req as any).user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('employee-feedback')
  async submitEmployeeFeedback(@Req() req: Request, @Body() body: any) {
    return this.kpiReviewService.submitEmployeeFeedback((req as any).user.id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('submit-review')
  async submitReviewByRole(@Req() req: Request, @Body() body: { reviewId: number; score: number; comment: string }) {
    return this.kpiReviewService.submitReviewByRole((req as any).user.id, (req as any).user, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('reject')
  async rejectReviewByRole(@Req() req: Request, @Body() body: { reviewId: number; rejectionReason: string }) {
    return this.kpiReviewService.rejectReviewByRole((req as any).user.id, (req as any).user, body);
  }
}
