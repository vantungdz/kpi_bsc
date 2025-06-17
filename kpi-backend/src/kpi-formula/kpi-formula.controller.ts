import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { KpiFormulaService } from './kpi-formula.service';
import { KpiFormula } from './entities/kpi-formula.entity';
import { CreateKpiFormulaDto, UpdateKpiFormulaDto } from './dto';

@Controller('kpi-formulas')
export class KpiFormulaController {
  constructor(private readonly formulaService: KpiFormulaService) {}

  @Get()
  findAll(): Promise<KpiFormula[]> {
    return this.formulaService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<KpiFormula> {
    return this.formulaService.findOne(Number(id));
  }

  @Post()
  create(@Body() data: CreateKpiFormulaDto): Promise<KpiFormula> {
    return this.formulaService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: UpdateKpiFormulaDto): Promise<KpiFormula> {
    return this.formulaService.update(Number(id), data);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.formulaService.remove(Number(id));
  }
}
