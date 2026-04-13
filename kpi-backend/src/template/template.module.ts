import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplateService } from './template.service';
import { TemplateController } from './template.controller';
import { Template } from './entities/template.entity';
import { Perspective } from '../perspective/entities/perspective.entity';
import { KpiFormula } from '../kpi-formula/entities/kpi-formula.entity';
import { ReviewCycle } from '../review-cycle/entities/review-cycle.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Template,
      Perspective,
      KpiFormula,
      ReviewCycle,
    ]),
  ],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
