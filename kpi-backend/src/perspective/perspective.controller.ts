import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { Perspective } from 'src/entities/perspective.entity';
import { PerspectiveService } from './perspective.service';

// perspectives.controller.ts
@Controller('perspectives')
export class PerspectiveController {
  constructor(private readonly perspectivesService: PerspectiveService) {}

  @Get()
  async findAll(): Promise<Perspective[]> {
    return await this.perspectivesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Perspective> {
    return await this.perspectivesService.findOne(id);
  }
}
