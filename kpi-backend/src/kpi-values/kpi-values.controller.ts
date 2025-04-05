import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { KpiValuesService } from './kpi-values.service';
import { KpiValue } from '../entities/kpi-value.entity';

@Controller('kpi-values')
export class KpiValuesController {
  constructor(private readonly kpiValuesService: KpiValuesService) {}

  @Get()
  async findAll(): Promise<KpiValue[]> {
    return await this.kpiValuesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<KpiValue> {
    return await this.kpiValuesService.findOne(id);
  }
  
  @Post()
  create(@Body() kpiValue: Partial<KpiValue>): Promise<KpiValue> {
    return this.kpiValuesService.create(kpiValue);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() update: Partial<KpiValue>,
  ): Promise<KpiValue> {
    return this.kpiValuesService.update(+id, update);
  }

  @Delete(':id')
  delete(@Param('id') id: string): Promise<void> {
    return this.kpiValuesService.delete(+id);
  }
}
