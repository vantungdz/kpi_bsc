import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { KpisService } from './kpis.service';
import { Kpi } from '../entities/kpi.entity';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { KpiFilterDto } from './dto/filter-kpi.dto';
import { KpiEvaluation } from 'src/entities/kpi-evaluation.entity';

@Controller('kpis')
export class KpisController {
  constructor(private readonly kpisService: KpisService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách KPI' })
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
  findAll(@Query() filterDto: KpiFilterDto): Promise<Kpi[]> {
    return this.kpisService.findAll(filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một KPI' })
  @ApiResponse({ status: 200, description: 'Chi tiết KPI', type: Kpi })
  @ApiResponse({ status: 404, description: 'KPI không tồn tại' })
  @ApiResponse({ status: 403, description: 'Không có quyền xem KPI' })
  findOne(@Param('id') id: string): Promise<Kpi> {
    return this.kpisService.findOne(+id);
  }

  @Post()
  create(@Body() body: any, kpi: Partial<Kpi>): Promise<Kpi> {
    console.log(body);
    return this.kpisService.create(body);
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
  update(@Param('id') id: string, @Body() update: Partial<Kpi>): Promise<Kpi> {
    return this.kpisService.update(+id, update);
  }

  @Delete(':id')
  delete(@Param('id') id: string): Promise<void> {
    return this.kpisService.softDelete(+id);
  }

  @Patch(':id/reassign')
  async reassign(
    @Param('id') id,
    @Body('assignedToId') assignedToId,
  ): Promise<Kpi> {
    return await this.kpisService.reassign(id, assignedToId);
  }
  @Get()
  async getAllSortedByAssignName(
    @Query('sort') sort: 'ASC' | 'DESC' = 'ASC',
  ): Promise<Kpi[]> {
    return this.kpisService.getAllSortedByAssignName(sort);
  }
}
