import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Put,
  Delete,
} from '@nestjs/common';
import { SectionsService } from './sections.service';
import { Section } from 'src/sections/entities/section.entity';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@Controller('sections')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SectionsController {
  constructor(private readonly sectionService: SectionsService) {}

  @Post()
  async create(@Body() createSectionDto: any): Promise<Section | { warning: string; employee: any }> {
    return this.sectionService.create(createSectionDto);
  }

  @Get()
  async findSections(
    @Query('department_id') departmentId?: number,
  ): Promise<Section[]> {
    return await this.sectionService.getFilteredSections(
      departmentId ? Number(departmentId) : undefined,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Section> {
    return this.sectionService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: number,
    @Body() updateSectionDto: any,
  ): Promise<Section | { warning: string; employee: any }> {
    return this.sectionService.update(id, updateSectionDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<{ success: boolean }> {
    await this.sectionService.remove(id);
    return { success: true };
  }
}
