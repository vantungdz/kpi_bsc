import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SectionsService } from './sections.service';
import { Section } from 'src/entities/section.entity';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/guards/roles.decorator';

@Controller('sections')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SectionsController {
  constructor(private readonly sectionService: SectionsService) {}

  @Post()
  @Roles('section:create:company')
  async create(@Body() createSectionDto: any): Promise<Section> {
    return this.sectionService.create(createSectionDto);
  }

  @Get()
  @Roles(
    'section:view:company',
    'section:view:department',
    'section:view:employee',
  )
  async findSections(
    @Query('department_id') departmentId?: number,
  ): Promise<Section[]> {
    return await this.sectionService.getFilteredSections(
      departmentId ? Number(departmentId) : undefined,
    );
  }

  @Get(':id')
  @Roles(
    'section:view:company',
    'section:view:department',
    'section:view:employee',
  )
  async findOne(@Param('id') id: number): Promise<Section> {
    return this.sectionService.findOne(id);
  }
}
