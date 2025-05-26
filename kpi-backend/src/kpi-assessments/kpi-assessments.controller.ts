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
import { KpiValue } from '../entities/kpi-value.entity';
import { KpiAssignmentsService } from './kpi-assessments.service';
import { KPIAssignment } from 'src/entities/kpi-assignment.entity';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';

@Controller('kpi-assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KpiAssignmentsController {
  constructor(private readonly kpiAssignmentsService: KpiAssignmentsService) {}

  @Get()
  @Roles(
    'kpi-assignment:view:company',
    'kpi-assignment:view:department',
    'kpi-assignment:view:section',
    'kpi-assignment:view:personal',
  )
  async getMyAssignedKpis(
    @Query('employeeid') employeeId: string,
  ): Promise<KPIAssignment[]> {
    return this.kpiAssignmentsService.getUserAssignedKpis(Number(employeeId));
  }

  @Post('submit-target/:assignmentId')
  @Roles(
    'kpi-assignment:submit-target:personal',
    'kpi-assignment:submit-target:section',
    'kpi-assignment:submit-target:department',
    'kpi-assignment:submit-target:company',
  )
  async submitTarget(
    @Param('assignmentId') assignmentId: string,
    @Body('target') target: number,
    @Body('userId') userId: number,
  ): Promise<KPIAssignment> {
    return this.kpiAssignmentsService.submitTarget(
      Number(assignmentId),
      target,
      userId,
    );
  }

  @Get('approved')
  @Roles(
    'kpi-assignment:view-approved:company',
    'kpi-assignment:view-approved:department',
  )
  async getApprovedKpiValues(): Promise<KpiValue[]> {
    return this.kpiAssignmentsService.getApprovedKpiValues();
  }

  @Delete(':id')
  @Roles('kpi-assignment:delete:company', 'kpi-assignment:delete:department')
  async delete(@Param('id') id: string): Promise<void> {
    return this.kpiAssignmentsService.softDelete(+id);
  }
}
