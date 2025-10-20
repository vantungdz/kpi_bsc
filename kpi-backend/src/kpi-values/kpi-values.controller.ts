// kpi-values.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  ParseIntPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { KpiValuesService } from './kpi-values.service';
import { KpiValue } from './entities/kpi-value.entity';
import { KpiValueHistory } from './entities/kpi-value-history.entity';
import { Request } from 'express';
import { Employee } from '../employees/entities/employee.entity';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { ApiOperation, ApiResponse, ApiBody, ApiTags } from '@nestjs/swagger';
import { RejectValueDto } from './dto/reject-value.dto';
import { AuditLogService } from '../audit-log/audit-log.service';

@ApiTags('KPI Values')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('kpi-values')
export class KpiValuesController {
  constructor(
    private readonly kpiValuesService: KpiValuesService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get list of all KpiValues' })
  @ApiResponse({ status: 200, type: [KpiValue] })
  async findAll(): Promise<KpiValue[]> {
    return this.kpiValuesService.findAll();
  }

  @Get('pending-approvals')
  @ApiOperation({ summary: 'Get list of KPI values pending approval' })
  @ApiResponse({
    status: 200,
    description: 'List of values pending approval.',
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
  @ApiOperation({ summary: 'Get change history of a KPI value' })
  @ApiResponse({ status: 200, type: [KpiValueHistory] })
  async getHistory(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<KpiValueHistory[]> {
    return this.kpiValuesService.getHistory(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a KPI value' })
  @ApiResponse({ status: 200, type: KpiValue })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<KpiValue> {
    return this.kpiValuesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new KpiValue' })
  @ApiResponse({ status: 201, type: KpiValue })
  async create(@Body() kpiValueData: Partial<KpiValue>): Promise<KpiValue> {
    const createdBy = 1; // Placeholder for authenticated user ID
    return this.kpiValuesService.create(kpiValueData, createdBy);
  }

  @Post('assignments/:assignmentId/updates')
  @ApiOperation({ summary: 'Submit or update KPI implementation value' })
  @ApiResponse({ status: 201, type: KpiValue })
  @ApiResponse({ status: 404, description: 'Assignment does not exist.' })
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
  @ApiOperation({ summary: 'Section Manager/Admin approve KPI value' })
  @ApiResponse({ status: 200, type: KpiValue })
  async approveBySection(
    @Param('valueId', ParseIntPipe) valueId: number,
    @Req() req: Request & { user?: Employee },
  ): Promise<KpiValue> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    const result = await this.kpiValuesService.approveValueBySection(
      valueId,
      req.user.id,
    );
    await this.auditLogService.logAction({
      action: 'APPROVE_SECTION',
      resource: 'KPI_VALUE',
      userId: req.user.id,
      username: req.user.username,
      data: { valueId },
    });
    return result;
  }

  @Post(':valueId/reject-section')
  @ApiOperation({ summary: 'Section Leader/Manager/Admin reject KPI value' })
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
    const result = await this.kpiValuesService.rejectValueBySection(
      valueId,
      rejectDto.reason,
      req.user.id,
    );
    await this.auditLogService.logAction({
      action: 'REJECT_SECTION',
      resource: 'KPI_VALUE',
      userId: req.user.id,
      username: req.user.username,
      data: { valueId, ...rejectDto },
    });
    return result;
  }

  @Post(':valueId/approve-department')
  @ApiOperation({ summary: 'Department Manager/Admin approve KPI value' })
  @ApiResponse({ status: 200, type: KpiValue })
  async approveByDepartment(
    @Param('valueId', ParseIntPipe) valueId: number,
    @Req() req: Request & { user?: Employee },
  ): Promise<KpiValue> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    const result = await this.kpiValuesService.approveValueByDepartment(
      valueId,
      req.user.id,
    );
    await this.auditLogService.logAction({
      action: 'APPROVE_DEPARTMENT',
      resource: 'KPI_VALUE',
      userId: req.user.id,
      username: req.user.username,
      data: { valueId },
    });
    return result;
  }

  @Post(':valueId/reject-department')
  @ApiOperation({ summary: 'Department Manager/Admin reject KPI value' })
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
    const result = await this.kpiValuesService.rejectValueByDepartment(
      valueId,
      rejectDto.reason,
      req.user.id,
    );
    await this.auditLogService.logAction({
      action: 'REJECT_DEPARTMENT',
      resource: 'KPI_VALUE',
      userId: req.user.id,
      username: req.user.username,
      data: { valueId, ...rejectDto },
    });
    return result;
  }

  @Post(':valueId/approve-manager')
  @ApiOperation({ summary: 'Manager/Admin final approve KPI value' })
  @ApiResponse({ status: 200, type: KpiValue })
  async approveByManager(
    @Param('valueId', ParseIntPipe) valueId: number,
    @Req() req: Request & { user?: Employee },
  ): Promise<KpiValue> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    const result = await this.kpiValuesService.approveValueByManager(
      valueId,
      req.user.id,
    );
    await this.auditLogService.logAction({
      action: 'APPROVE_MANAGER',
      resource: 'KPI_VALUE',
      userId: req.user.id,
      username: req.user.username,
      data: { valueId },
    });
    return result;
  }

  @Post(':valueId/reject-manager')
  @ApiOperation({ summary: 'Manager/Admin final reject KPI value' })
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
    const result = await this.kpiValuesService.rejectValueByManager(
      valueId,
      rejectDto.reason,
      req.user.id,
    );
    await this.auditLogService.logAction({
      action: 'REJECT_MANAGER',
      resource: 'KPI_VALUE',
      userId: req.user.id,
      username: req.user.username,
      data: { valueId, ...rejectDto },
    });
    return result;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a KpiValue' })
  @ApiResponse({ status: 200, type: KpiValue })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateData: Partial<KpiValue>,
    @Req() req: Request & { user?: Employee },
  ): Promise<KpiValue> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    const result = await this.kpiValuesService.update(
      id,
      updateData,
      req.user.id,
    );
    await this.auditLogService.logAction({
      action: 'UPDATE',
      resource: 'KPI_VALUE',
      userId: req.user.id,
      username: req.user.username,
      data: { id, ...updateData },
    });
    return result;
  }

