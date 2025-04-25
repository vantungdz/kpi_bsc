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

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('kpis')
export class KpisController {
  constructor(private readonly kpisService: KpisService) {}

  @Get('my-kpis')
  async getMyKpis(@Req() req: CreateKpiDto) {
    const user = req.assignments?.employeeId;

    if (!user) {
      throw new NotFoundException(
        `No assignments found for user with ID ${user}`,
      );
    }

    return this.kpisService.getKpisByEmployeeId(user);
  }

  @Get('/departments')
  @ApiOperation({ summary: 'Get all departments from KPI assignments' })
  @Roles('admin', 'manager')
  @ApiResponse({
    status: 200,
    description: 'List of departments',
    type: [Department],
  })
  async getKpisAssignedToDepartments() {
    const data = await this.kpisService.getAllKpiAssignedToDepartments();
    return { data };
  }

  @Roles('admin', 'manager')
  @Get('/sections')
  @ApiOperation({ summary: 'Get all section from KPI assignments' })
  @UseGuards(JwtAuthGuard, RolesGuard) // Kiểm tra JWT và quyền truy cập
  @ApiResponse({
    status: 200,
    description: 'List of Sections',
    type: [Section],
  })
  async getKpisAssignedToSections() {
    const data = await this.kpisService.getAllKpiAssignedToSections();
    return { data };
  }

  @Get()
  @Roles('admin', 'manager')
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
  findAll(@Query() filterDto: KpiFilterDto): Promise<{
    data: Kpi[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  }> {
    return this.kpisService.findAll(filterDto);
  }

  @Roles('admin', 'manager')
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
  ): Promise<{
    data: Kpi[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  }> {
    return this.kpisService.getDepartmentKpis(departmentId, filterDto);
  }

  @Roles('admin', 'manager')
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
  ): Promise<{
    data: Kpi[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  }> {
    return this.kpisService.getSectionKpis(sectionId, filterDto);
  }

  @Get('/employees/:employeeId')
  @Roles('admin', 'manager', 'employee')
  @ApiOperation({ summary: 'Get KPIs of a employee' })
  @ApiResponse({
    status: 200,
    description: 'List of KPIs with details',
    type: [Kpi],
  })
  async getEmployeeKpis(
    @Param('employeeId') employeeId: number,
    @Query() filterDto: KpiFilterDto,
  ): Promise<{
    data: Kpi[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  }> {
    return this.kpisService.getEmployeeKpis(employeeId, filterDto);
  }

  @Get(':id/assignments')
  @Roles('admin')
  async getKpiAssignments(@Param('id') kpiId: number) {
    return this.kpisService.getKpiAssignments(kpiId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một KPI' })
  @Roles('admin', 'manager')
  @ApiResponse({ status: 200, description: 'Chi tiết KPI', type: Kpi })
  @ApiResponse({ status: 404, description: 'KPI không tồn tại' })
  @ApiResponse({ status: 403, description: 'Không có quyền xem KPI' })
  findOne(@Param('id') id: string): Promise<Kpi> {
    return this.kpisService.findOne(+id);
  }

  @Post('/createKpi')
  create(@Body() body: any): Promise<Kpi> {
    console.log('createKpi', body);
    return this.kpisService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật một đánh giá KPI' })
  @Roles('admin', 'manager')
  @ApiResponse({
    status: 200,
    description: 'Đánh giá được cập nhật',
    type: KpiEvaluation,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 403, description: 'Không có quyền chỉnh sửa' })
  @ApiResponse({ status: 404, description: 'Đánh giá không tồn tại' })
  update(@Param('id') id: string, @Body() update: Partial<Kpi>): Promise<Kpi> {
    return this.kpisService.update(+id, update);
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  delete(@Param('id') id: string): Promise<void> {
    return this.kpisService.softDelete(+id);
  }

  @Post(':id/sections/assignments') 
  @Roles('admin', 'manager')
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
  ): Promise<void> {
    return this.kpisService.saveDepartmentAndSectionAssignments(
      kpiId,
      body.assignments,
    );
  }

  @Post(':id/assignments')
  @Roles('admin', 'manager')
  async saveUserAssignments(
    @Param('id') kpiId: number,
    @Body()
    body: {
      assignments: { user_id: number; target: number }[];
    },
  ) {
    return this.kpisService.saveUserAssignments(kpiId, body.assignments);
  }

  @Delete(':kpiId/sections/:sectionId')
  @Roles('admin', 'manager') // Chỉ admin và manager được phép xóa
  async deleteSectionAssignment(
    @Param('kpiId') kpiId: number,
    @Param('sectionId') sectionId: number,
  ): Promise<void> {
    return this.kpisService.deleteSectionAssignment(kpiId, sectionId);
  }
}
