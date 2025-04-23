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

  @Post(':assignmentId/updates')
  async updateKpiProgress(
    @Param('assignmentId') assignmentId: number,
    @Body()
    body: { notes: string; project_details: { name: string; value: number }[] },
  ) {
    const { notes, project_details } = body;
    return this.kpiAssignmentsService.updateKpiProgress(
      assignmentId,
      notes,
      project_details,
    );
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

  @Post('confirm-and-submit/:assignmentId')
  async confirmAndSubmit(
    @Param('assignmentId') assignmentId: string,
    @Body('result') result: number,
    @Body('notes') notes: string,
    @Body('userId') userId: number,
  ): Promise<KpiValue> {
    return this.kpiAssignmentsService.confirmAndSubmit(
      Number(assignmentId),
      result,
      notes,
      userId,
    );
  }

  @Post('approve/:kpiValueId')
  async approveKpiValue(
    @Param('kpiValueId') kpiValueId: string,
    @Body('userId') userId: number,
  ): Promise<KpiValue> {
    return this.kpiAssignmentsService.approveKpiValue(
      Number(kpiValueId),
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
