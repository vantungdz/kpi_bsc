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
import { ReviewCycle } from './entities/review-cycle.entity';

/**
 * Controller quản lý các chu kỳ đánh giá (ReviewCycle)
 * Cung cấp các API CRUD cho review cycle
 */
@Controller('review-cycles')
export class ReviewCycleController {
  constructor(private readonly reviewCycleService: ReviewCycleService) {}

  /**
   * Lấy danh sách tất cả review cycle
   */
  @Get()
  async findAll(): Promise<ReviewCycle[]> {
    return this.reviewCycleService.findAll();
  }

  /**
   * Tạo mới một review cycle
   */
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

  /**
   * Cập nhật thông tin review cycle
   */
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

  /**
   * Xóa một review cycle theo id
   */
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.reviewCycleService.remove(id);
  }
}
