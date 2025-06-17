import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { Team } from './entities/team.entity';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  async findAll(): Promise<Team[]> {
    return await this.teamsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Team> {
    return await this.teamsService.findOne(id);
  }

  @Post()
  create(@Body() team: Partial<Team>): Promise<Team> {
    return this.teamsService.create(team);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() update: Partial<Team>,
  ): Promise<Team> {
    return this.teamsService.update(+id, update);
  }

  @Delete(':id')
  delete(@Param('id') id: string): Promise<void> {
    return this.teamsService.delete(+id);
  }
}
