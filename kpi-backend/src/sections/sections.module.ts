import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Section } from './entities/section.entity';
import { SectionsService } from './sections.service';
import { SectionsController } from './sections.controller';
import { KPIAssignment } from 'src/kpi-assessments/entities/kpi-assignment.entity';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [TypeOrmModule.forFeature([Section, KPIAssignment]), EmployeesModule],
  providers: [SectionsService],
  controllers: [SectionsController],
  exports: [SectionsService],
})
export class SectionsModule {}
