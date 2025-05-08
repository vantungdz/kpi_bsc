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

  // Endpoint này phù hợp để người dùng tự lấy KPI của mình
  @Get('my-kpis')
  @ApiOperation({ summary: "Get the logged-in user's KPIs" })
  @ApiResponse({ status: 200, description: "List of the current user's KPIs", type: [Kpi] })
  async getMyKpis(@Req() req: Request & { user?: { id: number; role: string } }) {
    const loggedInUser = req.user;

    if (!loggedInUser || typeof loggedInUser.id === 'undefined') {
      throw new UnauthorizedException('User not authenticated or user ID not found in token.');
    }

    // Gọi service để lấy KPI dựa trên ID của người dùng đã đăng nhập
    return this.kpisService.getKpisByEmployeeId(loggedInUser.id);
  }

  @Get('/departments')
  @ApiOperation({ summary: 'Get all departments from KPI assignments' })
  @Roles('admin', 'manager', 'department', 'section') // Thêm 'section' nếu cần
  @ApiResponse({
    status: 200,
    description: 'List of departments',
    type: [Department],
  })
  async getKpisAssignedToDepartments() {
    const data = await this.kpisService.getAllKpiAssignedToDepartments();
    return { data };
  }

  @Roles('admin', 'manager', 'department', 'section')
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

  @Roles('admin', 'manager', 'department')
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
  ): Promise<{
    data: Kpi[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  }> {
    if (!req.user) {
      throw new UnauthorizedException('User not available in request.');
    }
    return this.kpisService.getDepartmentKpis(departmentId, filterDto, req.user);
  }

  @Roles('admin', 'manager', 'department', 'section')
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
  ): Promise<{
    data: Kpi[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  }> {
    if (!req.user) {
      throw new UnauthorizedException('User not available in request.');
    }
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
    @Req() req: Request & { user?: Employee } // Added req.user for consistency, service might use it
  ): Promise<{
    data: Kpi[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  }> {
    // Assuming getEmployeeKpis service method might also need user context in future
    if (!req.user) {
      throw new UnauthorizedException('User not available in request.');
    }
    return this.kpisService.getEmployeeKpis(employeeId, filterDto /*, req.user */);
  }

  @Get(':id/assignments')
  @Roles('admin', 'manager', 'department', 'section')
  @ApiOperation({ summary: 'Get KPI assignments by KPI ID' })
  @ApiResponse({ status: 200, description: 'List of KPI assignments' })
  async getKpiAssignments(@Param('id', ParseIntPipe) kpiId: number) {
    return this.kpisService.getKpiAssignments(kpiId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a KPI' })
  @ApiResponse({ status: 200, description: 'KPI details', type: Kpi })
  @ApiResponse({ status: 404, description: 'KPI not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Kpi> {
    return this.kpisService.findOne(id);
  }

  @Patch(':id/toggle-status')
  @Roles('manager', 'admin')
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
  @Roles('admin', 'manager', 'section')
  async saveUserAssignments(
    @Param('id') kpiId: number,
    @Body()
    body: {
      assignments: { user_id: number; target: number }[];
    },
    @Req() req: Request & { user?: Employee },
  ) {
    if (!req.user) {
        throw new UnauthorizedException('User not authenticated.');
    }
    return this.kpisService.saveUserAssignments(kpiId, body.assignments, req.user);
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
