import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { KpiReview, ReviewStatus } from '../entities/kpi-review.entity';
import { CreateKpiReviewDto, UpdateKpiReviewDto } from './dto/kpi-review.dto';
import { Kpi } from '../entities/kpi.entity';
import { KPIAssignment } from '../entities/kpi-assignment.entity';
import { KpiValue, KpiValueStatus } from '../entities/kpi-value.entity';
import { Employee } from '../entities/employee.entity';

@Injectable()
export class KpiReviewService {
  constructor(
    @InjectRepository(KpiReview)
    private readonly kpiReviewRepository: Repository<KpiReview>,
    @InjectRepository(Kpi)
    private readonly kpiRepository: Repository<Kpi>,
    @InjectRepository(KPIAssignment)
    private readonly kpiAssignmentRepository: Repository<KPIAssignment>,
    @InjectRepository(KpiValue)
    private readonly kpiValueRepository: Repository<KpiValue>,
  ) {}

  async getKpiReviews(filter: any, managerId?: number): Promise<KpiReview[]> {
    // Nếu có managerId, chỉ lấy các review của nhân viên thuộc quyền quản lý
    if (managerId) {
      // Lấy danh sách employeeIds mà manager này quản lý (bao gồm section, department, hoặc trực tiếp)
      // Giả sử có hàm getManagedEmployeeIds(managerId) trả về mảng id
      const employeeIds = await this.getManagedEmployeeIds(managerId);
      return this.kpiReviewRepository.find({
        where: {
          ...filter,
          employee: employeeIds.length ? { id: In(employeeIds) } : undefined,
        },
        relations: ['kpi', 'employee', 'department', 'section'],
      });
    }
    // Nếu không truyền managerId, lấy tất cả theo filter
    return this.kpiReviewRepository.find({
      where: filter,
      relations: ['kpi', 'employee', 'department', 'section'],
    });
  }

  // Hàm giả lập lấy danh sách employeeIds mà manager quản lý
  async getManagedEmployeeIds(managerId: number): Promise<number[]> {
    // TODO: Thay bằng truy vấn thực tế theo tổ chức của bạn
    // Ví dụ: lấy tất cả employee thuộc các section/department mà manager này quản lý
    // Ở đây trả về tất cả employee để demo
    // Gợi ý thực tế:
    // 1. Lấy các section mà manager này quản lý
    // 2. Lấy các department mà manager này quản lý
    // 3. Lấy tất cả employee thuộc các section/department đó hoặc trực tiếp dưới quyền
    // Ví dụ demo:
    const employees = await this.kpiReviewRepository.manager.find(Employee);
    return employees.map((e) => e.id);
  }

  async getKpiReviewById(id: number): Promise<KpiReview | null> {
    return this.kpiReviewRepository.findOne({
      where: { id },
      relations: ['kpi', 'employee', 'department', 'section'],
    });
  }

  async createKpiReview(dto: CreateKpiReviewDto): Promise<KpiReview> {
    const review = this.kpiReviewRepository.create(dto);
    return this.kpiReviewRepository.save(review);
  }

  async updateKpiReview(
    id: number,
    dto: UpdateKpiReviewDto,
  ): Promise<KpiReview> {
    await this.kpiReviewRepository.update(id, dto);
    const review = await this.getKpiReviewById(id);
    if (!review) throw new NotFoundException('KpiReview not found');
    return review;
  }

  async getReviewHistory(kpiId: number, cycle: string): Promise<KpiReview[]> {
    return this.kpiReviewRepository.find({
      where: { kpi: { id: kpiId }, cycle },
      order: { createdAt: 'ASC' },
    });
  }

