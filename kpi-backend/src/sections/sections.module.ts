import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Section } from '../entities/section.entity';
import { SectionsService } from './sections.service';
import { SectionsController } from './sections.controller';
import { KPIAssignment } from 'src/entities/kpi-assignment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Section, KPIAssignment])],
  providers: [SectionsService],
  controllers: [SectionsController],
  exports: [SectionsService],
})
export class SectionsModule {}
