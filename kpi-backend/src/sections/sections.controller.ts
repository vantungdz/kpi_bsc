import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body, 
  ParseIntPipe,
} from '@nestjs/common';
import { SectionsService } from './sections.service';
import { Section } from '../entities/section.entity';

@Controller('sections')
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  @Get()
  async findAll(): Promise<Section[]> {
    return await this.sectionsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Section> {
    return await this.sectionsService.findOne(id);
  }

  @Post()
  create(@Body() section: Partial<Section>): Promise<Section> {
    return this.sectionsService.create(section);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() update: Partial<Section>,
  ): Promise<Section> {
    return this.sectionsService.update(+id, update);
  }

  @Delete(':id')
  delete(@Param('id') id: string): Promise<void> {
    return this.sectionsService.delete(+id);
  }
}
