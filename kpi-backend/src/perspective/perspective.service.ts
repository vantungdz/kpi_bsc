import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Perspective } from 'src/perspective/entities/perspective.entity';
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

  async create(perspective: Partial<Perspective>): Promise<Perspective> {
    // Loại bỏ id nếu được cung cấp để tránh vi phạm khóa chính
    const { id, ...data } = perspective;
    const newPerspective = this.perspectivesRepository.create(data);
    return await this.perspectivesRepository.save(newPerspective);
  }

  async update(
    id: number,
    perspective: Partial<Perspective>,
  ): Promise<Perspective> {
    await this.perspectivesRepository.update(id, perspective);
    const updatedPerspective = await this.perspectivesRepository.findOne({
      where: { id },
    });
    if (!updatedPerspective) {
      throw new UnauthorizedException('Perspective not found');
    }
    return updatedPerspective;
  }

  async delete(id: number): Promise<void> {
    const result = await this.perspectivesRepository.delete(id);
    if (result.affected === 0) {
      throw new UnauthorizedException('Perspective not found');
    }
  }
}
