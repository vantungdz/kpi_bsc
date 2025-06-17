// src/departments/department.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { Department } from 'src/departments/entities/department.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';

@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentsController {
  constructor(private readonly departmentService: DepartmentsService) {}

  @Post()
  async create(@Body() createDepartmentDto: any): Promise<Department | { warning: string, employee: any }> {
    return this.departmentService.create(createDepartmentDto);
  }

  @Get()
  async findAll(): Promise<Department[]> {
    return this.departmentService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Department> {
    return this.departmentService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: number,
    @Body() updateDepartmentDto: any,
  ): Promise<Department | { warning: string, employee: any }> {
    return this.departmentService.update(id, updateDepartmentDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<{ success: boolean }> {
    await this.departmentService.remove(id);
    return { success: true };
  }
}
