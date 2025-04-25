
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query, 
  UseGuards,
  Req,
  NotFoundException, 
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
  }) 
  @ApiQuery({
    name: 'sectionId',
    required: false,
    type: Number,
    description: 'Filter employees by Section ID',
  })
  async findAll(
    @Query('departmentId') departmentId?: number, 
    @Query('sectionId') sectionId?: number, 
  ): Promise<Employee[]> {
    
    const filterOptions = { departmentId, sectionId };
    
    return this.employeeService.findAll(filterOptions);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get employee details by ID' }) 
  @ApiResponse({ status: 200, description: 'Employee found', type: Employee }) 
  @ApiResponse({ status: 404, description: 'Employee not found' }) 
  async findOne(@Param('id') id: number): Promise<Employee> {
    const user = await this.employeeService.findOne(id);
    return user;
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    return this.employeeService.remove(id);
  }
}
