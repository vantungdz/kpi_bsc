import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KpiValue } from '../entities/kpi-value.entity';
import { KpiValuesService } from './kpi-values.service';
import { KpiValuesController } from './kpi-values.controller';

@Module({
  imports: [TypeOrmModule.forFeature([KpiValue])],
  providers: [KpiValuesService],
  controllers: [KpiValuesController],
})
export class KpiValuesModule {}
