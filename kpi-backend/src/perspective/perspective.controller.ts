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
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Perspective } from 'src/perspective/entities/perspective.entity';
import { PerspectiveService } from './perspective.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/guards/roles.decorator';
import { CreatePerspectiveDto } from './dto/create-perspective.dto';
import { UpdatePerspectiveDto } from './dto/update-perspective.dto';

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
  @UsePipes(new ValidationPipe())
  async create(
    @Body() createPerspectiveDto: CreatePerspectiveDto,
  ): Promise<Perspective> {
    return await this.perspectivesService.create(createPerspectiveDto);
  }

  @Put(':id')
  @UsePipes(new ValidationPipe())
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePerspectiveDto: UpdatePerspectiveDto,
  ): Promise<Perspective> {
    return await this.perspectivesService.update(id, updatePerspectiveDto);
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await this.perspectivesService.delete(id);
  }
}
