import { Controller, Get, Query, Req, UnauthorizedException, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { Employee } from '../entities/employee.entity';
import { DashboardsService } from './dashboard.service';

@ApiTags('Dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Get('statistics/kpi-awaiting-approval')
  @Roles('admin', 'manager', 'department', 'section') // Điều chỉnh roles nếu cần
  @ApiOperation({ summary: 'Lấy thống kê số lượng KPI values đang chờ duyệt cho dashboard' })
  @ApiResponse({ status: 200, description: 'Thống kê số lượng KPI values chờ duyệt.'})
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getKpiAwaitingApprovalStats(
    @Req() req: Request & { user?: Employee },
  ): Promise<any> {
    if (!req.user) {
      throw new UnauthorizedException('User information not available.');
    }
    return this.dashboardsService.getKpiAwaitingApprovalStats(req.user);
  }

  @Get('statistics/kpi-status-over-time')
  @Roles('admin', 'manager', 'department', 'section')
  @ApiOperation({ summary: 'Lấy thống kê số lượng KPI được duyệt/từ chối trong khoảng thời gian' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Số ngày gần đây để lấy thống kê (mặc định 7 ngày)'})
  @ApiResponse({ status: 200, description: 'Thống kê số lượng KPI được duyệt/từ chối.'})
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getKpiStatusOverTimeStats(
    @Req() req: Request & { user?: Employee },
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ): Promise<any> {
    if (!req.user) {
      throw new UnauthorizedException('User information not available.');
    }
    return this.dashboardsService.getKpiStatusOverTimeStats(req.user, days);
  }

  @Get('statistics/average-approval-time')
  @Roles('admin', 'manager', 'department', 'section')
  @ApiOperation({ summary: 'Lấy thống kê thời gian duyệt KPI trung bình' })
  @ApiResponse({ status: 200, description: 'Thống kê thời gian duyệt trung bình.'})
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getAverageApprovalTimeStats(
    @Req() req: Request & { user?: Employee },
  ): Promise<any> {
    if (!req.user) {
      throw new UnauthorizedException('User information not available.');
    }
    return this.dashboardsService.getAverageApprovalTimeStats(req.user);
  }

  @Get('statistics/top-kpi-activity')
  @Roles('admin', 'manager', 'department', 'section')
  @ApiOperation({ summary: 'Lấy thống kê top KPI được submit/cập nhật nhiều nhất' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Số ngày gần đây để lấy thống kê (mặc định 30 ngày)'})
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Số lượng top KPI muốn lấy (mặc định 5)'})
  @ApiResponse({ status: 200, description: 'Thống kê top KPI activity.'})
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getTopKpiActivityStats(
    @Req() req: Request & { user?: Employee },
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ): Promise<any> {
    if (!req.user) {
      throw new UnauthorizedException('User information not available.');
    }
    return this.dashboardsService.getTopKpiActivityStats(req.user, days, limit);
  }
}