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
import { ReviewCycle } from '../review-cycle/entities/review-cycle.entity';
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
    @InjectRepository(ReviewCycle)
    private readonly reviewCycleRepository: Repository<ReviewCycle>,
    private readonly notificationService: NotificationService,
    private readonly employeesService: EmployeesService,
  ) {}

  /**
   * Get list of KPI reviews by filter and user permissions
   * @param filter Filter conditions
   * @param reqUser Requesting user information (if any)
   * @returns List of KPI reviews
   */

  async getKpiReviews(filter: any, reqUser?: any): Promise<any[]> {
    if (reqUser) {
      const allowedStatuses = [
        ReviewStatus.SELF_REVIEWED,
        ReviewStatus.SECTION_REVIEWED,
        ReviewStatus.DEPARTMENT_REVIEWED,
        ReviewStatus.MANAGER_REVIEWED,
        ReviewStatus.EMPLOYEE_FEEDBACK,
        ReviewStatus.PENDING_MANAGER_APPROVAL,
        ReviewStatus.COMPLETED,
        ReviewStatus.SECTION_REJECTED,
        ReviewStatus.DEPARTMENT_REJECTED,
        ReviewStatus.MANAGER_REJECTED,
      ];
      // Check permissions in order of hierarchy (highest first)
      if (userHasPermission(reqUser, 'view', 'kpi-review', 'manager')) {
        // Manager/Admin can see all reviews
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

      if (userHasPermission(reqUser, 'view', 'kpi-review', 'department')) {
        // Department can see reviews from their department
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

      if (userHasPermission(reqUser, 'view', 'kpi-review', 'section')) {
        // Section can see reviews from their section
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
          ReviewStatus.PENDING_MANAGER_APPROVAL,
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
    // Convert cycle to ID and get review cycle info
    const cycleId = parseInt(cycle);
    if (isNaN(cycleId)) {
      throw new BadRequestException(
        'Invalid cycle format. Expected cycle ID (e.g., 1, 2)',
      );
    }

    // Get review cycle details to check date range
    const reviewCycle = await this.reviewCycleRepository.findOne({
      where: { id: cycleId },
    });

    if (!reviewCycle) {
      throw new BadRequestException(
        `Review cycle with ID ${cycleId} not found`,
      );
    }

    // First, get all existing reviews for this cycle and user
    const existingReviews = await this.kpiReviewRepository.find({
      where: {
        employee: { id: userId },
        cycle: cycle,
      },
      relations: [
        'kpi',
        'kpi.perspective',
        'kpi.formula',
        'assignment',
        'employee',
      ],
    });

    // Filter existing reviews by KPI date range overlap with review cycle
    const validExistingReviews = existingReviews.filter((review) => {
      if (!review.kpi) {
        return false;
      }

      const kpiStartDate = new Date(review.kpi.start_date);
      const kpiEndDate = new Date(review.kpi.end_date);
      const cycleStartDate = new Date(reviewCycle.startDate);
      const cycleEndDate = new Date(reviewCycle.endDate);

      // Check if KPI date range overlaps with review cycle date range
      const isValid =
        kpiStartDate <= cycleEndDate && kpiEndDate >= cycleStartDate;
      return isValid;
    });

    // If we have valid existing reviews, return them
    if (validExistingReviews.length > 0) {
      return validExistingReviews;
    }

    // If no existing reviews for this cycle, get assignments and create reviews
    const assignments = await this.kpiAssignmentRepository.find({
      where: {
        assigned_to_employee: userId,
        status: 'APPROVED',
        deleted_at: IsNull(),
      },
      relations: [
        'kpi',
        'kpiValues',
        'employee',
        'kpi.perspective',
        'kpi.formula',
      ],
    });

    const result: KpiReview[] = [];
    for (const assignment of assignments) {
      if (!assignment.kpi) {
        continue;
      }

      // Check if KPI date range overlaps with review cycle date range
      const kpiStartDate = new Date(assignment.kpi.start_date);
      const kpiEndDate = new Date(assignment.kpi.end_date);
      const cycleStartDate = new Date(reviewCycle.startDate);
      const cycleEndDate = new Date(reviewCycle.endDate);

      // Check if KPI date range overlaps with review cycle date range
      const hasOverlap =
        kpiStartDate <= cycleEndDate && kpiEndDate >= cycleStartDate;

      if (!hasOverlap) {
        continue;
      }

      const approvedValues = (assignment.kpiValues || []).filter(
        (v) => v.status === KpiValueStatus.APPROVED,
      );

      if (!approvedValues.length) {
        continue;
      }

      const latestValue = approvedValues.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )[0];

      // Create new review with full KPI data
      const reviewData: any = {
        kpi: assignment.kpi, // Full KPI object instead of just ID
        assignment: assignment, // Full assignment object instead of just ID
        employee: assignment.employee, // Full employee object
        cycle: cycle,
        targetValue: Number(assignment.targetValue) ?? 0,
        actualValue: Number(latestValue.value) ?? 0,
        status: ReviewStatus.PENDING,
      };

      const newReviewArr = this.kpiReviewRepository.create([reviewData]);
      const newReview = newReviewArr[0];
      const savedReviewArr = await this.kpiReviewRepository.save([newReview]);

      // Load the saved review with full relations
      const savedReview = await this.kpiReviewRepository.findOne({
        where: { id: savedReviewArr[0].id },
        relations: [
          'kpi',
          'kpi.perspective',
          'kpi.formula',
          'assignment',
          'employee',
        ],
      });

      if (savedReview) {
        result.push(savedReview);
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
      if (status === ReviewStatus.PENDING) {
        status = ReviewStatus.SELF_REVIEWED;
        isFirstSelfReview = true;
      } else if (
        status === ReviewStatus.SECTION_REJECTED ||
        status === ReviewStatus.DEPARTMENT_REJECTED ||
        status === ReviewStatus.MANAGER_REJECTED
      ) {
        status = ReviewStatus.SELF_REVIEWED;
        isFirstSelfReview = false; // This is a resubmission, not first review
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
        // First time submission
        const sectionLeader = await this.employeesService.findLeaderOfSection(
          review.section.id,
        );
        if (sectionLeader) {
          await this.notificationService.createNotification(
            sectionLeader.id,
            NotificationType.REVIEW_PENDING_SECTION_REVIEW,
            `Employee ${review.employee.first_name || ''} ${review.employee.last_name || ''} has self-reviewed KPI "${review.kpi.name}". Waiting for section leader approval!`,
            review.id,
            'KPI_REVIEW',
            review.kpi.id,
          );
        }
      } else if (!isFirstSelfReview && review.section && review.section.id) {
        // Resubmission after rejection
        const sectionLeader = await this.employeesService.findLeaderOfSection(
          review.section.id,
        );
        if (sectionLeader) {
          await this.notificationService.createNotification(
            sectionLeader.id,
            NotificationType.REVIEW_PENDING_SECTION_REVIEW,
            `Employee ${review.employee.first_name || ''} ${review.employee.last_name || ''} has re-reviewed KPI "${review.kpi.name}" after rejection. Please review again!`,
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
      score: number;
      comment?: string;
    },
    user?: Employee,
  ) {
    const review = await this.kpiReviewRepository.findOne({
      where: { id: body.reviewId },
      relations: ['kpi', 'employee'],
    });
    if (!review) throw new Error('Review not found');

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

    // Allow section review from SELF_REVIEWED status
    // Also allow re-review if status is SELF_REVIEWED (even if sectionScore exists)
    if (review.status !== ReviewStatus.SELF_REVIEWED) {
      throw new Error('Section can only review from SELF_REVIEWED status');
    }
    // Allow updating section score even if it already exists (for resubmission cases)

    // Check if user has section approval permission
    if (!user || !userHasPermission(user, 'approve', 'kpi-review', 'section')) {
      throw new Error('You do not have permission to review as section');
    }

    if (body.score === null || body.score === undefined) {
      throw new Error('Please provide a review score.');
    }

    review.sectionScore = body.score;
    review.sectionComment = body.comment || '';
    review.status = ReviewStatus.SECTION_REVIEWED;
    review.reviewedBy = user;
    await this.kpiReviewRepository.save(review);
    await this.kpiReviewHistoryRepository.save({
      kpiId: review.kpi.id,
      employeeId: review.employee.id,
      cycle: review.cycle,
      status: review.status,
      score: body.score,
      comment: body.comment,
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
          `Section leader has approved KPI "${review.kpi.name}" for employee ${review.employee.first_name || ''} ${review.employee.last_name || ''}. Waiting for department leader approval!`,
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
      score: number;
      comment?: string;
    },
    user?: Employee,
  ) {
    const review = await this.kpiReviewRepository.findOne({
      where: { id: body.reviewId },
      relations: ['kpi', 'employee', 'department'],
    });
    if (!review) throw new Error('Review not found');

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

    // Allow department review from SELF_REVIEWED or SECTION_REVIEWED status
    if (
      ![ReviewStatus.SELF_REVIEWED, ReviewStatus.SECTION_REVIEWED].includes(
        review.status,
      )
    ) {
      throw new Error(
        'Department can only review from SELF_REVIEWED or SECTION_REVIEWED status',
      );
    }

    // Check if user has department approval permission
    if (
      !user ||
      !userHasPermission(user, 'approve', 'kpi-review', 'department')
    ) {
      throw new Error('You do not have permission to review as department');
    }

    if (body.score === null || body.score === undefined) {
      throw new Error('Please provide a review score.');
    }

    review.departmentScore = body.score;
    review.departmentComment = body.comment || '';
    review.status = ReviewStatus.DEPARTMENT_REVIEWED;
    review.reviewedBy = user;
    await this.kpiReviewRepository.save(review);
    await this.kpiReviewHistoryRepository.save({
      kpiId: review.kpi.id,
      employeeId: review.employee.id,
      cycle: review.cycle,
      status: review.status,
      score: body.score,
      comment: body.comment,
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
        `Department leader has approved KPI "${review.kpi.name}" for employee ${review.employee.first_name || ''} ${review.employee.last_name || ''}. Waiting for manager approval!`,
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
      score: number;
      comment?: string;
    },
    user?: Employee,
  ) {
    const review = await this.kpiReviewRepository.findOne({
      where: { id: body.reviewId },
      relations: ['kpi', 'employee'],
    });
    if (!review) throw new Error('Review not found');

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

    // Allow manager review from any status (except already completed)
    if (
      ![
        ReviewStatus.SELF_REVIEWED,
        ReviewStatus.SECTION_REVIEWED,
        ReviewStatus.DEPARTMENT_REVIEWED,
      ].includes(review.status)
    ) {
      throw new Error(
        'Manager can only review from SELF_REVIEWED, SECTION_REVIEWED, or DEPARTMENT_REVIEWED status',
      );
    }

    // Check if user has manager approval permission
    if (!user || !userHasPermission(user, 'approve', 'kpi-review', 'manager')) {
      throw new Error('You do not have permission to review as manager');
    }

    if (body.score === null || body.score === undefined) {
      throw new Error('Please provide a review score.');
    }

    review.managerScore = body.score;
    review.managerComment = body.comment || '';
    review.status = ReviewStatus.EMPLOYEE_FEEDBACK;
    review.reviewedBy = user;
    await this.kpiReviewRepository.save(review);
    await this.kpiReviewHistoryRepository.save({
      kpiId: review.kpi.id,
      employeeId: review.employee.id,
      cycle: review.cycle,
      status: review.status,
      score: body.score,
      comment: body.comment,
      reviewedBy: managerUserId,
      createdAt: new Date(),
    });

    await this.notificationService.createNotification(
      review.employee.id,
      NotificationType.REVIEW_PENDING_EMPLOYEE_FEEDBACK,
      `KPI "${review.kpi.name}" has been manager reviewed. Please provide your feedback on this review!`,
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
      throw new Error(
        'Feedback is only allowed when status is EMPLOYEE_FEEDBACK',
      );
    }
    review.employeeFeedback = body.employeeFeedback;
    review.status = ReviewStatus.PENDING_MANAGER_APPROVAL;
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
        `Employee ${review.employee.first_name || ''} ${review.employee.last_name || ''} has provided feedback on KPI review "${review.kpi.name}".`,
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
    if (review.status !== ReviewStatus.PENDING_MANAGER_APPROVAL) {
      throw new Error(
        'Can only complete when feedback is provided and waiting for confirmation',
      );
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
      `KPI review "${review.kpi.name}" has been completed.`,
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
    if (!user) throw new Error('Missing reviewer information');

    const review = await this.kpiReviewRepository.findOne({
      where: { id: body.reviewId },
      relations: ['kpi', 'employee', 'department', 'section'],
    });
    if (!review) throw new Error('Review not found');
    if (review.status === ReviewStatus.COMPLETED) {
      throw new Error('Review is already completed, cannot approve further');
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
      userHasPermission(user, 'approve', 'kpi-review', 'admin') ||
      userHasPermission(user, 'approve', 'kpi-review', 'manager')
    ) {
      return this.submitManagerReview(
        userId,
        {
          reviewId: body.reviewId,
          score: body.score,
          comment: body.comment,
        },
        user,
      );
    }
    if (userHasPermission(user, 'approve', 'kpi-review', 'department')) {
      return this.submitDepartmentReview(
        userId,
        {
          reviewId: body.reviewId,
          score: body.score,
          comment: body.comment,
        },
        user,
      );
    }
    if (userHasPermission(user, 'approve', 'kpi-review', 'section')) {
      return this.submitSectionReview(
        userId,
        {
          reviewId: body.reviewId,
          score: body.score,
          comment: body.comment,
        },
        user,
      );
    }
    throw new Error('Invalid role for KPI approval');
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
    if (!user)
      throw new Error('Missing information about the person rejecting');
    const review = await this.kpiReviewRepository.findOne({
      where: { id: body.reviewId },
      relations: ['kpi', 'employee', 'department', 'section'],
    });
    if (!review) throw new Error('Review not found');
    if (review.status === ReviewStatus.COMPLETED) {
      throw new Error('Review is already completed, cannot reject');
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
    if (userHasPermission(user, 'approve', 'kpi-review', 'manager')) {
      newStatus = ReviewStatus.MANAGER_REJECTED;
    } else if (userHasPermission(user, 'approve', 'kpi-review', 'department')) {
      newStatus = ReviewStatus.DEPARTMENT_REJECTED;
    } else if (userHasPermission(user, 'approve', 'kpi-review', 'section')) {
      newStatus = ReviewStatus.SECTION_REJECTED;
    } else {
      throw new Error('Invalid role for KPI rejection');
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
        `Your KPI review "${review.kpi.name}" has been rejected. Reason: ${body.rejectionReason}`,
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
