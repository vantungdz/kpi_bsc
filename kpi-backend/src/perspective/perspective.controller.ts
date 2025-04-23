import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { Perspective } from 'src/entities/perspective.entity';
import { PerspectiveService } from './perspective.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

// perspectives.controller.ts
@Controller('perspectives')
@UseGuards(JwtAuthGuard)
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
