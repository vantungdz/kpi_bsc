// src/employees/employee.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query, // <== Import Query
  UseGuards,
  Req,
  NotFoundException, // <== Import NotFoundException
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { Employee } from 'src/entities/employee.entity';
import { ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeeService: EmployeesService) {}

  @Post()
  async create(@Body() createEmployeeDto: Employee): Promise<Employee> {
    return this.employeeService.create(createEmployeeDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all employees, optionally filtered by department or section',
  })
  @ApiQuery({
    name: 'departmentId',
    required: false,
    type: Number,
    description: 'Filter employees by Department ID',
  }) // <== Swagger Docs
  @ApiQuery({
    name: 'sectionId',
    required: false,
    type: Number,
    description: 'Filter employees by Section ID',
  })
  async findAll(
    @Query('departmentId') departmentId?: number, // <== Lấy departmentId từ query params
    @Query('sectionId') sectionId?: number, // <== Lấy sectionId từ query params
  ): Promise<Employee[]> {
    // Pass the filter parameters to the service method
    const filterOptions = { departmentId, sectionId };
    // Nếu filterOptions rỗng, service.findAll sẽ trả về tất cả như cũ
    return this.employeeService.findAll(filterOptions);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get employee details by ID' }) // Thêm lại Swagger nếu cần
  @ApiResponse({ status: 200, description: 'Employee found', type: Employee }) // Thêm lại Swagger nếu cần
  @ApiResponse({ status: 404, description: 'Employee not found' }) // Thêm lại Swagger nếu cần
  async findOne(@Param('id') id: number): Promise<Employee> {
    const user = await this.employeeService.findOne(id);
    return user;
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    return this.employeeService.remove(id);
  }
}
