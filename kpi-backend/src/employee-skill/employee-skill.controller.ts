import { Controller, Get, Post, Body, Param, Patch, Delete, Query } from '@nestjs/common';
import { EmployeeSkillService } from './employee-skill.service';
import { CreateEmployeeSkillDto, UpdateEmployeeSkillDto } from './dto/employee-skill.dto';

@Controller('employee-skills')
export class EmployeeSkillController {
  constructor(private readonly service: EmployeeSkillService) {}

  @Post()
  create(@Body() dto: CreateEmployeeSkillDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query('employeeId') employeeId?: number) {
    return this.service.findAll(employeeId);
  }

  @Patch(':id')
  update(@Param('id') id: number, @Body() dto: UpdateEmployeeSkillDto) {
    return this.service.update(Number(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.service.remove(Number(id));
  }
}
