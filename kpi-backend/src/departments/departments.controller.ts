// departments.controller.ts
import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { DepartmentsService } from './departments.service'; 
import { Department } from 'src/entities/department.entity';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  async findAll(): Promise<Department[]> {
    return await this.departmentsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Department> {
    return await this.departmentsService.findOne(id);
  }

  @Post()
  create(@Body() department: Partial<Department>): Promise<Department> {
    return this.departmentsService.create(department);
  }
}
