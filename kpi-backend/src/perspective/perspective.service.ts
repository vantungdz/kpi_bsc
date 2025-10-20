import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Perspective } from 'src/perspective/entities/perspective.entity';
import { Repository } from 'typeorm';
import { CreatePerspectiveDto } from './dto/create-perspective.dto';
import { UpdatePerspectiveDto } from './dto/update-perspective.dto';

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

  async create(
    createPerspectiveDto: CreatePerspectiveDto,
  ): Promise<Perspective> {
    // Check if perspective with same name already exists
    const existingPerspective = await this.perspectivesRepository.findOne({
      where: { name: createPerspectiveDto.name },
    });

    if (existingPerspective) {
      throw new ConflictException('Perspective with this name already exists');
    }

    try {
      const newPerspective =
        this.perspectivesRepository.create(createPerspectiveDto);
      return await this.perspectivesRepository.save(newPerspective);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY' || error.code === '23505') {
        throw new ConflictException(
          'Perspective with this name already exists',
        );
      }
      throw new BadRequestException('Failed to create perspective');
    }
  }

  async update(
    id: number,
    updatePerspectiveDto: UpdatePerspectiveDto,
  ): Promise<Perspective> {
    // Check if perspective exists
    const existingPerspective = await this.perspectivesRepository.findOne({
      where: { id },
    });

    if (!existingPerspective) {
      throw new UnauthorizedException('Perspective not found');
    }

    // Check if name is being updated and if it conflicts with existing name
    if (
      updatePerspectiveDto.name &&
      updatePerspectiveDto.name !== existingPerspective.name
    ) {
      const nameConflict = await this.perspectivesRepository.findOne({
        where: { name: updatePerspectiveDto.name },
      });

      if (nameConflict) {
        throw new ConflictException(
          'Perspective with this name already exists',
        );
      }
    }

    try {
      await this.perspectivesRepository.update(id, updatePerspectiveDto);
      const updatedPerspective = await this.perspectivesRepository.findOne({
        where: { id },
      });
      if (!updatedPerspective) {
        throw new UnauthorizedException('Perspective not found');
      }
      return updatedPerspective;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY' || error.code === '23505') {
        throw new ConflictException(
          'Perspective with this name already exists',
        );
      }
      throw new BadRequestException('Failed to update perspective');
    }
  }

  async delete(id: number): Promise<void> {
    const result = await this.perspectivesRepository.delete(id);
    if (result.affected === 0) {
      throw new UnauthorizedException('Perspective not found');
    }
  }
}
