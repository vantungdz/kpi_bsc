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
  NotFoundException,
  ParseIntPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { KpisService } from './kpis.service';
import { Kpi } from '../entities/kpi.entity';
import { ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { KpiFilterDto } from './dto/filter-kpi.dto';
import { KpiEvaluation } from 'src/entities/kpi-evaluation.entity';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Department } from 'src/entities/department.entity';
import { Section } from 'src/entities/section.entity';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/guards/roles.decorator';
import { CreateKpiDto } from './dto/create_kpi_dto';
import { error } from 'console';
import { Employee } from 'src/entities/employee.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('kpis')
export class KpisController {
  constructor(private readonly kpisService: KpisService) {}

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

    return this.kpisService.getKpisByEmployeeId(
      loggedInUser.id,
      loggedInUser.id,
    );
  }

  @Get('/departments')
  @ApiOperation({ summary: 'Get all departments from KPI assignments' })
  @ApiResponse({
    status: 200,
    description: 'List of departments',
    type: [Department],
  })
  async getKpisAssignedToDepartments(
    @Req() req: Request & { user?: { id: number } },
  ) {
    if (!req.user?.id)
      throw new UnauthorizedException('User not authenticated.');
    const data = await this.kpisService.getAllKpiAssignedToDepartments(
      req.user.id,
    );
    return { data };
  }

  @Get('/sections')
  @ApiOperation({ summary: 'Get all section from KPI assignments' })
  @ApiResponse({
    status: 200,
    description: 'List of Sections',
    type: [Section],
  })
  async getKpisAssignedToSections(
    @Req() req: Request & { user?: { id: number } },
  ) {
    if (!req.user?.id)
      throw new UnauthorizedException('User not authenticated.');
    const data = await this.kpisService.getAllKpiAssignedToSections(
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
    description: 'Tìm kiếm theo tên',
  })
  @ApiQuery({ name: 'departmentId', required: false, type: Number })
  @ApiQuery({ name: 'sectionId', required: false, type: Number })
  @ApiQuery({ name: 'teamId', required: false, type: Number })
  @ApiQuery({ name: 'perspectiveId', required: false, type: Number })
  @ApiQuery({ name: 'assignedToId', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['Active', 'Inactive'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({ status: 200, description: 'Danh sách KPI', type: [Kpi] })
  findAll(
    @Query() filterDto: KpiFilterDto,
    @Req() req: Request & { user?: { id: number } },
  ) {
    if (!req.user?.id)
      throw new UnauthorizedException('User not authenticated.');
    return this.kpisService.findAll(filterDto, req.user.id);
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
    return this.kpisService.getDepartmentKpis(
      departmentId,
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
    // Fix: use any to avoid type export error
    if (!req.user)
      throw new UnauthorizedException('User not available in request.');
    return this.kpisService.getSectionKpis(sectionId, filterDto, req.user);
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
    return this.kpisService.getEmployeeKpis(employeeId, filterDto, req.user.id);
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
    return this.kpisService.getKpiAssignments(kpiId, req.user.id);
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
    return this.kpisService.findOne(id, req.user.id);
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
    return this.kpisService.toggleKpiStatus(id, req.user.id);
  }

  @Post('/createKpi')
  async create(
    @Body() body: any,
    @Req() req: Request & { user?: { id: number } },
  ): Promise<Kpi> {
    if (!req.user?.id)
      throw new UnauthorizedException('User not authenticated.');
    return this.kpisService.create(body, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật một đánh giá KPI' })
  @ApiResponse({
    status: 200,
    description: 'Đánh giá được cập nhật',
    type: KpiEvaluation,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 403, description: 'Không có quyền chỉnh sửa' })
  @ApiResponse({ status: 404, description: 'Đánh giá không tồn tại' })
  async update(
    @Param('id') id: string,
    @Body() update: Partial<Kpi>,
    @Req() req: Request & { user?: { id: number } },
  ): Promise<Kpi> {
    if (!req.user?.id)
      throw new UnauthorizedException('User not authenticated.');
    return this.kpisService.update(+id, update, req.user.id);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Req() req: Request & { user?: { id: number } },
  ): Promise<void> {
    if (!req.user?.id)
      throw new UnauthorizedException('User not authenticated.');
    // Lấy loại KPI trước khi xóa
    const kpi = await this.kpisService['kpisRepository'].findOne({
      where: { id: +id },
    });
    let kpiType: 'company' | 'department' | 'section' | 'employee' = 'company';
    if (
      kpi &&
      ['company', 'department', 'section', 'personal', 'employee'].includes(
        kpi.type,
      )
    ) {
      kpiType =
        kpi.type === 'personal'
          ? 'employee'
          : (kpi.type as 'company' | 'department' | 'section' | 'employee');
    }
    return this.kpisService.softDelete(+id, req.user.id, kpiType);
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
    @Req() req: Request & { user?: { id: number } },
  ): Promise<void> {
    if (!req.user?.id)
      throw new UnauthorizedException('User not authenticated.');
    return this.kpisService.saveDepartmentAndSectionAssignments(
      kpiId,
      body.assignments,
      req.user.id,
    );
  }

  @Post(':id/assignments')
  async saveUserAssignments(
    @Param('id') kpiId: number,
    @Body()
    body: {
      assignments: { user_id: number; target: number }[];
    },
    @Req() req: Request & { user?: Employee },
  ) {
    if (!req.user) throw new UnauthorizedException('User not authenticated.');
    return this.kpisService.saveUserAssignments(
      kpiId,
      body.assignments,
      req.user,
    );
  }

  @Delete(':kpiId/sections/:sectionId')
  async deleteSectionAssignment(
    @Param('kpiId') kpiId: number,
    @Param('sectionId') sectionId: number,
    @Req() req: Request & { user?: { id: number } },
  ): Promise<void> {
    if (!req.user?.id)
      throw new UnauthorizedException('User not authenticated.');
    return this.kpisService.deleteSectionAssignment(
      kpiId,
      sectionId,
      req.user.id,
    );
  }
}
