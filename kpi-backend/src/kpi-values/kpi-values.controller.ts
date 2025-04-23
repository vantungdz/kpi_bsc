import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { KpiValuesService } from './kpi-values.service';
import { KpiValue } from '../entities/kpi-value.entity';
import { KpiValueHistory } from '../entities/kpi-value-history.entity';

@Controller('kpi-values')
export class KpiValuesController {
  constructor(private readonly kpiValuesService: KpiValuesService) {}
  @Get()
  async findAll(): Promise<KpiValue[]> {
    return await this.kpiValuesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<KpiValue> {
    const kpiValue = await this.kpiValuesService.findOne(Number(id));
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found`);
    }
    return kpiValue;
  }

  @Post()
  async create(@Body() kpiValueData: Partial<KpiValue>): Promise<KpiValue> {
    // Giả sử user_id của người tạo được gửi trong body (thực tế nên lấy từ token JWT)
    // const createdBy = kpiValueData.user_id || 1; // Mặc định user_id = 1 (admin)
    const createdBy = 1; // TODO
    return this.kpiValuesService.create(kpiValueData, createdBy);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateData: Partial<KpiValue>,
  ): Promise<KpiValue> {
    // Giả sử user_id của người cập nhật được gửi trong body (thực tế nên lấy từ token JWT)
    // const updatedBy = updateData.user_id || 1; // Mặc định user_id = 1 (admin)
    const updatedBy = 1; // TODO
    const kpiValue = await this.kpiValuesService.update(
      Number(id),
      updateData,
      updatedBy,
    );
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found`);
    }
    return kpiValue;
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    // Giả sử user_id của người xóa được gửi trong request (thực tế nên lấy từ token JWT)
    const deletedBy = 1; // Mặc định user_id = 1 (admin)
    const result = await this.kpiValuesService.delete(Number(id), deletedBy);
    if (!result) {
      throw new NotFoundException(`KPI Value with ID ${id} not found`);
    }
  }

  @Get(':id/history')
  async getHistory(@Param('id') id: string): Promise<KpiValueHistory[]> {
    return this.kpiValuesService.getHistory(Number(id));
  }
}
