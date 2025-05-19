import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
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
  @Roles('admin', 'manager', 'employee')
  async findAll(): Promise<Perspective[]> {
    return await this.perspectivesService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'manager', 'employee')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Perspective> {
    return await this.perspectivesService.findOne(id);
  }
}
