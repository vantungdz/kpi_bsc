// kpi-values.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  NotFoundException,
  Req,
  UseGuards,
  ParseIntPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { KpiValuesService } from './kpi-values.service';
import { KpiValue } from '../entities/kpi-value.entity';
import { KpiValueHistory } from '../entities/kpi-value-history.entity';
import { Request } from 'express';
import { Employee } from '../entities/employee.entity';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/guards/roles.decorator';
import { ApiOperation, ApiResponse, ApiBody, ApiTags } from '@nestjs/swagger';
import { RejectValueDto } from './dto/reject-value.dto';

@ApiTags('KPI Values')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('kpi-values')
export class KpiValuesController {
  constructor(private readonly kpiValuesService: KpiValuesService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả KpiValue' })
  @ApiResponse({ status: 200, type: [KpiValue] })
  async findAll(): Promise<KpiValue[]> {
    return this.kpiValuesService.findAll();
  }

  @Get('pending-approvals')
  @ApiOperation({ summary: 'Lấy danh sách giá trị KPI đang chờ phê duyệt' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách giá trị chờ duyệt.',
    type: [KpiValue],
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getMyPendingApprovals(
    @Req() req: Request & { user?: Employee },
  ): Promise<KpiValue[]> {
    if (!req.user) {
      throw new UnauthorizedException('User information not available.');
    }
    return this.kpiValuesService.getPendingApprovals(req.user);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Lấy lịch sử thay đổi của một giá trị KPI' })
  @ApiResponse({ status: 200, type: [KpiValueHistory] })
  async getHistory(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<KpiValueHistory[]> {
    return this.kpiValuesService.getHistory(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một giá trị KPI' })
  @ApiResponse({ status: 200, type: KpiValue })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<KpiValue> {
    return this.kpiValuesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo một KpiValue mới' })
  @ApiResponse({ status: 201, type: KpiValue })
  async create(@Body() kpiValueData: Partial<KpiValue>): Promise<KpiValue> {
    const createdBy = 1; // Placeholder for authenticated user ID
    return this.kpiValuesService.create(kpiValueData, createdBy);
  }

  @Post('assignments/:assignmentId/updates')
  @ApiOperation({ summary: 'Submit hoặc cập nhật giá trị KPI thực hiện' })
  @ApiResponse({ status: 201, type: KpiValue })
  @ApiResponse({ status: 404, description: 'Assignment không tồn tại.' })
  async submitProgressUpdate(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Body() updateData: { notes: string; project_details: any[] },
    @Req() req: Request & { user?: Employee },
  ): Promise<KpiValue> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    return this.kpiValuesService.submitProgressUpdate(
      assignmentId,
      updateData.notes,
      updateData.project_details,
      req.user.id,
    );
  }

  @Post(':valueId/approve-section')
  @ApiOperation({ summary: 'Section Manager/Admin phê duyệt giá trị KPI' })
  @ApiResponse({ status: 200, type: KpiValue })
  async approveBySection(
    @Param('valueId', ParseIntPipe) valueId: number,
    @Req() req: Request & { user?: Employee },
  ): Promise<KpiValue> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    return this.kpiValuesService.approveValueBySection(valueId, req.user.id);
  }

  @Post(':valueId/reject-section')
  @ApiOperation({ summary: 'Section Leader/Manager/Admin từ chối giá trị KPI' })
  @ApiBody({ type: RejectValueDto })
  @ApiResponse({ status: 200, type: KpiValue })
  async rejectBySection(
    @Param('valueId', ParseIntPipe) valueId: number,
    @Body() rejectDto: RejectValueDto,
    @Req() req: Request & { user?: Employee },
  ): Promise<KpiValue> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    return this.kpiValuesService.rejectValueBySection(
      valueId,
      rejectDto.reason,
      req.user.id,
    );
  }

  @Post(':valueId/approve-department')
  @ApiOperation({ summary: 'Department Manager/Admin phê duyệt giá trị KPI' })
  @ApiResponse({ status: 200, type: KpiValue })
  async approveByDepartment(
    @Param('valueId', ParseIntPipe) valueId: number,
    @Req() req: Request & { user?: Employee },
  ): Promise<KpiValue> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    return this.kpiValuesService.approveValueByDepartment(valueId, req.user.id);
  }

  @Post(':valueId/reject-department')
  @ApiOperation({ summary: 'Department Manager/Admin từ chối giá trị KPI' })
  @ApiBody({ type: RejectValueDto })
  @ApiResponse({ status: 200, type: KpiValue })
  async rejectByDepartment(
    @Param('valueId', ParseIntPipe) valueId: number,
    @Body() rejectDto: RejectValueDto,
    @Req() req: Request & { user?: Employee },
  ): Promise<KpiValue> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    return this.kpiValuesService.rejectValueByDepartment(
      valueId,
      rejectDto.reason,
      req.user.id,
    );
  }

  @Post(':valueId/approve-manager')
  @ApiOperation({ summary: 'Manager/Admin phê duyệt cuối cùng giá trị KPI' })
  @ApiResponse({ status: 200, type: KpiValue })
  async approveByManager(
    @Param('valueId', ParseIntPipe) valueId: number,
    @Req() req: Request & { user?: Employee },
  ): Promise<KpiValue> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    return this.kpiValuesService.approveValueByManager(valueId, req.user.id);
  }

  @Post(':valueId/reject-manager')
  @ApiOperation({ summary: 'Manager/Admin từ chối cuối cùng giá trị KPI' })
  @ApiBody({ type: RejectValueDto })
  @ApiResponse({ status: 200, type: KpiValue })
  async rejectByManager(
    @Param('valueId', ParseIntPipe) valueId: number,
    @Body() rejectDto: RejectValueDto,
    @Req() req: Request & { user?: Employee },
  ): Promise<KpiValue> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    return this.kpiValuesService.rejectValueByManager(
      valueId,
      rejectDto.reason,
      req.user.id,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật một KpiValue' })
  @ApiResponse({ status: 200, type: KpiValue })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateData: Partial<KpiValue>,
    @Req() req: Request & { user?: Employee },
  ): Promise<KpiValue> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    return this.kpiValuesService.update(id, updateData, req.user.id);
  }

  @Patch(':id/approve/:role')
  @ApiOperation({ summary: 'Approve a KPI review at a specific level' })
  async approveKpiReview(
    @Param('id', ParseIntPipe) id: number,
    @Param('role') role: string,
  ): Promise<KpiValue> {
    return this.kpiValuesService.approveKpiReview(id, [role.toUpperCase()]);
  }

  @Patch(':id/reject/:role')
  @ApiOperation({ summary: 'Reject a KPI review at a specific level' })
  async rejectKpiReview(
    @Param('id', ParseIntPipe) id: number,
    @Param('role') role: string,
  ): Promise<KpiValue> {
    return this.kpiValuesService.rejectKpiReview(id, [role.toUpperCase()]);
  }

  @Patch(':id/resubmit')
  @ApiOperation({ summary: 'Resubmit a rejected KPI review' })
  async resubmitKpiReview(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<KpiValue> {
    return this.kpiValuesService.resubmitKpiReview(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa một KpiValue' })
  @ApiResponse({ status: 200 })
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user?: Employee },
  ): Promise<void> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    await this.kpiValuesService.delete(id, req.user.id);
  }
}
