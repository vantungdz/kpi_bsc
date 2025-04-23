// src/employees/employee.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete, 
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { Employee } from 'src/entities/employee.entity';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeeService: EmployeesService) {}

  @Post()
  async create(@Body() createEmployeeDto: Employee): Promise<Employee> {
    return this.employeeService.create(createEmployeeDto);
  }

  @Get()
  async findAll(): Promise<Employee[]> {
    return this.employeeService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Employee> {
    return this.employeeService.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    return this.employeeService.remove(id);
  }
}