  async getMyKpisForReview(userId: number, cycle: string) {
    // 1. Lấy các assignment đã được duyệt cho user này
    const assignments = await this.kpiAssignmentRepository.find({
      where: {
        assigned_to_employee: userId,
        status: 'APPROVED',
        deleted_at: IsNull(),
      },
      relations: ['kpi', 'kpiValues', 'employee'],
    });
    const result: KpiReview[] = [];
    for (const assignment of assignments) {
      if (!assignment.kpi) continue;
      // 2. Lấy actual value đã được duyệt gần nhất cho assignment này
      const approvedValues = (assignment.kpiValues || []).filter(
        (v) => v.status === KpiValueStatus.APPROVED,
      );
      if (!approvedValues.length) continue;
      const latestValue = approvedValues.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )[0];
      // 3. Kiểm tra đã có review cho assignment/cycle chưa
      let review = await this.kpiReviewRepository.findOne({
        where: { assignment: { id: assignment.id }, cycle },
        relations: ['kpi', 'assignment'],
      });
      if (!review) {
        // 4. Nếu chưa có thì tạo mới
        const reviewData: any = {
          kpi: { id: assignment.kpi.id },
          assignment: { id: assignment.id },
          cycle: cycle,
          targetValue: assignment.targetValue ?? 0,
          actualValue: latestValue.value ?? 0,
          status: ReviewStatus.PENDING,
        };
        if (assignment.employee && assignment.employee.id) {
          reviewData.employee = { id: assignment.employee.id };
        }
        const newReviewArr = this.kpiReviewRepository.create([reviewData]);
        const newReview = newReviewArr[0];
        const savedReviewArr = await this.kpiReviewRepository.save([newReview]);
        review = savedReviewArr[0];
      }
      if (review) {
        result.push(review);
      }
    }
    return result;
  }

  async submitMyKpiSelfReview(
    userId: number,
    body: {
      cycle: string;
      kpis: Array<{ id: number; selfScore: number; selfComment: string }>;
    },
  ) {
    for (const item of body.kpis) {
      // Lấy review hiện tại
      const review = await this.kpiReviewRepository.findOne({
        where: { id: item.id, employee: { id: userId }, cycle: body.cycle },
      });
      if (!review) continue;
      // Nếu chưa self-review thì cập nhật status
      let status = review.status;
      if (status === ReviewStatus.PENDING) {
        status = ReviewStatus.SELF_REVIEWED;
      }
      await this.kpiReviewRepository.update(
        { id: item.id, employee: { id: userId }, cycle: body.cycle },
        { selfScore: item.selfScore, selfComment: item.selfComment, status },
      );
    }
    // Return updated reviews for the user/cycle so frontend can refresh
    return this.getMyKpisForReview(userId, body.cycle);
  }

  async submitSectionReview(
    sectionUserId: number, // id của user section đang duyệt
    body: {
      reviewId: number;
      sectionScore: number;
      sectionComment: string;
    },
  ) {
    const review = await this.kpiReviewRepository.findOne({
      where: { id: body.reviewId },
    });
    if (!review) throw new Error('Review not found');
    // Chỉ cho phép section duyệt khi status là SELF_REVIEWED
    if (review.status !== ReviewStatus.SELF_REVIEWED) {
      throw new Error('Chỉ được duyệt khi đã tự đánh giá');
    }
    review.sectionScore = body.sectionScore;
    review.sectionComment = body.sectionComment;
    review.status = ReviewStatus.SECTION_REVIEWED;
    await this.kpiReviewRepository.save(review);
    return review;
  }

  // Department review
  async submitDepartmentReview(
    departmentUserId: number,
    body: {
      reviewId: number;
      departmentScore: number;
      departmentComment: string;
    },
  ) {
    const review = await this.kpiReviewRepository.findOne({
      where: { id: body.reviewId },
    });
    if (!review) throw new Error('Review not found');
    // Chỉ cho phép department duyệt khi status là SECTION_REVIEWED hoặc SELF_REVIEWED (nếu không có section)
    if (
      ![ReviewStatus.SECTION_REVIEWED, ReviewStatus.SELF_REVIEWED].includes(
        review.status,
      )
    ) {
      throw new Error(
        'Chỉ được duyệt khi đã qua bước section hoặc tự đánh giá',
      );
    }
    review.departmentScore = body.departmentScore;
    review.departmentComment = body.departmentComment;
    review.status = ReviewStatus.DEPARTMENT_REVIEWED;
    await this.kpiReviewRepository.save(review);
    return review;
  }

  // Manager review
  async submitManagerReview(
    managerUserId: number,
    body: {
      reviewId: number;
      managerScore: number;
      managerComment: string;
    },
  ) {
    const review = await this.kpiReviewRepository.findOne({
      where: { id: body.reviewId },
    });
    if (!review) throw new Error('Review not found');
    // Chỉ cho phép manager duyệt khi status là DEPARTMENT_REVIEWED hoặc SECTION_REVIEWED/SELF_REVIEWED (nếu không có cấp dưới)
    if (
      ![
        ReviewStatus.DEPARTMENT_REVIEWED,
        ReviewStatus.SECTION_REVIEWED,
        ReviewStatus.SELF_REVIEWED,
      ].includes(review.status)
    ) {
      throw new Error(
        'Chỉ được duyệt khi đã qua bước department/section/tự đánh giá',
      );
    }
    review.managerScore = body.managerScore;
    review.managerComment = body.managerComment;
    review.status = ReviewStatus.MANAGER_REVIEWED;
    await this.kpiReviewRepository.save(review);
    return review;
  }

  // Hoàn thành review (chuyển trạng thái COMPLETED)
  async completeReview(reviewId: number, userId: number) {
    const review = await this.kpiReviewRepository.findOne({
      where: { id: reviewId },
    });
    if (!review) throw new Error('Review not found');
    // Chỉ cho phép hoàn thành khi đã manager review
    if (review.status !== ReviewStatus.MANAGER_REVIEWED) {
      throw new Error('Chỉ hoàn thành khi đã được manager review');
    }
    review.status = ReviewStatus.COMPLETED;
    await this.kpiReviewRepository.save(review);
    return review;
  }
}
