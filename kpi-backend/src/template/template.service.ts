import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { Template } from './entities/template.entity';
import { Perspective } from '../perspective/entities/perspective.entity';
import { KpiFormula } from '../kpi-formula/entities/kpi-formula.entity';
import { ReviewCycle } from '../review-cycle/entities/review-cycle.entity';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    @InjectRepository(Template)
    private readonly templateRepository: Repository<Template>,
    @InjectRepository(Perspective)
    private readonly perspectiveRepository: Repository<Perspective>,
    @InjectRepository(KpiFormula)
    private readonly formulaRepository: Repository<KpiFormula>,
    @InjectRepository(ReviewCycle)
    private readonly reviewCycleRepository: Repository<ReviewCycle>,
  ) {}

  async create(createTemplateDto: CreateTemplateDto, userId: number): Promise<Template> {
    // Validate perspective if provided
    if (createTemplateDto.perspective_id) {
      const perspective = await this.perspectiveRepository.findOne({
        where: { id: createTemplateDto.perspective_id },
      });
      if (!perspective) {
        throw new NotFoundException(
          `Perspective with ID ${createTemplateDto.perspective_id} not found`,
        );
      }
    }

    // Validate formula if provided
    if (createTemplateDto.formula_id) {
      const formula = await this.formulaRepository.findOne({
        where: { id: createTemplateDto.formula_id },
      });
      if (!formula) {
        throw new NotFoundException(
          `Formula with ID ${createTemplateDto.formula_id} not found`,
        );
      }
    }

    // Create template entity
    const template = this.templateRepository.create({
      name: createTemplateDto.name,
      typePerformance: createTemplateDto.typePerformance,
      type: createTemplateDto.type,
      unit: createTemplateDto.unit,
      target: createTemplateDto.target,
      weight: createTemplateDto.weight,
      frequency: createTemplateDto.frequency,
      perspective_id: createTemplateDto.perspective_id,
      formula_id: createTemplateDto.formula_id,
      description: createTemplateDto.description,
      created_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    try {
      const savedTemplate = await this.templateRepository.save(template);
      
      // Load relations for response
      const templateWithRelations = await this.templateRepository.findOne({
        where: { id: savedTemplate.id },
        relations: ['perspective', 'formula', 'reviewCycle', 'createdBy'],
      });

      if (!templateWithRelations) {
        throw new BadRequestException('Failed to load created template');
      }

      return templateWithRelations;
    } catch (error) {
      this.logger.error('Error creating template:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create template');
    }
  }

  async findAll(filters?: {
    name?: string;
    type?: string;
    typePerformance?: string;
    perspective_id?: number;
    formula_id?: number;
    review_cycle_id?: number;
    frequency?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Template[];
    pagination?: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  }> {
    const {
      name,
      type,
      typePerformance,
      perspective_id,
      formula_id,
      review_cycle_id,
      frequency,
      page = 1,
      limit = 50,
    } = filters || {};

    const query = this.templateRepository
      .createQueryBuilder('template')
      .leftJoinAndSelect('template.perspective', 'perspective')
      .leftJoinAndSelect('template.formula', 'formula')
      .leftJoinAndSelect('template.reviewCycle', 'reviewCycle')
      .leftJoinAndSelect('template.createdBy', 'createdBy')
      .where('template.deleted_at IS NULL');

    // Filter by name (search)
    if (name) {
      query.andWhere('LOWER(template.name) LIKE LOWER(:name)', {
        name: `%${name}%`,
      });
    }

    // Filter by type
    if (type) {
      query.andWhere('template.type = :type', { type });
    }

    // Filter by typePerformance
    if (typePerformance) {
      query.andWhere('template.typePerformance = :typePerformance', {
        typePerformance,
      });
    }

    // Filter by perspective_id
    if (perspective_id) {
      query.andWhere('template.perspective_id = :perspective_id', {
        perspective_id,
      });
    }

    // Filter by formula_id
    if (formula_id) {
      query.andWhere('template.formula_id = :formula_id', { formula_id });
    }

    // Filter by review_cycle_id
    if (review_cycle_id) {
      query.andWhere('template.review_cycle_id = :review_cycle_id', {
        review_cycle_id,
      });
    }

    // Filter by frequency
    if (frequency) {
      query.andWhere('template.frequency = :frequency', { frequency });
    }

    // Order by created_at descending (newest first)
    query.orderBy('template.created_at', 'DESC');

    // Get total count for pagination (before applying skip/take)
    const totalItems = await query.getCount();

    // Pagination
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    // Execute query
    const data = await query.getMany();

    // Calculate pagination info
    const totalPages = Math.ceil(totalItems / limit);

    return {
      data,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
      },
    };
  }

  async findOne(id: number): Promise<Template> {
    const template = await this.templateRepository.findOne({
      where: { id },
      relations: ['perspective', 'formula', 'reviewCycle', 'createdBy'],
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return template;
  }

  async update(
    id: number,
    updateTemplateDto: UpdateTemplateDto,
    userId: number,
  ): Promise<Template> {
    // Find existing template - use query builder to avoid eager loading issues
    const template = await this.templateRepository
      .createQueryBuilder('template')
      .where('template.id = :id', { id })
      .getOne();

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    // Validate perspective if provided
    if (updateTemplateDto.perspective_id !== undefined) {
      if (updateTemplateDto.perspective_id !== null) {
        const perspective = await this.perspectiveRepository.findOne({
          where: { id: updateTemplateDto.perspective_id },
        });
        if (!perspective) {
          throw new NotFoundException(
            `Perspective with ID ${updateTemplateDto.perspective_id} not found`,
          );
        }
      }
    }

    // Validate formula if provided
    if (updateTemplateDto.formula_id !== undefined) {
      if (updateTemplateDto.formula_id !== null) {
        const formula = await this.formulaRepository.findOne({
          where: { id: updateTemplateDto.formula_id },
        });
        if (!formula) {
          throw new NotFoundException(
            `Formula with ID ${updateTemplateDto.formula_id} not found`,
          );
        }
      }
    }

    // Prepare update data
    const updateData: Partial<Template> = {
      updated_by: userId,
      updated_at: new Date(),
    };

    // Add fields to update data if provided
    if (updateTemplateDto.name !== undefined) {
      updateData.name = updateTemplateDto.name;
    }
    if (updateTemplateDto.typePerformance !== undefined) {
      updateData.typePerformance = updateTemplateDto.typePerformance;
    }
    if (updateTemplateDto.type !== undefined) {
      updateData.type = updateTemplateDto.type;
    }
    if (updateTemplateDto.unit !== undefined) {
      updateData.unit = updateTemplateDto.unit;
    }
    if (updateTemplateDto.target !== undefined) {
      updateData.target = updateTemplateDto.target;
    }
    if (updateTemplateDto.weight !== undefined) {
      updateData.weight = updateTemplateDto.weight;
    }
    if (updateTemplateDto.frequency !== undefined) {
      updateData.frequency = updateTemplateDto.frequency;
    }
    if (updateTemplateDto.perspective_id !== undefined) {
      updateData.perspective_id = updateTemplateDto.perspective_id;
    }
    if (updateTemplateDto.formula_id !== undefined) {
      updateData.formula_id = updateTemplateDto.formula_id;
    }
    if (updateTemplateDto.description !== undefined) {
      updateData.description = updateTemplateDto.description;
    }

    try {
      // Update using query builder to ensure all fields are included
      await this.templateRepository
        .createQueryBuilder()
        .update(Template)
        .set(updateData)
        .where('id = :id', { id })
        .execute();

      // Load relations for response
      const templateWithRelations = await this.templateRepository.findOne({
        where: { id },
        relations: ['perspective', 'formula', 'reviewCycle', 'createdBy'],
      });

      if (!templateWithRelations) {
        throw new BadRequestException('Failed to load updated template');
      }

      return templateWithRelations;
    } catch (error) {
      this.logger.error('Error updating template:', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update template');
    }
  }

  async remove(id: number, userId: number): Promise<void> {
    const template = await this.templateRepository.findOne({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    // Soft delete: set deleted_at and deleted_by
    template.deleted_by = userId;
    await this.templateRepository.save(template);
    await this.templateRepository.softDelete(id);
  }
}
