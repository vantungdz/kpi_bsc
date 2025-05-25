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

@Controller('kpi-review')
export class KpiReviewController {
  constructor(private readonly kpiReviewService: KpiReviewService) {}

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMyKpisForReview(@Req() req, @Query('cycle') cycle: string) {
    return this.kpiReviewService.getMyKpisForReview(req.user.id, cycle);
  }

  @UseGuards(JwtAuthGuard)
  @Post('my/self-review')
  async submitMyKpiSelfReview(@Req() req, @Body() body) {
    return this.kpiReviewService.submitMyKpiSelfReview(req.user.id, body);
  }

  @Get()
  async getKpiReviews(@Query() query: any) {
    return this.kpiReviewService.getKpiReviews(query);
  }

  @Get(':id')
  async getKpiReviewById(@Param('id') id: number) {
    return this.kpiReviewService.getKpiReviewById(id);
  }

  @Post()
  async createKpiReview(@Body() dto: CreateKpiReviewDto) {
    return this.kpiReviewService.createKpiReview(dto);
  }

  @Put(':id')
  async updateKpiReview(
    @Param('id') id: number,
    @Body() dto: UpdateKpiReviewDto,
  ) {
    return this.kpiReviewService.updateKpiReview(id, dto);
  }

  @Get('history/:kpiId/:cycle')
  async getReviewHistory(
    @Param('kpiId') kpiId: number,
    @Param('cycle') cycle: string,
  ) {
    return this.kpiReviewService.getReviewHistory(kpiId, cycle);
  }

  @UseGuards(JwtAuthGuard)
  @Post('section-review')
  async submitSectionReview(@Req() req, @Body() body) {
    // req.user.id là id của user section đang duyệt
    return this.kpiReviewService.submitSectionReview(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('department-review')
  async submitDepartmentReview(@Req() req, @Body() body) {
    return this.kpiReviewService.submitDepartmentReview(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('manager-review')
  async submitManagerReview(@Req() req, @Body() body) {
    return this.kpiReviewService.submitManagerReview(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('complete-review')
  async completeReview(@Req() req, @Body() body) {
    return this.kpiReviewService.completeReview(body.reviewId, req.user.id);
  }
}
