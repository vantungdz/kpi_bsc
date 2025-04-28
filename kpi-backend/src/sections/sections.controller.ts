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
    // @Query('kpi_id') kpiId?: number, // Có thể bỏ nếu service không dùng
  ): Promise<Section[]> {
    // <-- Thay any[] bằng Section[] để chặt chẽ hơn về kiểu
    console.log(
      `[SectionsController] findSections called with departmentId: ${departmentId}`,
    );

    // Chỉ cần gọi service, service đã đảm bảo có thông tin department
    const sections = await this.sectionService.getFilteredSections(
      departmentId ? Number(departmentId) : undefined,
    );

    console.log(
      `[SectionsController] Returning sections received from service.`,
    );

    // Trả về trực tiếp kết quả từ service mà không cần map hay loại bỏ gì cả
    return sections;
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Section> {
    return this.sectionService.findOne(id);
  }
}
