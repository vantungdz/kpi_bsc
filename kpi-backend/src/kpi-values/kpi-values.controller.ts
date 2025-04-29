// kpi-values.controller.ts (Đã sắp xếp lại thứ tự, không comment)

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
  @ApiOperation({
    summary: 'Lấy danh sách tất cả KpiValue (cần xem lại quyền)',
  })
  @ApiResponse({ status: 200, type: [KpiValue] })
  async findAll(): Promise<KpiValue[]> {
    return await this.kpiValuesService.findAll();
  }

  @Get('pending-approvals')
  @Roles('leader', 'manager', 'admin')
  @ApiOperation({
    summary: 'Lấy danh sách giá trị KPI đang chờ người dùng hiện tại phê duyệt',
  })
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
      console.error(
        'User object is missing from the request in getMyPendingApprovals.',
      );
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
    console.log(
      `!!!!!! KpiValuesController.findOne ENTERED with id: ${id} !!!!!!`,
    );
    const kpiValue = await this.kpiValuesService.findOne(id);
    return kpiValue;
  }

  @Post()
  @ApiOperation({ summary: 'Tạo một KpiValue mới (cần xem lại logic/quyền)' })
  @ApiResponse({ status: 201, type: KpiValue })
  async create(@Body() kpiValueData: Partial<KpiValue>): Promise<KpiValue> {
    const createdBy = 1; // Sửa lại để lấy user thật
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
    if (!req.user || !req.user.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    const userId = req.user.id;
    return this.kpiValuesService.submitProgressUpdate(
      assignmentId,
      updateData.notes,
      updateData.project_details,
      userId,
    );
  }

  @Post(':valueId/approve-section')
  @Roles('leader', 'manager', 'admin')
  @ApiOperation({
    summary: 'Section Leader/Manager/Admin phê duyệt giá trị KPI',
  })
  @ApiResponse({ status: 200, type: KpiValue })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 403 })
  @ApiResponse({ status: 404 })
  async approveBySection(
    @Param('valueId', ParseIntPipe) valueId: number,
    @Req() req: Request & { user?: Employee },
  ): Promise<KpiValue> {
    if (!req.user || !req.user.id)
      throw new UnauthorizedException('User not authenticated.');
    const userId = req.user.id;
    return this.kpiValuesService.approveValueBySection(valueId, userId);
  }

  @Post(':valueId/reject-section')
  @Roles('leader', 'manager', 'admin')
  @ApiOperation({ summary: 'Section Leader/Manager/Admin từ chối giá trị KPI' })
  @ApiBody({ type: RejectValueDto })
  @ApiResponse({ status: 200, type: KpiValue })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 403 })
  @ApiResponse({ status: 404 })
  async rejectBySection(
    @Param('valueId', ParseIntPipe) valueId: number,
    @Body() rejectDto: RejectValueDto,
    @Req() req: Request & { user?: Employee },
  ): Promise<KpiValue> {
    if (!req.user || !req.user.id)
      throw new UnauthorizedException('User not authenticated.');
    const userId = req.user.id;
    return this.kpiValuesService.rejectValueBySection(
      valueId,
      rejectDto.reason,
      userId,
    );
  }

  @Post(':valueId/approve-department')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Department Manager/Admin phê duyệt giá trị KPI' })
  @ApiResponse({ status: 200, type: KpiValue })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 403 })
  @ApiResponse({ status: 404 })
  async approveByDepartment(
    @Param('valueId', ParseIntPipe) valueId: number,
    @Req() req: Request & { user?: Employee },
  ): Promise<KpiValue> {
    if (!req.user || !req.user.id)
      throw new UnauthorizedException('User not authenticated.');
    const userId = req.user.id;
    return this.kpiValuesService.approveValueByDepartment(valueId, userId);
  }

  @Post(':valueId/reject-department')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Department Manager/Admin từ chối giá trị KPI' })
  @ApiBody({ type: RejectValueDto })
  @ApiResponse({ status: 200, type: KpiValue })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 403 })
  @ApiResponse({ status: 404 })
  async rejectByDepartment(
    @Param('valueId', ParseIntPipe) valueId: number,
    @Body() rejectDto: RejectValueDto,
    @Req() req: Request & { user?: Employee },
  ): Promise<KpiValue> {
    if (!req.user || !req.user.id)
      throw new UnauthorizedException('User not authenticated.');
    const userId = req.user.id;
    return this.kpiValuesService.rejectValueByDepartment(
      valueId,
      rejectDto.reason,
      userId,
    );
  }

  @Post(':valueId/approve-manager')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Manager/Admin phê duyệt cuối cùng giá trị KPI' })
  @ApiResponse({ status: 200, type: KpiValue })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 403 })
  @ApiResponse({ status: 404 })
  async approveByManager(
    @Param('valueId', ParseIntPipe) valueId: number,
    @Req() req: Request & { user?: Employee },
  ): Promise<KpiValue> {
    if (!req.user || !req.user.id)
      throw new UnauthorizedException('User not authenticated.');
    const userId = req.user.id;
    return this.kpiValuesService.approveValueByManager(valueId, userId);
  }

  @Post(':valueId/reject-manager')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Manager/Admin từ chối cuối cùng giá trị KPI' })
  @ApiBody({ type: RejectValueDto })
  @ApiResponse({ status: 200, type: KpiValue })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 403 })
  @ApiResponse({ status: 404 })
  async rejectByManager(
    @Param('valueId', ParseIntPipe) valueId: number,
    @Body() rejectDto: RejectValueDto,
    @Req() req: Request & { user?: Employee },
  ): Promise<KpiValue> {
    if (!req.user || !req.user.id)
      throw new UnauthorizedException('User not authenticated.');
    const userId = req.user.id;
    return this.kpiValuesService.rejectValueByManager(
      valueId,
      rejectDto.reason,
      userId,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật một KpiValue (cần xem lại logic/quyền)' })
  @ApiResponse({ status: 200, type: KpiValue })
  @ApiResponse({ status: 404 })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateData: Partial<KpiValue>,
    @Req() req: Request & { user?: Employee }, // Lấy user thật
  ): Promise<KpiValue> {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    const updatedBy = req.user.id; // Lấy user thật
    const kpiValue = await this.kpiValuesService.update(
      id,
      updateData,
      updatedBy,
    );
    return kpiValue; // Service đã xử lý NotFound
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa một KpiValue (cần xem lại quyền)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user?: Employee },
  ): Promise<void> {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    const deletedBy = req.user.id; // Lấy user thật
    await this.kpiValuesService.delete(id, deletedBy); // Service đã xử lý NotFound
  }
}
