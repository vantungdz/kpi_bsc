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
  ): Promise<Section[]> {
    console.log(
      `[SectionsController] findSections called with departmentId: ${departmentId}`,
    );

    const sections = await this.sectionService.getFilteredSections(
      departmentId ? Number(departmentId) : undefined,
    );

    console.log(
      `[SectionsController] Returning sections received from service.`,
    );

    return sections;
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Section> {
    return this.sectionService.findOne(id);
  }
}
