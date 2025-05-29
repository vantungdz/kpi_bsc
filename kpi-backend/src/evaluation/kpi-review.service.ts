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

  async getKpiReviews(filter: any, reqUser?: any): Promise<KpiReview[]> {
    // Nếu có user truyền vào, lọc theo quyền
    if (reqUser) {
      // Always extract role as string
      const role = typeof reqUser.role === 'string' ? reqUser.role : reqUser.role?.name;
      // List of statuses that are considered 'submitted' or further
      const allowedStatuses = [
        ReviewStatus.SELF_REVIEWED,
        ReviewStatus.SECTION_REVIEWED,
        ReviewStatus.DEPARTMENT_REVIEWED,
        ReviewStatus.MANAGER_REVIEWED,
        ReviewStatus.EMPLOYEE_FEEDBACK,
        ReviewStatus.COMPLETED,
        ReviewStatus.DEPARTMENT_REVIEW_PENDING,
      ];
      if (role === 'section') {
        // Lấy tất cả employee thuộc section/department mà section này quản lý
        const employees = await this.kpiReviewRepository.manager.find(Employee, {
          where: {
            sectionId: reqUser.sectionId,
            departmentId: reqUser.departmentId,
          },
        });
        const employeeIds = employees.map((e) => e.id);
        return this.kpiReviewRepository.find({
          where: {
            ...filter,
            employee: employeeIds.length ? { id: In(employeeIds) } : undefined,
            status: In(allowedStatuses), // Đảm bảo không lấy PENDING
          },
          relations: ['kpi', 'employee', 'department', 'section'],
        });
      }
      if (role === 'department') {
        // Lấy tất cả employee thuộc department mà department này quản lý
        const employees = await this.kpiReviewRepository.manager.find(Employee, {
          where: {
            departmentId: reqUser.departmentId,
          },
        });
        const employeeIds = employees.map((e) => e.id);
        return this.kpiReviewRepository.find({
          where: {
            ...filter,
            employee: employeeIds.length ? { id: In(employeeIds) } : undefined,
            status: In(allowedStatuses), // Đảm bảo không lấy PENDING
          },
          relations: ['kpi', 'employee', 'department', 'section'],
        });
      }
      if (role === 'manager' || role === 'admin') {
        // Trả về tất cả review đã gửi (not PENDING)
        return this.kpiReviewRepository.find({
          where: {
            ...filter,
            status: In(allowedStatuses), // Đảm bảo không lấy PENDING
          },
          relations: ['kpi', 'employee', 'department', 'section'],
        });
      }
      // Employee chỉ xem review của chính mình
      return this.kpiReviewRepository.find({
        where: {
          ...filter,
          employee: { id: reqUser.id },
          status: In(allowedStatuses), // Đảm bảo không lấy PENDING cho employee
        },
        relations: ['kpi', 'employee', 'department', 'section'],
      });
    }
    // Nếu không truyền user, lấy tất cả theo filter nhưng loại PENDING
    return this.kpiReviewRepository.find({
      where: {
        ...filter,
        status: In([
          ReviewStatus.SELF_REVIEWED,
          ReviewStatus.SECTION_REVIEWED,
          ReviewStatus.DEPARTMENT_REVIEWED,
          ReviewStatus.MANAGER_REVIEWED,
          ReviewStatus.EMPLOYEE_FEEDBACK,
          ReviewStatus.COMPLETED,
          ReviewStatus.DEPARTMENT_REVIEW_PENDING,
        ]),
      },
      relations: ['kpi', 'employee', 'department', 'section'],
    });
  }

  // Hàm giả lập lấy danh sách employeeIds mà manager quản lý
  async getManagedEmployeeIds(managerId: number): Promise<number[]> {
    // 1. Lấy các section mà manager này quản lý
    const sectionRepo = this.kpiReviewRepository.manager.getRepository('Section');
    const managedSections = await sectionRepo.find({ where: { managerId } });
    const sectionIds = managedSections.map((s: any) => s.id);

    // 2. Lấy các department mà manager này quản lý
    const departmentRepo = this.kpiReviewRepository.manager.getRepository('Department');
    const managedDepartments = await departmentRepo.find({ where: { managerId } });
    const departmentIds = managedDepartments.map((d: any) => d.id);

    // 3. Lấy tất cả employee thuộc các section/department đó hoặc trực tiếp dưới quyền
    const employeeRepo = this.kpiReviewRepository.manager.getRepository(Employee);
    const whereClause: any[] = [];
    if (sectionIds.length) {
      whereClause.push({ sectionId: In(sectionIds) });
    }
    if (departmentIds.length) {
      whereClause.push({ departmentId: In(departmentIds) });
    }
    // Trực tiếp dưới quyền
    whereClause.push({ managerId });

    // Gộp điều kiện bằng OR
    const employees = await employeeRepo.find({
      where: whereClause.length > 1 ? whereClause : whereClause[0],
    });
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
      relations: ['section'],
    });
    if (!review) throw new Error('Review not found');
    // Nếu review gắn với section, không cho phép section đó tự duyệt
    if (review.section && review.section.id) {
      // Lấy thông tin user section đang duyệt
      if (review.section.id === sectionUserId) {
        throw new Error('Section không được tự duyệt review do chính section mình tạo ra. Chỉ cấp trên mới được duyệt.');
      }
    }
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

  // Department review (skip-level approval supported)
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
    // Cho phép department duyệt nếu status là SELF_REVIEWED, SECTION_REVIEWED, hoặc DEPARTMENT_REVIEWED (skip-level)
    if (![
      ReviewStatus.SELF_REVIEWED,
      ReviewStatus.SECTION_REVIEWED,
      ReviewStatus.DEPARTMENT_REVIEWED,
    ].includes(review.status)) {
      throw new Error('Chỉ được duyệt khi đã qua bước tự đánh giá hoặc section hoặc department');
    }
    review.departmentScore = body.departmentScore;
    review.departmentComment = body.departmentComment;
    // Nếu đã có department review, giữ nguyên status, nếu không thì chuyển sang DEPARTMENT_REVIEWED
    review.status = ReviewStatus.DEPARTMENT_REVIEWED;
    await this.kpiReviewRepository.save(review);
    return review;
  }

  // Manager review (skip-level approval supported)
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
    // Cho phép manager duyệt nếu status là SELF_REVIEWED, SECTION_REVIEWED, DEPARTMENT_REVIEWED, hoặc MANAGER_REVIEWED (skip-level)
    if (![
      ReviewStatus.SELF_REVIEWED,
      ReviewStatus.SECTION_REVIEWED,
      ReviewStatus.DEPARTMENT_REVIEWED,
      ReviewStatus.MANAGER_REVIEWED,
    ].includes(review.status)) {
      throw new Error('Chỉ được duyệt khi đã qua bước tự đánh giá, section, department hoặc manager');
    }
    review.managerScore = body.managerScore;
    review.managerComment = body.managerComment;
    // Sau khi manager duyệt, chuyển sang EMPLOYEE_FEEDBACK
    review.status = ReviewStatus.EMPLOYEE_FEEDBACK;
    await this.kpiReviewRepository.save(review);
    return review;
  }

  // Nhân viên feedback
  async submitEmployeeFeedback(
    employeeId: number,
    body: { reviewId: number; employeeFeedback: string },
  ) {
    const review = await this.kpiReviewRepository.findOne({
      where: { id: body.reviewId, employee: { id: employeeId } },
    });
    if (!review) throw new Error('Review not found');
    if (review.status !== ReviewStatus.EMPLOYEE_FEEDBACK) {
      throw new Error('Chỉ feedback khi trạng thái là EMPLOYEE_FEEDBACK');
    }
    review.employeeFeedback = body.employeeFeedback;
    review.status = ReviewStatus.MANAGER_REVIEWED; // Chờ quản lý xác nhận hoàn thành
    await this.kpiReviewRepository.save(review);
    return review;
  }

  // Quản lý xác nhận hoàn thành
  async completeReview(reviewId: number, userId: number) {
    const review = await this.kpiReviewRepository.findOne({
      where: { id: reviewId },
    });
    if (!review) throw new Error('Review not found');
    if (review.status !== ReviewStatus.MANAGER_REVIEWED) {
      throw new Error('Chỉ hoàn thành khi đã feedback và chờ xác nhận');
    }
    review.status = ReviewStatus.COMPLETED;
    await this.kpiReviewRepository.save(review);
    return review;
  }

  async getKpisForReview(filter: any, managerId?: number): Promise<KpiReview[]> {
    const reviews = await this.kpiReviewRepository.find({
      where: filter,
      relations: ['kpi', 'employee', 'department', 'section'],
    });

    // Fetch selfComment and selfScore for each review
    for (const review of reviews) {
      const selfReview = await this.kpiReviewRepository.findOne({
        where: {
          kpi: { id: review.kpi.id },
          employee: { id: review.employee.id },
          status: ReviewStatus.SELF_REVIEWED,
        },
      });
      if (selfReview) {
        review.selfComment = selfReview.selfComment;
        review.selfScore = selfReview.selfScore;
      }

      // Update status for department role
      if (managerId && review.status === ReviewStatus.SECTION_REVIEWED) {
        review.status = ReviewStatus.DEPARTMENT_REVIEW_PENDING;
      }
    }

    return reviews;
  }

  async mergeDuplicateReviews(kpiId: number, cycle: string): Promise<void> {
    const reviews = await this.kpiReviewRepository.find({
      where: { kpi: { id: kpiId }, cycle },
    });

    if (reviews.length > 1) {
      const mergedReview = reviews.reduce((acc, review) => {
        acc.selfScore = acc.selfScore || review.selfScore;
        acc.selfComment = acc.selfComment || review.selfComment;
        acc.sectionScore = acc.sectionScore || review.sectionScore;
        acc.sectionComment = acc.sectionComment || review.sectionComment;
        acc.departmentScore = acc.departmentScore || review.departmentScore;
        acc.departmentComment = acc.departmentComment || review.departmentComment;
        return acc;
      }, reviews[0]);

      await this.kpiReviewRepository.save(mergedReview);
      for (let i = 1; i < reviews.length; i++) {
        await this.kpiReviewRepository.delete(reviews[i].id);
      }
    }
  }
}
