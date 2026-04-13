import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Kpi } from './entities/kpi.entity';
import { ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { KpiFilterDto } from './dto/filter-kpi.dto';
import { KpiEvaluation } from 'src/kpi-evaluations/entities/kpi-evaluation.entity';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Section } from 'src/sections/entities/section.entity';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Employee } from 'src/employees/entities/employee.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { KpiQueryService } from './services/kpi-query.service';
import { KpiCrudService } from './services/kpi-crud.service';
import { KpiAssignmentService } from './services/kpi-assignment.service';
import { KpiApprovalService } from './services/kpi-approval.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('kpis')
export class KpisController {
  constructor(
    private readonly queryService: KpiQueryService,
    private readonly crudService: KpiCrudService,
    private readonly assignmentService: KpiAssignmentService,
    private readonly approvalService: KpiApprovalService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('my-kpis')
  @ApiOperation({ summary: "Get the logged-in user's KPIs" })
  @ApiResponse({
    status: 200,
    description: "List of the current user's KPIs",
    type: [Kpi],
  })
  async getMyKpis(
    @Req() req: Request & { user?: { id: number; role: string } },
  ) {
    const loggedInUser = req.user;

    if (!loggedInUser || typeof loggedInUser.id === 'undefined') {
      throw new UnauthorizedException(
        'User not authenticated or user ID not found in token.',
      );
    }

    return this.queryService.getKpisByEmployeeId(
      loggedInUser.id,
      loggedInUser.id,
    );
  }

  @Get('/sections')
  @ApiOperation({ summary: 'Get all section from KPI assignments' })
  @ApiResponse({
    status: 200,
    description: 'List of Sections',
    type: [Section],
  })
  async getKpisAssignedToSections(
    @Req() req: Request & { user?: { id: number; username?: string } },
  ) {
    if (!req.user?.id)
      throw new UnauthorizedException('User not authenticated.');
    const data = await this.queryService.getAllKpiAssignedToSections(
      req.user.id,
    );
    return { data };
  }

  @Get()
  @ApiOperation({ summary: 'List of KPIs with details' })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by name',
  })
  @ApiQuery({ name: 'departmentId', required: false, type: Number })
  @ApiQuery({ name: 'department_id', required: false, type: Number })
  @ApiQuery({ name: 'sectionId', required: false, type: Number })
  @ApiQuery({ name: 'section_id', required: false, type: Number })
  @ApiQuery({ name: 'teamId', required: false, type: Number })
  @ApiQuery({ name: 'team_id', required: false, type: Number })
  @ApiQuery({ name: 'perspectiveId', required: false, type: Number })
  @ApiQuery({ name: 'perspective_id', required: false, type: Number })
  @ApiQuery({ name: 'assignedToId', required: false, type: Number })
  @ApiQuery({ name: 'assigned_to_id', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['Active', 'Inactive'] })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: ['company', 'department', 'section', 'employee'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({ status: 200, description: 'List of KPIs', type: [Kpi] })
  findAll(
    @Query() filterDto: KpiFilterDto,
    @Req() req: Request & { user?: { id: number } },
  ) {
    if (!req.user?.id)
      throw new UnauthorizedException('User not authenticated.');
    return this.queryService.findAll(filterDto, req.user.id);
  }

  @Get('/departments/:departmentId')
  @ApiOperation({ summary: 'Get KPIs of a department' })
  @ApiResponse({
    status: 200,
    description: 'List of KPIs with details',
    type: [Kpi],
  })
  async getDepartmentKpis(
    @Param('departmentId') departmentId: number,
    @Query() filterDto: KpiFilterDto,
    @Req() req: Request & { user?: Employee },
  ) {
    if (!req.user)
      throw new UnauthorizedException('User not available in request.');

    const effectiveDepartmentId = departmentId === 0 ? null : departmentId;

    return this.queryService.getDepartmentKpis(
      effectiveDepartmentId,
      filterDto,
      req.user,
    );
  }

  @Get('/sections/:sectionId')
  @ApiOperation({ summary: 'Get KPIs of a section' })
  @ApiResponse({
    status: 200,
    description: 'List of KPIs with details',
    type: [Kpi],
  })
  async getSectionKpis(
    @Param('sectionId') sectionId: number,
    @Query() filterDto: KpiFilterDto,
    @Req() req: Request & { user?: Employee },
  ): Promise<any> {
    if (!req.user)
      throw new UnauthorizedException('User not available in request.');
    return this.queryService.getSectionKpis(sectionId, filterDto, req.user);
  }

  @Get('my-assignments')
  @ApiOperation({ summary: "Get current user's KPI assignments (all statuses)" })
  @ApiResponse({
    status: 200,
    description: "List of the current user's KPIs with assignments",
  })
  async getMyAssignments(
    @Query() filterDto: KpiFilterDto,
    @Req() req: Request & { user?: Employee },
  ) {
    if (!req.user?.id)
      throw new UnauthorizedException('User not available in request.');
    return this.queryService.getMyAssignments(
      req.user.id,
      filterDto,
      filterDto.cycle,
    );
  }

  @Get('/employees/:employeeId')
  @ApiOperation({ summary: 'Get KPIs of a employee' })
  @ApiResponse({
    status: 200,
    description: 'List of KPIs with details',
    type: [Kpi],
  })
  async getEmployeeKpis(
    @Param('employeeId') employeeId: number,
    @Query() filterDto: KpiFilterDto,
    @Req() req: Request & { user?: Employee },
  ) {
    if (!req.user?.id)
      throw new UnauthorizedException('User not available in request.');
    return this.queryService.getEmployeeKpis(employeeId, filterDto, req.user.id, filterDto.cycle);
  }

  @Get(':id/assignments')
  @ApiOperation({ summary: 'Get KPI assignments by KPI ID' })
  @ApiResponse({ status: 200, description: 'List of KPI assignments' })
  async getKpiAssignments(
    @Param('id', ParseIntPipe) kpiId: number,
    @Req() req: Request & { user?: { id: number } },
  ) {
    if (!req.user?.id)
      throw new UnauthorizedException('User not authenticated.');
    return this.queryService.getKpiAssignments(kpiId, req.user.id);
  }

  @Post('bulk-submit')
  @ApiOperation({ summary: 'Submit multiple KPIs for approval' })
  @ApiResponse({
    status: 200,
    description: 'KPIs submitted for approval',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'number' },
        failed: { type: 'number' },
      },
    },
  })
  async bulkSubmitKpis(
    @Body() body: { kpiIds: number[] },
    @Req() req: Request & { user?: Employee },
  ): Promise<{ success: number; failed: number }> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    return this.approvalService.bulkSubmitKpis(body.kpiIds, req.user.id);
  }

  @Get('pending-approval')
  @ApiOperation({ summary: 'Get KPIs pending approval for current user' })
  @ApiQuery({
    name: 'start_date',
    required: false,
    description: 'Filter KPIs whose period falls within review cycle start (kpi.start_date >= start_date)',
  })
  @ApiQuery({
    name: 'end_date',
    required: false,
    description: 'Filter KPIs whose period falls within review cycle end (kpi.end_date <= end_date)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of KPIs pending approval',
    type: [Kpi],
  })
  async getPendingKpisForApproval(
    @Req() req: Request & { user?: Employee },
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ): Promise<Kpi[]> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    return this.approvalService.getPendingKpisForApproval(req.user.id, {
      startDate,
      endDate,
    });
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a pending KPI' })
  @ApiResponse({ status: 200, description: 'KPI approved', type: Kpi })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'KPI not found' })
  async approveKpi(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user?: Employee },
  ): Promise<Kpi> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    return this.approvalService.approveKpi(id, req.user.id);
  }

  @Post('approve')
  @ApiOperation({ summary: 'Batch approve multiple KPIs' })
  @ApiResponse({
    status: 200,
    description: 'Batch approval result',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'array', items: { type: 'number' } },
        failed: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              reason: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async batchApproveKpis(
    @Body() body: { kpiIds: number[] },
    @Req() req: Request & { user?: Employee },
  ): Promise<{ success: number[]; failed: Array<{ id: number; reason: string }> }> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    if (!body.kpiIds || !Array.isArray(body.kpiIds) || body.kpiIds.length === 0) {
      throw new BadRequestException('kpiIds must be a non-empty array');
    }
    return this.approvalService.batchApproveKpis(body.kpiIds, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a KPI' })
  @ApiResponse({ status: 200, description: 'KPI details', type: Kpi })
  @ApiResponse({ status: 404, description: 'KPI not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user?: { id: number } },
  ): Promise<Kpi> {
    if (!req.user?.id)
      throw new UnauthorizedException('User not authenticated.');
    return this.crudService.findOne(id, req.user.id);
  }

  @Patch(':id/toggle-status')
  @ApiOperation({ summary: 'Toggle KPI status between DRAFT and APPROVED' })
  @ApiResponse({ status: 200, description: 'KPI status updated', type: Kpi })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'KPI not found' })
  async toggleKpiStatus(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user?: Employee },
  ): Promise<Kpi> {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    return this.crudService.toggleKpiStatus(id, req.user.id);
  }

  @Post('/createKpi')
  async create(
    @Body() body: any,
    @Req() req: Request & { user?: { id: number; username?: string } },
  ): Promise<Kpi> {
    if (!req.user?.id)
      throw new UnauthorizedException('User not authenticated.');
    const result = await this.crudService.create(body, req.user.id);
    await this.auditLogService.logAction({
      action: 'CREATE',
      resource: 'KPI',
      userId: req.user.id,
      username: req.user.username,
      data: body,
    });
    return result;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a KPI review' })
  @ApiResponse({
    status: 200,
    description: 'Review has been updated',
    type: KpiEvaluation,
  })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 403, description: 'No permission to edit' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async update(
    @Param('id') id: string,
    @Body() update: Partial<Kpi>,
    @Req() req: Request & { user?: { id: number; username?: string } },
  ): Promise<Kpi> {
    if (!req.user?.id)
      throw new UnauthorizedException('User not authenticated.');
    const result = await this.crudService.update(+id, update, req.user.id);
    await this.auditLogService.logAction({
      action: 'UPDATE',
      resource: 'KPI',
      userId: req.user.id,
      username: req.user.username,
      data: { id: +id, ...update },
    });
    return result;
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Req() req: Request & { user?: { id: number; username?: string } },
  ): Promise<void> {
    if (!req.user?.id)
      throw new UnauthorizedException('User not authenticated.');
    const kpi = await this.crudService.findKpisByIds([+id]);
    const foundKpi = kpi?.[0];
    let kpiType: 'company' | 'department' | 'section' | 'employee' = 'company';
    if (
      foundKpi &&
      ['company', 'department', 'section', 'personal', 'employee'].includes(
        foundKpi.type,
      )
    ) {
      kpiType =
        foundKpi.type === 'personal'
          ? 'employee'
          : (foundKpi.type as 'company' | 'department' | 'section' | 'employee');
    }
    await this.crudService.softDelete(+id, req.user.id, kpiType);
    await this.auditLogService.logAction({
      action: 'DELETE',
      resource: 'KPI',
      userId: req.user.id,
      username: req.user.username,
      data: { id: +id, kpiType },
    });
  }

  @Post(':id/sections/assignments')
  async saveDepartmentAndSectionAssignments(
    @Param('id') kpiId: number,
    @Body()
    body: {
      assignments: {
        assigned_to_department?: number;
        assigned_to_section?: number;
        targetValue: number;
        assignmentId?: number;
      }[];
    },
    @Req() req: Request & { user?: { id: number; username?: string } },
  ): Promise<void> {
    if (!req.user?.id)
      throw new UnauthorizedException('User not authenticated.');

    if (!Array.isArray(body.assignments) || body.assignments.length === 0) {
      await this.auditLogService.logAction({
        action: 'ASSIGN',
        resource: 'KPI_ASSIGNMENT_DEPARTMENT_SECTION',
        userId: req.user.id,
        username: req.user.username,
        data: { kpiId, assignments: 'EMPTY_OR_INVALID' },
      });
      throw new BadRequestException('Assignments array is empty or invalid');
    }
    await this.assignmentService.saveDepartmentAndSectionAssignments(
      kpiId,
      body.assignments,
      req.user.id,
    );
    await this.auditLogService.logAction({
      action: 'ASSIGN',
      resource: 'KPI_ASSIGNMENT_DEPARTMENT_SECTION',
      userId: req.user.id,
      username: req.user.username,
      data: { kpiId, assignments: body.assignments },
    });
  }

  @Post(':id/assignments')
  async saveUserAssignments(
    @Param('id') kpiId: number,
    @Body() body: {
      assignments: { user_id: number; target: number }[];
      contextDepartmentId?: number;
    },
    @Req() req: Request & { user?: Employee },
  ) {
    if (!req.user) throw new UnauthorizedException('User not authenticated.');

    if (!Array.isArray(body.assignments) || body.assignments.length === 0) {
      await this.auditLogService.logAction({
        action: 'ASSIGN',
        resource: 'KPI_ASSIGNMENT_USER',
        userId: req.user.id,
        username: req.user.username,
        data: { kpiId, assignments: 'EMPTY_OR_INVALID' },
      });
      throw new BadRequestException('Assignments array is empty or invalid');
    }
    await this.assignmentService.saveUserAssignments(
      kpiId,
      body.assignments,
      req.user,
      body.contextDepartmentId,
    );
    await this.auditLogService.logAction({
      action: 'ASSIGN',
      resource: 'KPI_ASSIGNMENT_USER',
      userId: req.user.id,
      username: req.user.username,
      data: { kpiId, assignments: body.assignments },
    });
  }

  @Delete(':kpiId/sections/:sectionId')
  async deleteSectionAssignment(
    @Param('kpiId') kpiId: number,
    @Param('sectionId') sectionId: number,
    @Req() req: Request & { user?: { id: number; username?: string } },
  ): Promise<void> {
    if (!req.user?.id)
      throw new UnauthorizedException('User not authenticated.');
    await this.assignmentService.deleteSectionAssignment(
      kpiId,
      sectionId,
    );
    await this.auditLogService.logAction({
      action: 'DELETE_ASSIGNMENT',
      resource: 'KPI_ASSIGNMENT_SECTION',
      userId: req.user.id,
      username: req.user.username,
      data: { kpiId, sectionId },
    });
  }
}
