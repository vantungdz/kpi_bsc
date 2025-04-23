import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import { PerformanceEvaluationService } from './performance-evaluation.service';
import { PerformanceEvaluation } from 'src/entities/performance-evaluation.entity';

@Controller('performance-evaluations')
export class PerformanceEvaluationController {
  constructor(
    private readonly performanceEvaluationService: PerformanceEvaluationService,
  ) {}

  @Post()
  create(
    @Body() performanceEvaluation: Partial<PerformanceEvaluation>,
  ): Promise<PerformanceEvaluation> {
    return this.performanceEvaluationService.create(performanceEvaluation);
  }

  @Get()
  findAll(): Promise<PerformanceEvaluation[]> {
    return this.performanceEvaluationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<PerformanceEvaluation> {
    return this.performanceEvaluationService.findOne(+id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateData: Partial<PerformanceEvaluation>,
  ): Promise<PerformanceEvaluation> {
    return this.performanceEvaluationService.update(+id, updateData);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.performanceEvaluationService.remove(+id);
  }
}
