// src/sections/section.controller.ts
import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { SectionsService } from './sections.service';
import { Section } from 'src/entities/section.entity';

@Controller('sections')
export class SectionsController {
  constructor(private readonly sectionService: SectionsService) {}

  @Post()
  async create(@Body() createSectionDto: any): Promise<Section> {
    return this.sectionService.create(createSectionDto);
  }

  @Get()
  async findSections(
    @Query('department_id') departmentId?: number,
    @Query('kpi_id') kpiId?: number,
  ): Promise<any[]> {
    const sections = await this.sectionService.getFilteredSections(
      kpiId ? Number(kpiId) : undefined,
      departmentId ? Number(departmentId) : undefined,
    );

    if (departmentId != undefined) {
      return sections.map(({ department, ...rest }) => rest); // strip department
    }
    return sections; // strip department
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Section> {
    return this.sectionService.findOne(id);
  }
}
