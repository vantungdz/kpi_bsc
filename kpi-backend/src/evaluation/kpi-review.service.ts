import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { KpiReview, ReviewStatus } from '../entities/kpi-review.entity';
import { CreateKpiReviewDto, UpdateKpiReviewDto } from './dto/kpi-review.dto';
import { Kpi } from '../entities/kpi.entity';
import { KPIAssignment } from '../entities/kpi-assignment.entity';
import { KpiValue, KpiValueStatus } from '../entities/kpi-value.entity';
import { Employee } from '../entities/employee.entity';
import { KpiReviewHistory } from '../entities/kpi-review-history.entity';

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
    @InjectRepository(KpiReviewHistory)
    private readonly kpiReviewHistoryRepository: Repository<KpiReviewHistory>,
  ) {}

  /**
   * Lấy danh sách KPI reviews theo filter và quyền của user
   * @param filter Điều kiện lọc
   * @param reqUser Thông tin user yêu cầu (nếu có)
   * @returns Danh sách KPI reviews
   */

  async getKpiReviews(filter: any, reqUser?: any): Promise<any[]> {
    // Nếu có user truyền vào, lọc theo quyền
    if (reqUser) {
      // Always extract role as string
      const role =
        typeof reqUser.role === 'string' ? reqUser.role : reqUser.role?.name;
      // List of statuses that are considered 'submitted' or further
      const allowedStatuses = [
        ReviewStatus.SELF_REVIEWED,
        ReviewStatus.SECTION_REVIEWED,
        ReviewStatus.DEPARTMENT_REVIEWED,
        ReviewStatus.MANAGER_REVIEWED,
        ReviewStatus.EMPLOYEE_FEEDBACK,
        ReviewStatus.COMPLETED,
        ReviewStatus.SECTION_REJECTED,
        ReviewStatus.DEPARTMENT_REJECTED,
        ReviewStatus.MANAGER_REJECTED,
      ];
      if (role === 'section') {
        // Lấy tất cả employee thuộc section/department mà section này quản lý
        const employees = await this.kpiReviewRepository.manager.find(
          Employee,
          {
            where: {
              sectionId: reqUser.sectionId,
              departmentId: reqUser.departmentId,
            },
          },
        );
        const employeeIds = employees.map((e) => e.id);
        const reviews = await this.kpiReviewRepository.find({
          where: {
            ...filter,
            employee: employeeIds.length ? { id: In(employeeIds) } : undefined,
            status: In(allowedStatuses),
          },
          relations: ['kpi', 'employee', 'department', 'section'],
        });
        return reviews.map((r) => ({
          ...r,
          score:
            getFinalScore(r) !== null && r.kpi && r.kpi.weight != null
              ? getFinalScore(r)! * r.kpi.weight
              : null,
        }));
      }
      if (role === 'department') {
        // Lấy tất cả employee thuộc department mà department này quản lý
        const employees = await this.kpiReviewRepository.manager.find(
          Employee,
          {
            where: {
              departmentId: reqUser.departmentId,
            },
          },
        );
        const employeeIds = employees.map((e) => e.id);
        const reviews = await this.kpiReviewRepository.find({
          where: {
            ...filter,
            employee: employeeIds.length ? { id: In(employeeIds) } : undefined,
            status: In(allowedStatuses),
          },
          relations: ['kpi', 'employee', 'department', 'section'],
        });
        return reviews.map((r) => ({
          ...r,
          score:
            getFinalScore(r) !== null && r.kpi && r.kpi.weight != null
              ? getFinalScore(r)! * r.kpi.weight
              : null,
        }));
      }
      if (role === 'manager' || role === 'admin') {
        // Trả về tất cả review đã gửi (not PENDING)
        const reviews = await this.kpiReviewRepository.find({
          where: {
            ...filter,
            status: In(allowedStatuses),
          },
          relations: ['kpi', 'employee', 'department', 'section'],
        });
        return reviews.map((r) => ({
          ...r,
          score:
            getFinalScore(r) !== null && r.kpi && r.kpi.weight != null
              ? getFinalScore(r)! * r.kpi.weight
              : null,
        }));
      }
      // Employee chỉ xem review của chính mình
      const reviews = await this.kpiReviewRepository.find({
        where: {
          ...filter,
          employee: { id: reqUser.id },
          status: In(allowedStatuses),
        },
        relations: ['kpi', 'employee', 'department', 'section'],
      });
      return reviews.map((r) => ({
        ...r,
        score:
          getFinalScore(r) !== null && r.kpi && r.kpi.weight != null
            ? getFinalScore(r)! * r.kpi.weight
            : null,
      }));
    }
    // Nếu không truyền user, lấy tất cả theo filter nhưng loại PENDING
    const reviews = await this.kpiReviewRepository.find({
      where: {
        ...filter,
        status: In([
          ReviewStatus.SELF_REVIEWED,
          ReviewStatus.SECTION_REVIEWED,
          ReviewStatus.DEPARTMENT_REVIEWED,
          ReviewStatus.MANAGER_REVIEWED,
          ReviewStatus.EMPLOYEE_FEEDBACK,
          ReviewStatus.COMPLETED,
        ]),
      },
      relations: ['kpi', 'employee', 'department', 'section'],
    });
    return reviews.map((r) => ({
      ...r,
      score:
        getFinalScore(r) !== null && r.kpi && r.kpi.weight != null
          ? getFinalScore(r)! * r.kpi.weight
          : null,
    }));
  }

  // Hàm giả lập lấy danh sách employeeIds mà manager quản lý
  async getManagedEmployeeIds(managerId: number): Promise<number[]> {
    // 1. Lấy các section mà manager này quản lý
    const sectionRepo =
      this.kpiReviewRepository.manager.getRepository('Section');
    const managedSections = await sectionRepo.find({ where: { managerId } });
    const sectionIds = managedSections.map((s: any) => s.id);

    // 2. Lấy các department mà manager này quản lý
    const departmentRepo =
      this.kpiReviewRepository.manager.getRepository('Department');
    const managedDepartments = await departmentRepo.find({
      where: { managerId },
    });
    const departmentIds = managedDepartments.map((d: any) => d.id);

    // 3. Lấy tất cả employee thuộc các section/department đó hoặc trực tiếp dưới quyền
    const employeeRepo =
      this.kpiReviewRepository.manager.getRepository(Employee);
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

  // Lấy lịch sử review cho 1 KPI/cycle/employee
  async getKpiReviewHistory(kpiId: number, cycle: string, employeeId?: number) {
    const where: any = { kpiId, cycle };
    if (employeeId) where.employeeId = employeeId;
    // Lấy lịch sử review
    const history = await this.kpiReviewHistoryRepository.find({
      where,
      order: { createdAt: 'ASC' },
    });
    // Lấy danh sách reviewedBy (userId) duy nhất
    const reviewerIds = Array.from(new Set(history.map(h => h.reviewedBy).filter(Boolean)));
    let reviewersMap: Record<number, { id: number, first_name: string, last_name: string }> = {};
    if (reviewerIds.length) {
      // Lấy thông tin reviewer từ bảng employee
      const employees = await this.kpiReviewRepository.manager.getRepository('Employee').findByIds(reviewerIds);
      reviewersMap = employees.reduce((acc, emp) => {
        acc[emp.id] = emp;
        return acc;
      }, {});
    }
    // Gắn reviewerName vào từng bản ghi lịch sử
    return history.map(h => ({
      ...h,
      reviewerName: h.reviewedBy && reviewersMap[h.reviewedBy]
        ? `${reviewersMap[h.reviewedBy].first_name} ${reviewersMap[h.reviewedBy].last_name}`
        : null
    }));
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
        relations: ['kpi', 'employee'],
      });
      if (!review) continue;
      // Nếu chưa self-review thì cập nhật status
      let status = review.status;
      if (status === ReviewStatus.PENDING ||
        status === ReviewStatus.SECTION_REJECTED ||
        status === ReviewStatus.DEPARTMENT_REJECTED ||
        status === ReviewStatus.MANAGER_REJECTED) {
        status = ReviewStatus.SELF_REVIEWED;
      }
      await this.kpiReviewRepository.update(
        { id: item.id, employee: { id: userId }, cycle: body.cycle },
        { selfScore: item.selfScore, selfComment: item.selfComment, status },
      );
      await this.kpiReviewHistoryRepository.save({
        kpiId: review.kpi.id,
        employeeId: review.employee.id,
        cycle: review.cycle,
        status: status,
        score: item.selfScore,
        comment: item.selfComment,
        reviewedBy: userId,
        createdAt: new Date(),
      });
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
    role?: string // Thêm tham số role để kiểm tra quyền
  ) {
    // Nếu role là admin/manager/department thì không cho phép dùng API này
    if (role && ['admin', 'manager', 'department'].includes(role)) {
      throw new Error(
        'Không được dùng API section review cho vai trò admin/manager/department. Hãy dùng đúng API duyệt theo quyền.'
      );
    }
    const review = await this.kpiReviewRepository.findOne({
      where: { id: body.reviewId },
      relations: ['kpi', 'employee'],
    });
    if (!review) throw new Error('Review not found');
    // Nếu review gắn với section, không cho phép section đó tự duyệt
    if (review.section && review.section.id) {
      // Lấy thông tin user section đang duyệt
      if (review.section.id === sectionUserId) {
        throw new Error(
          'Section không được tự duyệt review do chính section mình tạo ra. Chỉ cấp trên mới được duyệt.',
        );
      }
    }
    // Chỉ cho phép section duyệt khi status là SELF_REVIEWED
    if (review.status !== ReviewStatus.SELF_REVIEWED) {
      throw new Error('Chỉ được duyệt khi đã tự đánh giá');
    }
    if (body.sectionScore === null || body.sectionScore === undefined) {
      throw new Error('Vui lòng nhập điểm đánh giá (score) cho review.');
    }
    review.sectionScore = body.sectionScore;
    review.sectionComment = body.sectionComment;
    review.status = ReviewStatus.SECTION_REVIEWED;
    await this.kpiReviewRepository.save(review);
    await this.kpiReviewHistoryRepository.save({
      kpiId: review.kpi.id,
      employeeId: review.employee.id,
      cycle: review.cycle,
      status: review.status,
      score: body.sectionScore,
      comment: body.sectionComment,
      reviewedBy: sectionUserId,
      createdAt: new Date(),
    });
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
      relations: ['kpi', 'employee'],
    });
    if (!review) throw new Error('Review not found');
    // Cho phép department duyệt nếu status là SELF_REVIEWED, SECTION_REVIEWED, hoặc DEPARTMENT_REVIEWED (skip-level)
    if (
      ![
        ReviewStatus.SELF_REVIEWED,
        ReviewStatus.SECTION_REVIEWED,
        ReviewStatus.DEPARTMENT_REVIEWED,
      ].includes(review.status)
    ) {
      throw new Error(
        'Chỉ được duyệt khi đã qua bước tự đánh giá hoặc section hoặc department',
      );
    }
    if (body.departmentScore === null || body.departmentScore === undefined) {
      throw new Error('Vui lòng nhập điểm đánh giá (score) cho review.');
    }
    review.departmentScore = body.departmentScore;
    review.departmentComment = body.departmentComment;
    // Khi department duyệt (dù nhảy bậc hay không), luôn set status = DEPARTMENT_REVIEWED
    review.status = ReviewStatus.DEPARTMENT_REVIEWED;
    await this.kpiReviewRepository.save(review);
    await this.kpiReviewHistoryRepository.save({
      kpiId: review.kpi.id,
      employeeId: review.employee.id,
      cycle: review.cycle,
      status: review.status,
      score: body.departmentScore,
      comment: body.departmentComment,
      reviewedBy: departmentUserId,
      createdAt: new Date(),
    });
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
      relations: ['kpi', 'employee'],
    });
    if (!review) throw new Error('Review not found');
    // Cho phép manager duyệt nếu status là SELF_REVIEWED, SECTION_REVIEWED, DEPARTMENT_REVIEWED, hoặc MANAGER_REVIEWED (skip-level)
    if (
      ![
        ReviewStatus.SELF_REVIEWED,
        ReviewStatus.SECTION_REVIEWED,
        ReviewStatus.DEPARTMENT_REVIEWED,
        ReviewStatus.MANAGER_REVIEWED,
      ].includes(review.status)
    ) {
      throw new Error(
        'Chỉ được duyệt khi đã qua bước tự đánh giá, section, department hoặc manager',
      );
    }
    if (body.managerScore === null || body.managerScore === undefined) {
      throw new Error('Vui lòng nhập điểm đánh giá (score) cho review.');
    }
    review.managerScore = body.managerScore;
    review.managerComment = body.managerComment;
    // Sau khi manager duyệt, chuyển sang EMPLOYEE_FEEDBACK
    review.status = ReviewStatus.EMPLOYEE_FEEDBACK;
    await this.kpiReviewRepository.save(review);
    await this.kpiReviewHistoryRepository.save({
      kpiId: review.kpi.id,
      employeeId: review.employee.id,
      cycle: review.cycle,
      status: review.status,
      score: body.managerScore,
      comment: body.managerComment,
      reviewedBy: managerUserId,
      createdAt: new Date(),
    });
    return review;
  }

  // Nhân viên feedback
  async submitEmployeeFeedback(
    employeeId: number,
    body: { reviewId: number; employeeFeedback: string },
  ) {
    const review = await this.kpiReviewRepository.findOne({
      where: { id: body.reviewId, employee: { id: employeeId } },
      relations: ['kpi', 'employee'],
    });
    if (!review) throw new Error('Review not found');
    if (review.status !== ReviewStatus.EMPLOYEE_FEEDBACK) {
      throw new Error('Chỉ feedback khi trạng thái là EMPLOYEE_FEEDBACK');
    }
    review.employeeFeedback = body.employeeFeedback;
    review.status = ReviewStatus.MANAGER_REVIEWED; // Chờ quản lý xác nhận hoàn thành
    await this.kpiReviewRepository.save(review);
    await this.kpiReviewHistoryRepository.save({
      kpiId: review.kpi.id,
      employeeId: review.employee.id,
      cycle: review.cycle,
      status: review.status,
      score: review.managerScore ?? null,
      comment: body.employeeFeedback,
      reviewedBy: employeeId,
      createdAt: new Date(),
    });
    return review;
  }

  // Quản lý xác nhận hoàn thành
  async completeReview(reviewId: number, userId: number) {
    const review = await this.kpiReviewRepository.findOne({
      where: { id: reviewId },
      relations: ['kpi', 'employee'],
    });
    if (!review) throw new Error('Review not found');
    if (review.status !== ReviewStatus.MANAGER_REVIEWED) {
      throw new Error('Chỉ hoàn thành khi đã feedback và chờ xác nhận');
    }
    review.status = ReviewStatus.COMPLETED;
    await this.kpiReviewRepository.save(review);
    await this.kpiReviewHistoryRepository.save({
      kpiId: review.kpi.id,
      employeeId: review.employee.id,
      cycle: review.cycle,
      status: review.status,
      score: review.managerScore ?? null,
      comment: review.managerComment ?? null,
      reviewedBy: userId,
      createdAt: new Date(),
    });
    return review;
  }

  async getKpisForReview(
    filter: any,
    managerId?: number,
  ): Promise<KpiReview[]> {
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
        acc.departmentComment =
          acc.departmentComment || review.departmentComment;
        return acc;
      }, reviews[0]);

      await this.kpiReviewRepository.save(mergedReview);
      for (let i = 1; i < reviews.length; i++) {
        await this.kpiReviewRepository.delete(reviews[i].id);
      }
    }
  }

  /**
   * Hàm duyệt tổng quát theo role, tự động gọi đúng hàm duyệt nhảy bậc
   * @param userId: id người duyệt
   * @param role: vai trò (section/department/manager/admin)
   * @param body: dữ liệu review (reviewId, score, comment)
   */
  async submitReviewByRole(
    userId: number,
    role: string,
    body: {
      reviewId: number;
      score: number;
      comment: string;
    }
  ) {
    if (!role) throw new Error('Thiếu thông tin vai trò người duyệt');
    // Lấy review hiện tại để xác định trạng thái
    const review = await this.kpiReviewRepository.findOne({
      where: { id: body.reviewId },
      relations: ['kpi', 'employee', 'department', 'section'],
    });
    if (!review) throw new Error('Review not found');
    if (review.status === ReviewStatus.COMPLETED) {
      throw new Error('Review đã hoàn thành, không thể duyệt tiếp');
    }
    // Ưu tiên role cao nhất: admin > manager > department > section
    if (role === 'admin' || role === 'manager') {
      return this.submitManagerReview(userId, {
        reviewId: body.reviewId,
        managerScore: body.score,
        managerComment: body.comment,
      });
    }
    if (role === 'department') {
      return this.submitDepartmentReview(userId, {
        reviewId: body.reviewId,
        departmentScore: body.score,
        departmentComment: body.comment,
      });
    }
    if (role === 'section') {
      return this.submitSectionReview(userId, {
        reviewId: body.reviewId,
        sectionScore: body.score,
        sectionComment: body.comment,
      }, 'section');
    }
    throw new Error('Vai trò không hợp lệ để duyệt KPI');
  }

  /**
   * Reject a KPI review by role (section, department, manager, admin)
   * @param userId
   * @param role
   * @param body: { reviewId, rejectionReason }
   */
  async rejectReviewByRole(
    userId: number,
    role: string,
    body: {
      reviewId: number;
      rejectionReason: string;
    }
  ) {
    if (!role) throw new Error('Thiếu thông tin vai trò người từ chối');
    const review = await this.kpiReviewRepository.findOne({
      where: { id: body.reviewId },
      relations: ['kpi', 'employee', 'department', 'section'],
    });
    if (!review) throw new Error('Review not found');
    if (review.status === ReviewStatus.COMPLETED) {
      throw new Error('Review đã hoàn thành, không thể từ chối');
    }
    let newStatus: ReviewStatus;
    if (role === 'admin' || role === 'manager') {
      newStatus = ReviewStatus.MANAGER_REJECTED;
    } else if (role === 'department') {
      newStatus = ReviewStatus.DEPARTMENT_REJECTED;
    } else if (role === 'section') {
      newStatus = ReviewStatus.SECTION_REJECTED;
    } else {
      throw new Error('Vai trò không hợp lệ để từ chối KPI');
    }
    review.status = newStatus;
    review.rejectionReason = body.rejectionReason;
    await this.kpiReviewRepository.save(review);
    // Save review history (single object, not array)
    const history: Partial<KpiReviewHistory> = {
      kpiId: review.kpi.id,
      employeeId: review.employee.id,
      cycle: review.cycle,
      status: newStatus,
      score: undefined,
      comment: undefined,
      rejectionReason: body.rejectionReason,
      reviewedBy: userId,
      createdAt: new Date(),
    };
    await this.kpiReviewHistoryRepository.save(history);
    return review;
  }
}

function getFinalScore(review: KpiReview | null | undefined): number | null {
  if (!review) return null;
  // Ưu tiên theo workflow: COMPLETED > EMPLOYEE_FEEDBACK > MANAGER_REVIEWED > DEPARTMENT_REVIEWED > SECTION_REVIEWED > SELF_REVIEWED
  if (
    review.managerScore != null &&
    [
      ReviewStatus.MANAGER_REVIEWED,
      ReviewStatus.EMPLOYEE_FEEDBACK,
      ReviewStatus.COMPLETED,
    ].includes(review.status)
  ) {
    return review.managerScore;
  }
  if (
    review.departmentScore != null &&
    review.status === ReviewStatus.DEPARTMENT_REVIEWED
  ) {
    return review.departmentScore;
  }
  if (review.sectionScore != null && review.status === ReviewStatus.SECTION_REVIEWED) {
    return review.sectionScore;
  }
  if (review.selfScore != null && review.status === ReviewStatus.SELF_REVIEWED) {
    return review.selfScore;
  }
  return null;
}
