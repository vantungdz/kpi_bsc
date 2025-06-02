import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
  Body,
  Post,
  Put,
  Delete,
} from '@nestjs/common';
import { Perspective } from 'src/entities/perspective.entity';
import { PerspectiveService } from './perspective.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/guards/roles.decorator';

@Controller('perspectives')
@UseGuards(JwtAuthGuard, RolesGuard)
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

  @Post()
  async create(
    @Body() perspective: Partial<Perspective>,
  ): Promise<Perspective> {
    return await this.perspectivesService.create(perspective);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() perspective: Partial<Perspective>,
  ): Promise<Perspective> {
    return await this.perspectivesService.update(id, perspective);
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await this.perspectivesService.delete(id);
  }
}
