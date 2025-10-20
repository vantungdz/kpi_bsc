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
  UploadedFile,
  UseInterceptors,
  HttpException,
  HttpStatus,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { Employee } from 'src/employees/entities/employee.entity';
import { ApiOperation, ApiResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import * as XLSX from 'xlsx';
import { Request } from 'express';
import { PolicyGuard } from '../auth/guards/policy.guard';
import { PolicyCheck } from '../auth/guards/policy.decorator';
import { EmployeePerformanceHistoryDto } from './dto/employee-performance-history.dto';

@ApiTags('Employees')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeeService: EmployeesService) {}

  @Get()
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
    @Req() req: Request & { user?: Employee },
    @Query('departmentId', new ParseIntPipe({ optional: true }))
    departmentId?: number,
    @Query('sectionId', new ParseIntPipe({ optional: true }))
    sectionId?: number,
    @Query('teamId', new ParseIntPipe({ optional: true })) teamId?: number,
  ): Promise<Employee[]> {
    if (!req.user) {
      throw new UnauthorizedException('User not authenticated.');
    }
    const filterOptions = { departmentId, sectionId, teamId };
    return this.employeeService.findAll(filterOptions, req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get employee details by ID' })
  @ApiResponse({ status: 200, description: 'Employee found', type: Employee })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<any> {
    const employee = await this.employeeService.findOne(id);
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }
    const skills = await this.employeeService.getEmployeeSkillsWithLevel(id);
    return { ...employee, skills };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an employee' })
  @ApiResponse({ status: 200, description: 'Employee deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  async deleteEmployee(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.employeeService.remove(id);
    return { message: 'Employee deleted successfully.' };
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadEmployeeExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    try {
      if (!file.originalname.match(/\.(xlsx|xls)$/)) {
        throw new HttpException(
          'Invalid file format. Only .xlsx or .xls files are allowed.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      if (!Array.isArray(data) || data.length === 0) {
        throw new HttpException('Excel file is empty', HttpStatus.BAD_REQUEST);
      }

      const result = await this.employeeService.saveEmployeeData(data);

      return {
        message: result.message,
        successCount: result.successCount,
        errors: result.errors,
      };
    } catch (error) {
      console.error('Error processing file:', error.message || error);
      throw new HttpException(
        `Failed to process the uploaded file: ${error.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':id/roles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Update user roles (multiple)' })
  async updateRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body('roles') roles: (string | number)[],
  ): Promise<Employee> {
    return this.employeeService.updateRoles(id, roles);
  }

  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Update user role (single, legacy)' })
  async updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body('role') role: string,
  ): Promise<Employee> {
    return this.employeeService.updateRoles(id, [role]);
  }

  @Patch(':id/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Reset employee password' })
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body('newPassword') newPassword?: string,
  ): Promise<{ message: string }> {
    await this.employeeService.resetPassword(id, newPassword);
    return { message: 'Password reset successfully.' };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Update employee info' })
  async updateEmployee(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: Partial<Employee & { roles?: (string | number)[] }>,
  ): Promise<Employee> {
    return this.employeeService.updateEmployee(id, updateDto);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new employee' })
  @ApiResponse({ status: 201, description: 'Employee created', type: Employee })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createEmployee(@Body() createEmployeeDto: any): Promise<Employee> {
    return this.employeeService.create(createEmployeeDto);
  }

  @Get('department/:departmentId/manager-only')
  @UseGuards(PolicyGuard)
  @PolicyCheck('isManagerOfDepartment', { getDepartmentIdFromParam: true })
  async managerOnlyEndpoint(
    @Req() req,
    @Param('departmentId', ParseIntPipe) departmentId: number,
  ) {
    return { message: `You are the manager of department ${departmentId}!` };
  }

  @Get(':id/performance-history')
  @ApiOperation({ summary: 'Get employee performance history by year' })
  async getPerformanceHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query('fromYear') fromYear?: number,
    @Query('toYear') toYear?: number,
  ): Promise<EmployeePerformanceHistoryDto> {
    return this.employeeService.getEmployeePerformanceHistory(
      id,
      fromYear,
      toYear,
    );
  }
}
