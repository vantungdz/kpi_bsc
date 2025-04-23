import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Perspective } from 'src/entities/perspective.entity';
import { Repository } from 'typeorm';

// perspectives.service.ts
@Injectable()
export class PerspectiveService {
  constructor(
    @InjectRepository(Perspective)
    private perspectivesRepository: Repository<Perspective>,
  ) {}

  async findAll(): Promise<Perspective[]> {
    return await this.perspectivesRepository.find();
  }

  async findOne(id: number): Promise<Perspective> {
    const dataRes = await this.perspectivesRepository.findOne({
      where: { id },
    });

    if (!dataRes) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return dataRes;
  }
}
