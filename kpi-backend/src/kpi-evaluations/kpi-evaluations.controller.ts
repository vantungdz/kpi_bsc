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
import { KpiEvaluationsService } from './kpi-evaluations.service';
import { KpiEvaluation } from '../entities/kpi-evaluation.entity';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';

@Controller('kpi-evaluations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KpiEvaluationsController {
  constructor(private readonly kpiEvaluationsService: KpiEvaluationsService) {}

  @Get()
  async findAll(): Promise<KpiEvaluation[]> {
    return await this.kpiEvaluationsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<KpiEvaluation> {
    return await this.kpiEvaluationsService.findOne(id);
  }

  @Post()
  create(@Body() evaluation: Partial<KpiEvaluation>): Promise<KpiEvaluation> {
    return this.kpiEvaluationsService.create(evaluation);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() update: Partial<KpiEvaluation>,
  ): Promise<KpiEvaluation> {
    return this.kpiEvaluationsService.update(+id, update);
  }

  @Delete(':id')
  delete(@Param('id') id: string): Promise<void> {
    return this.kpiEvaluationsService.delete(+id);
  }
}
