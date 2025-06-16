import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Competency } from '../entities/competency.entity';
import { Employee } from '../entities/employee.entity';
import { CompetencyService } from './competency.service';
import { CompetencyController } from './competency.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Competency, Employee])],
  controllers: [CompetencyController],
  providers: [CompetencyService],
  exports: [CompetencyService],
})
export class CompetencyModule {}
