import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { ReviewCycleService } from './review-cycle.service';
import { ReviewCycle } from '../entities/review-cycle.entity';

@Controller('review-cycles')
export class ReviewCycleController {
  constructor(private readonly reviewCycleService: ReviewCycleService) {}

  @Get()
  async findAll(): Promise<ReviewCycle[]> {
    return this.reviewCycleService.findAll();
  }

  @Post()
  async create(
    @Body() body: { name: string; startDate: string; endDate: string },
  ) {
    return this.reviewCycleService.create(
      body.name,
      body.startDate,
      body.endDate,
    );
  }

  @Put(':id')
  async update(
    @Param('id') id: number,
    @Body() body: { name: string; startDate: string; endDate: string },
  ) {
    return this.reviewCycleService.update(
      id,
      body.name,
      body.startDate,
      body.endDate,
    );
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.reviewCycleService.remove(id);
  }
}
