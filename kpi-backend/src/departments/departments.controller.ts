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
import { Department } from 'src/entities/department.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';

@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentsController {
  constructor(private readonly departmentService: DepartmentsService) {}

  @Post()
  @Roles('department:create:company', 'department:create:department')
  async create(@Body() createDepartmentDto: any): Promise<Department> {
    return this.departmentService.create(createDepartmentDto);
  }

  @Get()
  @Roles(
    'department:view:company',
    'department:view:department',
    'department:view:section',
  )
  async findAll(): Promise<Department[]> {
    return this.departmentService.findAll();
  }

  @Get(':id')
  @Roles(
    'department:view:company',
    'department:view:department',
    'department:view:section',
  )
  async findOne(@Param('id') id: number): Promise<Department> {
    return this.departmentService.findOne(id);
  }
}
