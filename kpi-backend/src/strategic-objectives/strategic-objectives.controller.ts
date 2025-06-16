import { Controller, Get, Post, Body, Param, Patch, Delete, Logger } from '@nestjs/common';
import { StrategicObjectivesService } from './strategic-objectives.service';
import { CreateStrategicObjectiveDto, UpdateStrategicObjectiveDto } from './dto/strategic-objective.dto';

@Controller('strategic-objectives')
export class StrategicObjectivesController {
  private readonly logger = new Logger(StrategicObjectivesController.name);
  constructor(private readonly service: StrategicObjectivesService) {}

  @Post()
  create(@Body() dto: CreateStrategicObjectiveDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOne(Number(id));
  }

  @Patch(':id')
  update(@Param('id') id: number, @Body() dto: UpdateStrategicObjectiveDto) {
    return this.service.update(Number(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.service.remove(Number(id));
  }

  @Get('stats/by-status-perspective')
  async statsByStatusAndPerspective() {
    return this.service.statsByStatusAndPerspective();
  }

  @Get('stats/progress-distribution')
  async statsProgressDistribution() {
    return this.service.statsProgressDistribution();
  }
}
