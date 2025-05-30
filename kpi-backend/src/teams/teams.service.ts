import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from '../entities/team.entity';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private teamsRepository: Repository<Team>,
  ) {}

  async findAll(): Promise<Team[]> {
    return await this.teamsRepository.find();
  }

  async findOne(id: number): Promise<Team> {
    const relationsDta = await this.teamsRepository.findOne({
      where: { id },
    });

    if (!relationsDta) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return relationsDta;
  }

  async create(team: Partial<Team>): Promise<Team> {
    const newTeam = this.teamsRepository.create(team);
    return this.teamsRepository.save(newTeam);
  }

  async update(id: number, update: Partial<Team>): Promise<Team> {
    await this.teamsRepository.update(id, update);
    return this.findOne(id);
  }

  async delete(id: number): Promise<void> {
    await this.teamsRepository.delete(id);
  }
}
