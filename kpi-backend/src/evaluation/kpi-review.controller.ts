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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  async getKpiReviews(@Req() req, @Query() query: any) {
    return this.kpiReviewService.getKpiReviews(query, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  async getKpiReviewById(@Param('id') id: number, @Req() req) {
    return this.kpiReviewService.getKpiReviewById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  async createKpiReview(@Req() req, @Body() dto: CreateKpiReviewDto) {
    return this.kpiReviewService.createKpiReview(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Put(':id')
  async updateKpiReview(
    @Param('id') id: number,
    @Body() dto: UpdateKpiReviewDto,
    @Req() req,
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
  async submitSectionReview(@Req() req, @Body() body) {
    // req.user.id là id của user section đang duyệt
    return this.kpiReviewService.submitSectionReview(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('department-review')
  async submitDepartmentReview(@Req() req, @Body() body) {
    return this.kpiReviewService.submitDepartmentReview(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('manager-review')
  async submitManagerReview(@Req() req, @Body() body) {
    return this.kpiReviewService.submitManagerReview(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('complete-review')
  async completeReview(@Req() req, @Body() body) {
    return this.kpiReviewService.completeReview(body.reviewId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('employee-feedback')
  async submitEmployeeFeedback(@Req() req, @Body() body) {
    // req.user.id là id của nhân viên feedback
    return this.kpiReviewService.submitEmployeeFeedback(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('submit-review')
  async submitReviewByRole(@Req() req, @Body() body) {
    // Lấy userId và roles từ req.user
    const userId = req.user.id;
    let roles: string[] = [];
    if (Array.isArray(req.user.roles)) {
      roles = req.user.roles.map((r) => (typeof r === 'string' ? r : r?.name)).filter(Boolean);
    } else if (req.user.role) {
      if (typeof req.user.role === 'string') roles = [req.user.role];
      else if (req.user.role?.name) roles = [req.user.role.name];
    }
    if (!roles.length) throw new Error('Thiếu thông tin vai trò người duyệt (controller)');
    // Ưu tiên role cao nhất: admin > manager > department > section
    const priority = ['admin', 'manager', 'department', 'section'];
    const highestRole = priority.find((r) => roles.includes(r));
    if (!highestRole) throw new Error('Không có vai trò hợp lệ để duyệt KPI');
    // body: { reviewId, score, comment }
    return this.kpiReviewService.submitReviewByRole(userId, highestRole, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('reject')
  async rejectReviewByRole(@Req() req, @Body() body) {
    const userId = req.user.id;
    let roles: string[] = [];
    if (Array.isArray(req.user.roles)) {
      roles = req.user.roles.map((r) => (typeof r === 'string' ? r : r?.name)).filter(Boolean);
    } else if (req.user.role) {
      if (typeof req.user.role === 'string') roles = [req.user.role];
      else if (req.user.role?.name) roles = [req.user.role.name];
    }
    if (!roles.length) throw new Error('Thiếu thông tin vai trò người từ chối (controller)');
    const priority = ['admin', 'manager', 'department', 'section'];
    const highestRole = priority.find((r) => roles.includes(r));
    if (!highestRole) throw new Error('Không có vai trò hợp lệ để từ chối KPI');
    // body: { reviewId, rejectionReason }
    return this.kpiReviewService.rejectReviewByRole(userId, highestRole, body);
  }
}
