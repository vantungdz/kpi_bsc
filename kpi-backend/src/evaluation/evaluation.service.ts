import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KpiReview } from '../entities/kpi-review.entity';
import { OverallReview } from '../entities/overall-review.entity';
import {
  SubmitKpiReviewDto,
  KpiReviewItemDto,
  SubmitEmployeeFeedbackDto,
  SubmitSelfKpiReviewDto,
} from './dto/evaluation.dto';
import { Employee } from '../entities/employee.entity';

@Injectable()
export class EvaluationService {
  constructor(
    @InjectRepository(KpiReview)
    private readonly kpiReviewRepository: Repository<KpiReview>,
    @InjectRepository(OverallReview)
    private readonly overallReviewRepository: Repository<OverallReview>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
  ) {}

  async submitKpiReview(dto: SubmitKpiReviewDto, reviewerId: number) {
    // Lưu từng review chi tiết cho từng KPI
    for (const item of dto.kpiReviews) {
      let review = await this.kpiReviewRepository.findOne({
        where: {
          assignmentId: item.assignmentId,
          cycleId: dto.cycleId,
          reviewedById: reviewerId,
        },
      });
      if (!review) {
        review = this.kpiReviewRepository.create({
          assignmentId: item.assignmentId,
          cycleId: dto.cycleId,
          reviewedById: reviewerId,
        });
      }
      review.managerScore = item.managerScore ?? null;
      review.managerComment = item.managerComment ?? null;
      await this.kpiReviewRepository.save(review);
    }
    // Cập nhật OverallReview (tổng thể)
    let overall = await this.overallReviewRepository.findOne({
      where: {
        targetId: dto.targetId,
        targetType: dto.targetType,
        cycleId: dto.cycleId,
        reviewedById: reviewerId,
      },
    });
    if (!overall) {
      overall = this.overallReviewRepository.create({
        targetId: dto.targetId,
        targetType: dto.targetType,
        cycleId: dto.cycleId,
        reviewedById: reviewerId,
      });
    }
    overall.overallComment = dto.overallComment ?? '';
    // TODO: Tính toán overallScore, totalWeightedScore, cập nhật status theo luồng phê duyệt
    await this.overallReviewRepository.save(overall);
    return overall;
  }

  async submitSelfKpiReview(dto: SubmitSelfKpiReviewDto, employeeId: number) {
    for (const item of dto.kpiReviews) {
      let review = await this.kpiReviewRepository.findOne({
        where: {
          assignmentId: item.assignmentId,
          cycleId: dto.cycleId,
          reviewedById: employeeId,
        },
      });
      if (!review) {
        review = this.kpiReviewRepository.create({
          assignmentId: item.assignmentId,
          cycleId: dto.cycleId,
          reviewedById: employeeId,
        });
      }
      review.selfScore = item.selfScore ?? null;
      review.selfComment = item.selfComment ?? null;
      await this.kpiReviewRepository.save(review);
    }
    return true;
  }

  async submitEmployeeFeedback(
    dto: SubmitEmployeeFeedbackDto,
    employeeId: number,
  ) {
    const overall = await this.overallReviewRepository.findOne({
      where: {
        targetId: employeeId,
        targetType: 'employee',
        cycleId: dto.cycleId,
      },
    });
    if (!overall) throw new NotFoundException('No overall review found');
    overall.employeeComment = dto.employeeComment;
    overall.employeeFeedbackDate = new Date();
    // TODO: Cập nhật status sang EMPLOYEE_RESPONDED nếu đúng luồng
    await this.overallReviewRepository.save(overall);
    return overall;
  }

  async getOverallReview(
    targetId: number,
    targetType: 'employee' | 'section' | 'department',
    cycleId: string,
    reviewerId: number,
  ) {
    return this.overallReviewRepository.findOne({
      where: {
        targetId,
        targetType: targetType as 'employee' | 'section' | 'department',
        cycleId,
        reviewedById: reviewerId,
      },
    });
  }

  async getKpiReviews(
    targetId: number,
    targetType: 'employee' | 'section' | 'department',
    cycleId: string,
    reviewerId: number,
  ) {
    // Lấy danh sách review chi tiết cho các assignment thuộc target trong chu kỳ
    return this.kpiReviewRepository.find({
      where: {
        cycleId,
        reviewedById: reviewerId,
      },
      relations: ['assignment'],
    });
  }
}