  @Patch(':id/approve/:role')
  @ApiOperation({ summary: 'Approve a KPI review at a specific level' })
  async approveKpiReview(
    @Param('id', ParseIntPipe) id: number,
    @Param('role') role: string,
    @Req() req: Request,
  ): Promise<KpiValue> {
    const user: Employee = req.user as Employee;
    if (!user) {
      throw new UnauthorizedException('User not found in request');
    }
    return this.kpiValuesService.approveKpiReview(id, user);
  }

  @Patch(':id/reject/:role')
  @ApiOperation({ summary: 'Reject a KPI review at a specific level' })
  async rejectKpiReview(
    @Param('id', ParseIntPipe) id: number,
    @Param('role') role: string,
    @Req() req: Request,
  ): Promise<KpiValue> {
    const user: Employee = req.user as Employee;
    if (!user) {
      throw new UnauthorizedException('User not found in request');
    }
    return this.kpiValuesService.rejectKpiReview(id, user);
  }

  @Patch(':id/resubmit')
  @ApiOperation({ summary: 'Resubmit a rejected KPI review' })
  async resubmitKpiReview(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<KpiValue> {
    return this.kpiValuesService.resubmitKpiReview(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a KpiValue' })
  @ApiResponse({ status: 200 })
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user?: Employee },
  ): Promise<void> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    await this.kpiValuesService.delete(id, req.user.id);
    await this.auditLogService.logAction({
      action: 'DELETE',
      resource: 'KPI_VALUE',
      userId: req.user.id,
      username: req.user.username,
      data: { id },
    });
  }
}
