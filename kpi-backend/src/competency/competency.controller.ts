import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { CompetencyService } from './competency.service';
import { CreateCompetencyDto, UpdateCompetencyDto } from './dto/competency.dto';

@Controller('competencies')
export class CompetencyController {
  constructor(private readonly competencyService: CompetencyService) {}

  @Post()
  create(@Body() dto: CreateCompetencyDto) {
    return this.competencyService.create(dto);
  }

  @Get()
  findAll() {
    return this.competencyService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.competencyService.findOne(Number(id));
  }

  @Patch(':id')
  update(@Param('id') id: number, @Body() dto: UpdateCompetencyDto) {
    return this.competencyService.update(Number(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.competencyService.remove(Number(id));
  }
}
