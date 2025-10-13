import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { KpiReview, ReviewStatus } from './entities/kpi-review.entity';
import { CreateKpiReviewDto, UpdateKpiReviewDto } from './dto/kpi-review.dto';
import { Kpi } from '../kpis/entities/kpi.entity';
import { KPIAssignment } from '../kpi-assessments/entities/kpi-assignment.entity';
import {
  KpiValue,
  KpiValueStatus,
} from '../kpi-values/entities/kpi-value.entity';
import { Employee } from '../employees/entities/employee.entity';
import { userHasPermission } from '../common/utils/permission.utils';
import { KpiReviewHistory } from '../kpi-evaluations/entities/kpi-review-history.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/entities/notification.entity';
import { EmployeesService } from '../employees/employees.service';
import { getKpiStatus } from '../kpis/kpis.service';

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
    private readonly notificationService: NotificationService,
    private readonly employeesService: EmployeesService,
  ) {}

  /**
   * Lấy danh sách KPI reviews theo filter và quyền của user
   * @param filter Điều kiện lọc
   * @param reqUser Thông tin user yêu cầu (nếu có)
   * @returns Danh sách KPI reviews
   */

  private userHasPermission(
    user: Employee,
    resource: string,
    action: string,
    scope?: string,
  ): boolean {
    return userHasPermission(user, action, resource, scope);
  }

  async getKpiReviews(filter: any, reqUser?: any): Promise<any[]> {
    if (reqUser) {
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
      if (this.userHasPermission(reqUser, 'kpi-review', 'view', 'section')) {
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
      if (this.userHasPermission(reqUser, 'kpi-review', 'view', 'department')) {
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
      if (
        this.userHasPermission(reqUser, 'kpi-review', 'view', 'manager') ||
        this.userHasPermission(reqUser, 'kpi-review', 'view', 'admin')
      ) {
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

  async getManagedEmployeeIds(managerId: number): Promise<number[]> {
    const sectionRepo =
      this.kpiReviewRepository.manager.getRepository('Section');
    const managedSections = await sectionRepo.find({ where: { managerId } });
    const sectionIds = managedSections.map((s: any) => s.id);

    const departmentRepo =
      this.kpiReviewRepository.manager.getRepository('Department');
    const managedDepartments = await departmentRepo.find({
      where: { managerId },
    });
    const departmentIds = managedDepartments.map((d: any) => d.id);

    const employeeRepo =
      this.kpiReviewRepository.manager.getRepository(Employee);
    const whereClause: any[] = [];
    if (sectionIds.length) {
      whereClause.push({ sectionId: In(sectionIds) });
    }
    if (departmentIds.length) {
      whereClause.push({ departmentId: In(departmentIds) });
    }

    whereClause.push({ managerId });

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

  async getKpiReviewHistory(kpiId: number, cycle: string, employeeId?: number) {
    const where: any = { kpiId, cycle };
    if (employeeId) where.employeeId = employeeId;

    const history = await this.kpiReviewHistoryRepository.find({
      where,
      order: { createdAt: 'ASC' },
    });

    const reviewerIds = Array.from(
      new Set(history.map((h) => h.reviewedBy).filter(Boolean)),
    );
    let reviewersMap: Record<
      number,
      { id: number; first_name: string; last_name: string }
    > = {};
    if (reviewerIds.length) {
      const employees = await this.kpiReviewRepository.manager
        .getRepository('Employee')
        .findByIds(reviewerIds);
      reviewersMap = employees.reduce((acc, emp) => {
        acc[emp.id] = emp;
        return acc;
      }, {});
    }

    return history.map((h) => ({
      ...h,
      reviewerName:
        h.reviewedBy && reviewersMap[h.reviewedBy]
          ? `${reviewersMap[h.reviewedBy].first_name} ${reviewersMap[h.reviewedBy].last_name}`
          : null,
    }));
  }

  async getMyKpisForReview(userId: number, cycle: string) {
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

      const approvedValues = (assignment.kpiValues || []).filter(
        (v) => v.status === KpiValueStatus.APPROVED,
      );
      if (!approvedValues.length) continue;
      const latestValue = approvedValues.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )[0];

      let review = await this.kpiReviewRepository.findOne({
        where: { assignment: { id: assignment.id }, cycle },
        relations: ['kpi', 'assignment'],
      });
      if (!review) {
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
      const review = await this.kpiReviewRepository.findOne({
        where: { id: item.id, employee: { id: userId }, cycle: body.cycle },
        relations: ['kpi', 'employee', 'section'],
      });
      if (!review) continue;

      let status = review.status;
      let isFirstSelfReview = false;
      if (
        status === ReviewStatus.PENDING ||
        status === ReviewStatus.SECTION_REJECTED ||
        status === ReviewStatus.DEPARTMENT_REJECTED ||
        status === ReviewStatus.MANAGER_REJECTED
      ) {
        status = ReviewStatus.SELF_REVIEWED;
        isFirstSelfReview = true;
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

      if (isFirstSelfReview && review.section && review.section.id) {
        const sectionLeader = await this.employeesService.findLeaderOfSection(
          review.section.id,
        );
        if (sectionLeader) {
          await this.notificationService.createNotification(
            sectionLeader.id,
            NotificationType.REVIEW_PENDING_SECTION_REVIEW,
            `Nhân viên ${review.employee.first_name || ''} ${review.employee.last_name || ''} đã tự đánh giá KPI "${review.kpi.name}". Chờ duyệt từ section leader!`,
            review.id,
            'KPI_REVIEW',
            review.kpi.id,
          );
        }
      }
    }

    return this.getMyKpisForReview(userId, body.cycle);
  }

  async submitSectionReview(
    sectionUserId: number,
    body: {
      reviewId: number;
      sectionScore: number;
      sectionComment: string;
    },
    user?: Employee,
  ) {
    if (
      user &&
      (this.userHasPermission(user, 'kpi-review', 'approve', 'admin') ||
        this.userHasPermission(user, 'kpi-review', 'approve', 'manager') ||
        this.userHasPermission(user, 'kpi-review', 'approve', 'department'))
    ) {
      throw new Error(
        'Không được dùng API section review cho vai trò admin/manager/department. Hãy dùng đúng API duyệt theo quyền.',
      );
    }
    const review = await this.kpiReviewRepository.findOne({
      where: { id: body.reviewId },
      relations: ['kpi', 'employee'],
    });
    if (!review) throw new Error('Review not found');

    if (review.section && review.section.id) {
      if (review.section.id === sectionUserId) {
        throw new Error(
          'Section không được tự duyệt review do chính section mình tạo ra. Chỉ cấp trên mới được duyệt.',
        );
      }
    }

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

    if (review.department && review.department.id) {
      const deptLeader = await this.employeesService.findManagerOfDepartment(
        review.department.id,
      );
      if (deptLeader) {
        await this.notificationService.createNotification(
          deptLeader.id,
          NotificationType.REVIEW_PENDING_DEPARTMENT_REVIEW,
          `Section leader đã duyệt KPI "${review.kpi.name}" của nhân viên ${review.employee.first_name || ''} ${review.employee.last_name || ''}. Chờ duyệt từ department leader!`,
          review.id,
          'KPI_REVIEW',
          review.kpi.id,
        );
      }
    }
    return review;
  }

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
      relations: ['kpi', 'employee', 'department'],
    });
    if (!review) throw new Error('Review not found');

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

    const manager = await this.employeesService.findManagerOfDepartment(
      review.department.id,
    );
    if (manager) {
      await this.notificationService.createNotification(
        manager.id,
        NotificationType.REVIEW_PENDING_MANAGER_REVIEW,
        `Department leader đã duyệt KPI "${review.kpi.name}" của nhân viên ${review.employee.first_name || ''} ${review.employee.last_name || ''}. Chờ duyệt từ manager!`,
        review.id,
        'KPI_REVIEW',
        review.kpi.id,
      );
    }
    return review;
  }

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

    await this.notificationService.createNotification(
      review.employee.id,
      NotificationType.REVIEW_PENDING_EMPLOYEE_FEEDBACK,
      `KPI "${review.kpi.name}" đã được quản lý đánh giá. Vui lòng phản hồi đánh giá này!`,
      review.id,
      'KPI_REVIEW',
      review.kpi.id,
    );
    return review;
  }

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
    review.status = ReviewStatus.MANAGER_REVIEWED;
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

    let managerId: number | null = null;
    if (review.department && review.department.id) {
      const manager = await this.employeesService.findManagerOfDepartment(
        review.department.id,
      );
      if (manager) managerId = manager.id;
    }
    if (!managerId && review.section && review.section.id) {
      const sectionLeader = await this.employeesService.findLeaderOfSection(
        review.section.id,
      );
      if (sectionLeader) managerId = sectionLeader.id;
    }
    if (managerId) {
      await this.notificationService.createNotification(
        managerId,
        NotificationType.REVIEW_EMPLOYEE_RESPONDED,
        `Nhân viên ${review.employee.first_name || ''} ${review.employee.last_name || ''} đã phản hồi đánh giá KPI "${review.kpi.name}".`,
        review.id,
        'KPI_REVIEW',
        review.kpi.id,
      );
    }
    return review;
  }

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

    await this.notificationService.createNotification(
      review.employee.id,
      NotificationType.REVIEW_COMPLETED,
      `Đánh giá KPI "${review.kpi.name}" đã hoàn tất.`,
      review.id,
      'KPI_REVIEW',
      review.kpi.id,
    );
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
    user: Employee,
    body: {
      reviewId: number;
      score: number;
      comment: string;
    },
  ) {
    if (!user) throw new Error('Thiếu thông tin người duyệt');

    const review = await this.kpiReviewRepository.findOne({
      where: { id: body.reviewId },
      relations: ['kpi', 'employee', 'department', 'section'],
    });
    if (!review) throw new Error('Review not found');
    if (review.status === ReviewStatus.COMPLETED) {
      throw new Error('Review đã hoàn thành, không thể duyệt tiếp');
    }

    // Check if KPI has expired
    const kpiValidityStatus = getKpiStatus(
      review.kpi.start_date,
      review.kpi.end_date,
    );
    if (kpiValidityStatus === 'expired') {
      throw new BadRequestException(
        'Cannot score expired KPI. This KPI is no longer valid.',
      );
    }

    if (
      this.userHasPermission(user, 'kpi-review', 'approve', 'admin') ||
      this.userHasPermission(user, 'kpi-review', 'approve', 'manager')
    ) {
      return this.submitManagerReview(userId, {
        reviewId: body.reviewId,
        managerScore: body.score,
        managerComment: body.comment,
      });
    }
    if (this.userHasPermission(user, 'kpi-review', 'approve', 'department')) {
      return this.submitDepartmentReview(userId, {
        reviewId: body.reviewId,
        departmentScore: body.score,
        departmentComment: body.comment,
      });
    }
    if (this.userHasPermission(user, 'kpi-review', 'approve', 'section')) {
      return this.submitSectionReview(
        userId,
        {
          reviewId: body.reviewId,
          sectionScore: body.score,
          sectionComment: body.comment,
        },
        user,
      );
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
    user: Employee,
    body: {
      reviewId: number;
      rejectionReason: string;
    },
  ) {
    if (!user) throw new Error('Thiếu thông tin người từ chối');
    const review = await this.kpiReviewRepository.findOne({
      where: { id: body.reviewId },
      relations: ['kpi', 'employee', 'department', 'section'],
    });
    if (!review) throw new Error('Review not found');
    if (review.status === ReviewStatus.COMPLETED) {
      throw new Error('Review đã hoàn thành, không thể từ chối');
    }

    // Check if KPI has expired
    const kpiValidityStatus = getKpiStatus(
      review.kpi.start_date,
      review.kpi.end_date,
    );
    if (kpiValidityStatus === 'expired') {
      throw new BadRequestException(
        'Cannot change scoring status for expired KPI. This KPI is no longer valid.',
      );
    }
    let newStatus: ReviewStatus;
    if (
      this.userHasPermission(user, 'kpi-review', 'approve', 'admin') ||
      this.userHasPermission(user, 'kpi-review', 'approve', 'manager')
    ) {
      newStatus = ReviewStatus.MANAGER_REJECTED;
    } else if (
      this.userHasPermission(user, 'kpi-review', 'approve', 'department')
    ) {
      newStatus = ReviewStatus.DEPARTMENT_REJECTED;
    } else if (
      this.userHasPermission(user, 'kpi-review', 'approve', 'section')
    ) {
      newStatus = ReviewStatus.SECTION_REJECTED;
    } else {
      throw new Error('Vai trò không hợp lệ để từ chối KPI');
    }
    review.status = newStatus;
    review.rejectionReason = body.rejectionReason;
    await this.kpiReviewRepository.save(review);

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

    let rejectType: NotificationType | null = null;
    if (newStatus === ReviewStatus.SECTION_REJECTED) {
      rejectType = NotificationType.REVIEW_REJECTED_BY_SECTION;
    } else if (newStatus === ReviewStatus.DEPARTMENT_REJECTED) {
      rejectType = NotificationType.REVIEW_REJECTED_BY_DEPARTMENT;
    } else if (newStatus === ReviewStatus.MANAGER_REJECTED) {
      rejectType = NotificationType.REVIEW_REJECTED_BY_MANAGER;
    }
    if (rejectType) {
      await this.notificationService.createNotification(
        review.employee.id,
        rejectType,
        `Đánh giá KPI "${review.kpi.name}" của bạn đã bị từ chối. Lý do: ${body.rejectionReason}`,
        review.id,
        'KPI_REVIEW',
        review.kpi.id,
      );
    }
    return review;
  }
}

function getFinalScore(review: KpiReview | null | undefined): number | null {
  if (!review) return null;

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
  if (
    review.sectionScore != null &&
    review.status === ReviewStatus.SECTION_REVIEWED
  ) {
    return review.sectionScore;
  }
  if (
    review.selfScore != null &&
    review.status === ReviewStatus.SELF_REVIEWED
  ) {
    return review.selfScore;
  }
  return null;
}
