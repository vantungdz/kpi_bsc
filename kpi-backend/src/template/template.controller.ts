import { Controller, Get, Post, Body, Put, Patch, Param, Delete, UseGuards, Query, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { TemplateService } from './template.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PermissionGuard } from 'src/common/rbac/permission.guard';
import { Employee } from 'src/employees/entities/employee.entity';

@Controller('template')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Post('create')
  create(
    @Body() createTemplateDto: CreateTemplateDto,
    @Req() req: Request & { user?: Employee },
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    return this.templateService.create(createTemplateDto, req.user.id);
  }

  @Get()
  findAll(
    @Query('name') name?: string,
    @Query('type') type?: string,
    @Query('typePerformance') typePerformance?: string,
    @Query('perspective_id') perspective_id?: string,
    @Query('formula_id') formula_id?: string,
    @Query('review_cycle_id') review_cycle_id?: string,
    @Query('frequency') frequency?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: any = {};
    
    if (name) filters.name = name;
    if (type) filters.type = type;
    if (typePerformance) filters.typePerformance = typePerformance;
    if (perspective_id) filters.perspective_id = parseInt(perspective_id, 10);
    if (formula_id) filters.formula_id = parseInt(formula_id, 10);
    if (review_cycle_id) filters.review_cycle_id = parseInt(review_cycle_id, 10);
    if (frequency) filters.frequency = frequency;
    if (page) filters.page = parseInt(page, 10);
    if (limit) filters.limit = parseInt(limit, 10);

    return this.templateService.findAll(filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templateService.findOne(+id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
    @Req() req: Request & { user?: Employee },
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    return this.templateService.update(+id, updateTemplateDto, req.user.id);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() req: Request & { user?: Employee },
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated.');
    }
    return this.templateService.remove(+id, req.user.id);
  }
}
