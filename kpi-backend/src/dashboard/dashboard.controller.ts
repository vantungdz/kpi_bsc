import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { Employee } from '../entities/employee.entity';
import { DashboardsService } from './dashboard.service';
import {
  KpiInventoryDto,
  KpiPerformanceOverviewDto,
} from './dto/dashboard.dto';

@ApiTags('Dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  // Helper method to validate user
  private validateUser(req: Request & { user?: Employee }): Employee {
    if (!req.user) {
      throw new UnauthorizedException('User information not available.');
    }
    return req.user;
  }

  // Helper method to validate query parameters
  private validateQueryParam(
    param: string,
    validValues: string[],
    paramName: string,
  ): void {
    if (!validValues.includes(param)) {
      throw new UnauthorizedException(`Invalid ${paramName}.`);
    }
  }

  @Get('statistics/kpi-awaiting-approval')
  @ApiOperation({
    summary: 'Lấy thống kê số lượng KPI values đang chờ duyệt cho dashboard',
  })
  @ApiResponse({
    status: 200,
    description: 'Thống kê số lượng KPI values chờ duyệt.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getKpiAwaitingApprovalStats(
    @Req() req: Request & { user?: Employee },
  ): Promise<any> {
    const user = this.validateUser(req);
    return this.dashboardsService.getKpiAwaitingApprovalStats(user);
  }

  @Get('statistics/kpi-status-over-time')
  @ApiOperation({
    summary:
      'Lấy thống kê số lượng KPI được duyệt/từ chối trong khoảng thời gian',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Số ngày gần đây để lấy thống kê (mặc định 7 ngày)',
  })
  @ApiResponse({
    status: 200,
    description: 'Thống kê số lượng KPI được duyệt/từ chối.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getKpiStatusOverTimeStats(
    @Req() req: Request & { user?: Employee },
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ): Promise<any> {
    const user = this.validateUser(req);
    return this.dashboardsService.getKpiStatusOverTimeStats(user, days);
  }

  @Get('statistics/average-approval-time')
  @ApiOperation({ summary: 'Lấy thống kê thời gian duyệt KPI trung bình' })
  @ApiResponse({
    status: 200,
    description: 'Thống kê thời gian duyệt trung bình.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getAverageApprovalTimeStats(
    @Req() req: Request & { user?: Employee },
  ): Promise<any> {
    const user = this.validateUser(req);
    return this.dashboardsService.getAverageApprovalTimeStats(user);
  }

  @Get('statistics/top-kpi-activity')
  @ApiOperation({
    summary: 'Lấy thống kê top KPI được submit/cập nhật nhiều nhất',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Số ngày gần đây để lấy thống kê (mặc định 30 ngày)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Số lượng top KPI muốn lấy (mặc định 5)',
  })
  @ApiResponse({ status: 200, description: 'Thống kê top KPI activity.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getTopKpiActivityStats(
    @Req() req: Request & { user?: Employee },
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ): Promise<any> {
    const user = this.validateUser(req);
    return this.dashboardsService.getTopKpiActivityStats(user, days, limit);
  }

  @Get('statistics/top-pending-approvers')
  @ApiOperation({
    summary: 'Lấy thống kê người dùng/bộ phận có nhiều KPI đang chờ duyệt nhất',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Số lượng top muốn lấy (mặc định 5)',
  })
  @ApiResponse({ status: 200, description: 'Thống kê top pending approvers.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getTopPendingApproversStats(
    @Req() req: Request & { user?: Employee },
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ): Promise<any> {
    const user = this.validateUser(req);
    return this.dashboardsService.getTopPendingApproversStats(user, limit);
  }

  @Get('statistics/kpi-submission-stats')
  @ApiOperation({
    summary: 'Lấy thống kê người dùng/bộ phận submit KPI nhiều nhất/ít nhất',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Số ngày gần đây (mặc định 30)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Số lượng top (mặc định 5)',
  })
  @ApiQuery({
    name: 'entityType',
    required: true,
    enum: ['user', 'section', 'department'],
    description: 'Loại thực thể (user, section, department)',
  })
  @ApiQuery({
    name: 'orderBy',
    required: true,
    enum: ['most', 'least'],
    description: 'Sắp xếp (most, least)',
  })
  @ApiQuery({
    name: 'recentKpisLimit',
    required: false,
    type: Number,
    description: 'Số KPI gần nhất cho mỗi đối tượng (mặc định 3)',
  })
  @ApiResponse({ status: 200, description: 'Thống kê submit KPI.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getKpiSubmissionStats(
    @Req() req: Request & { user?: Employee },
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
    @Query('entityType') entityType: 'user' | 'section' | 'department',
    @Query('orderBy') orderBy: 'most' | 'least',
    @Query('recentKpisLimit', new DefaultValuePipe(3), ParseIntPipe)
    recentKpisLimit: number,
  ): Promise<any> {
    const user = this.validateUser(req);
    this.validateQueryParam(
      entityType,
      ['user', 'section', 'department'],
      'entityType',
    );
    this.validateQueryParam(orderBy, ['most', 'least'], 'orderBy');
    return this.dashboardsService.getKpiSubmissionStats(user, {
      days,
      limit,
      entityType,
      orderBy,
      recentKpisLimit,
    });
  }

  @Get('statistics/kpi-performance-overview')
  @ApiOperation({ summary: 'Lấy tổng quan hiệu suất KPI' })
  @ApiQuery({
    name: 'daysForNotUpdated',
    required: false,
    type: Number,
    description: 'Số ngày để coi là "chưa cập nhật gần đây" (mặc định 7)',
  })
  @ApiResponse({
    status: 200,
    description: 'Dữ liệu tổng quan hiệu suất KPI.',
    type: KpiPerformanceOverviewDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getKpiPerformanceOverview(
    @Req() req: Request & { user?: Employee },
    @Query('daysForNotUpdated', new DefaultValuePipe(7), ParseIntPipe)
    daysForNotUpdated: number,
  ): Promise<KpiPerformanceOverviewDto> {
    const user = this.validateUser(req);
    return this.dashboardsService.getKpiPerformanceOverview(
      user,
      daysForNotUpdated,
    );
  }

  @Get('statistics/kpi-inventory-stats')
  @ApiOperation({ summary: 'Lấy tổng quan kho KPI (định nghĩa và lượt giao)' })
  @ApiResponse({
    status: 200,
    description: 'Dữ liệu tổng quan kho KPI.',
    type: KpiInventoryDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getKpiInventoryStats(
    @Req() req: Request & { user?: Employee },
  ): Promise<KpiInventoryDto> {
    const user = this.validateUser(req);
    return this.dashboardsService.getKpiInventoryStats(user);
  }
}
