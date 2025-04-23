import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KpiValue } from '../entities/kpi-value.entity';
import { KpiValuesService } from './kpi-values.service';
import { KpiValuesController } from './kpi-values.controller';
import { KpiValueHistory } from 'src/entities/kpi-value-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([KpiValue, KpiValueHistory])],
  providers: [KpiValuesService],
  controllers: [KpiValuesController],
})
export class KpiValuesModule {}
