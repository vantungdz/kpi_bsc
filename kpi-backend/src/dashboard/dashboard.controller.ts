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
import { Employee } from '../employees/entities/employee.entity';
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
    summary: 'Get statistics of KPI values pending approval for dashboard',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics of KPI values pending approval.',
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
    summary: 'Get statistics of approved/rejected KPIs within time range',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of recent days to get statistics (default 7 days)',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics of approved/rejected KPIs.',
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
  @ApiOperation({ summary: 'Get average KPI approval time statistics' })
  @ApiResponse({
    status: 200,
    description: 'Average approval time statistics.',
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
    summary: 'Get statistics of top KPIs submitted/updated most frequently',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of recent days to get statistics (default 30 days)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of top KPIs to get (default 5)',
  })
  @ApiResponse({ status: 200, description: 'Top KPI activity statistics.' })
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
    summary:
      'Get statistics of users/departments with most pending KPI approvals',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of top items to get (default 5)',
  })
  @ApiResponse({
    status: 200,
    description: 'Top pending approvers statistics.',
  })
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
    summary: 'Get statistics of users/departments submitting KPIs most/least',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of recent days (default 30)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of top items (default 5)',
  })
  @ApiQuery({
    name: 'entityType',
    required: true,
    enum: ['user', 'section', 'department'],
    description: 'Entity type (user, section, department)',
  })
  @ApiQuery({
    name: 'orderBy',
    required: true,
    enum: ['most', 'least'],
    description: 'Sort order (most, least)',
  })
  @ApiQuery({
    name: 'recentKpisLimit',
    required: false,
    type: Number,
    description: 'Number of recent KPIs for each object (default 3)',
  })
  @ApiResponse({ status: 200, description: 'KPI submission statistics.' })
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
  @ApiOperation({ summary: 'Get KPI performance overview' })
  @ApiQuery({
    name: 'daysForNotUpdated',
    required: false,
    type: Number,
    description:
      'Number of days to consider as "not updated recently" (default 7)',
  })
  @ApiResponse({
    status: 200,
    description: 'KPI performance overview data.',
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
  @ApiOperation({
    summary: 'Get KPI inventory overview (definitions and assignments)',
  })
  @ApiResponse({
    status: 200,
    description: 'KPI inventory overview data.',
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
