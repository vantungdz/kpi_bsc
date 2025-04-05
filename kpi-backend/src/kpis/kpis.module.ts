import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KpisService } from './kpis.service';
import { KpisController } from './kpis.controller';
import { Kpi } from '../entities/kpi.entity';
import { KpiValue } from '../entities/kpi-value.entity';
import { KpiEvaluation } from '../entities/kpi-evaluation.entity';
import { User } from 'src/entities/user.entity';
import { Perspective } from 'src/entities/perspective.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Kpi, KpiValue, KpiEvaluation, User, Perspective]),
  ],
  providers: [KpisService],
  controllers: [KpisController],
})
export class KpisModule {}
