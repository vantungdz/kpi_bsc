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

@Controller('kpi-assignments')
export class KpiAssignmentsController {
  constructor(private readonly kpiAssignmentsService: KpiAssignmentsService) {}

  @UseGuards(AuthGuard('jwt')) // Protect the route with JWT authentication
  @Get()
  async getMyAssignedKpis(
    @Query('employeeid') employeeId: string,
  ): Promise<KPIAssignment[]> {
    return this.kpiAssignmentsService.getUserAssignedKpis(Number(employeeId));
  }

  @Post('submit-target/:assignmentId')
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
  async getApprovedKpiValues(): Promise<KpiValue[]> {
    return this.kpiAssignmentsService.getApprovedKpiValues();
  }

  @Delete(':id')
  delete(@Param('id') id: string): Promise<void> {
    return this.kpiAssignmentsService.softDelete(+id);
  }
}
