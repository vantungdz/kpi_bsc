import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KpiFormula } from '../entities/kpi-formula.entity';
import { KpiFormulaService } from './kpi-formula.service';
import { KpiFormulaController } from './kpi-formula.controller';

@Module({
  imports: [TypeOrmModule.forFeature([KpiFormula])],
  providers: [KpiFormulaService],
  controllers: [KpiFormulaController],
  exports: [KpiFormulaService],
})
export class KpiFormulaModule {}
