import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Query,
  Delete,
} from '@nestjs/common';
import { KpiValue } from '../kpi-values/entities/kpi-value.entity';
import { KpiAssignmentsService } from './kpi-assessments.service';
import { KPIAssignment } from 'src/kpi-assessments/entities/kpi-assignment.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditLogService } from '../audit-log/audit-log.service';

@Controller('kpi-assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KpiAssignmentsController {
  constructor(
    private readonly kpiAssignmentsService: KpiAssignmentsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  async getMyAssignedKpis(
    @Query('employeeid') employeeId: string,
    @Body('username') username?: string,
  ): Promise<KPIAssignment[]> {
    const result = await this.kpiAssignmentsService.getUserAssignedKpis(Number(employeeId));
    await this.auditLogService.logAction({
      action: 'VIEW_ASSIGNMENT',
      resource: 'KPI_ASSIGNMENT',
      userId: Number(employeeId),
      username,
      data: {},
    });
    return result;
  }

  @Post('submit-target/:assignmentId')
  async submitTarget(
    @Param('assignmentId') assignmentId: string,
    @Body('target') target: number,
    @Body('userId') userId: number,
    @Body('username') username?: string,
  ): Promise<KPIAssignment> {
    const result = await this.kpiAssignmentsService.submitTarget(
      Number(assignmentId),
      target,
      userId,
    );
    await this.auditLogService.logAction({
      action: 'SUBMIT_TARGET',
      resource: 'KPI_ASSIGNMENT',
      userId,
      username,
      data: { assignmentId: Number(assignmentId), target },
    });
    return result;
  }

  @Get('approved')
  async getApprovedKpiValues(): Promise<KpiValue[]> {
    return this.kpiAssignmentsService.getApprovedKpiValues();
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Body('userId') userId?: number, @Body('username') username?: string): Promise<void> {
    await this.kpiAssignmentsService.softDelete(+id);
    await this.auditLogService.logAction({
      action: 'DELETE',
      resource: 'KPI_ASSIGNMENT',
      userId,
      username,
      data: { id: +id },
    });
  }
}
