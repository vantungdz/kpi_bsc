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
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { Employee } from 'src/entities/employee.entity';
import { ApiOperation, ApiResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/guards/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import * as XLSX from 'xlsx';

@ApiTags('Employees')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeeService: EmployeesService) {}

  @Get()
  @Roles('admin', 'manager', 'leader')
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
  @Roles('admin', 'manager', 'leader')
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
  @Roles('admin')
  @ApiOperation({ summary: 'Delete an employee' })
  @ApiResponse({ status: 200, description: 'Employee deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.employeeService.remove(id);
  }

  @Post('upload')
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
        message: 'Employee data uploaded successfully',
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
}
