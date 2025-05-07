import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  Patch,
  NotFoundException,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { Employee } from 'src/entities/employee.entity';
import { ApiOperation, ApiResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard'; // Assuming you have JWT Auth
import { RolesGuard } from 'src/auth/guards/roles.guard'; // Assuming you have Roles Guard
import { Roles } from 'src/auth/guards/roles.decorator'; // Assuming you have Roles Decorator

@ApiTags('Employees')
@UseGuards(JwtAuthGuard, RolesGuard) // Apply guards globally or per endpoint
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeeService: EmployeesService) {}


  @Get()
  @Roles('admin', 'manager', 'leader') // Example: Broader access for listing
  @ApiOperation({
    summary:
      'Get all employees, optionally filtered by department, section, or team',
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
    @Query('departmentId', new ParseIntPipe({ optional: true }))
    departmentId?: number,
    @Query('sectionId', new ParseIntPipe({ optional: true }))
    sectionId?: number,
    @Query('teamId', new ParseIntPipe({ optional: true })) teamId?: number,
  ): Promise<Employee[]> {
    const filterOptions = { departmentId, sectionId, teamId };
    return this.employeeService.findAll(filterOptions);
  }

  @Get(':id')
  @Roles('admin', 'manager', 'leader') // Or even allow self-view
  @ApiOperation({ summary: 'Get employee details by ID' })
  @ApiResponse({ status: 200, description: 'Employee found', type: Employee })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Employee> {
    const employee = await this.employeeService.findOne(id);
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }
    return employee;
  }

  @Delete(':id')
  @Roles('admin') // Example: Only admin can delete
  @ApiOperation({ summary: 'Delete an employee' })
  @ApiResponse({ status: 200, description: 'Employee deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.employeeService.remove(id);
  }
}
