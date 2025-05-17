import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
  Brackets,
  EntityManager,
  In,
  Not,
} from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Employee } from '../entities/employee.entity';
import { Section } from '../entities/section.entity';
import { Department } from '../entities/department.entity';
import { KPIAssignment } from '../entities/kpi-assignment.entity';
import { KpiValue } from '../entities/kpi-value.entity';
import { KpiReview } from '../entities/kpi-review.entity';
import { OverallReview } from '../entities/overall-review.entity';
import {
  ReviewableTargetDto,
  ReviewCycleDto,
  KpiToReviewDto,
  SubmitKpiReviewDto,
  ExistingOverallReviewDto,
  CompleteReviewDto,
  EmployeeReviewResponseDto,
  SubmitEmployeeFeedbackDto,
  KpisForReviewResponseDto,
  ReviewHistoryResponseDto,
  PerformanceObjectiveItemDto,
  EmployeeKpiScoreDto,
  ObjectiveEvaluationHistoryItemDto,
  SubmitSelfKpiReviewDto,
} from './dto/evaluation.dto';
import { SavePerformanceObjectivesDto } from './dto/save-performance-objectives.dto';
import { OverallReviewStatus } from '../entities/objective-evaluation-status.enum';
import { KpiValueStatus } from '../entities/kpi-value.entity';
// Removed ObjectiveEvaluationStatus and related imports as objective evaluation is deprecated.


@Injectable()
export class EvaluationService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(Section)
    private readonly sectionRepository: Repository<Section>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(KPIAssignment)
    private readonly assignmentRepository: Repository<KPIAssignment>,
    @InjectRepository(KpiValue)
    private readonly kpiValueRepository: Repository<KpiValue>,
    @InjectRepository(KpiReview)
    private readonly kpiReviewRepository: Repository<KpiReview>,
    @InjectRepository(OverallReview)
    private readonly overallReviewRepository: Repository<OverallReview>,
    // Removed ObjectiveEvaluation and ObjectiveEvaluationHistory repositories
    private readonly entityManager: EntityManager,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Helper: Luôn lấy bản ghi OverallReview mới nhất cho 1 employee/cycle
   */
  private async findLatestOverallReview(
    targetId: number,
    targetType: string,
    cycleId: string
  ): Promise<OverallReview | null> {
    return this.overallReviewRepository.findOne({
      where: {
        targetId,
        targetType: targetType as 'employee' | 'section' | 'department',
        cycleId,
      },
      order: { updatedAt: 'DESC' },
    });
  }

  async getReviewableTargets(
    currentUser: Employee,
  ): Promise<ReviewableTargetDto[]> {
    const reviewableTargets: ReviewableTargetDto[] = [];

    // Cho phép bất kỳ ai cũng có thể review KPI của chính mình
    reviewableTargets.push({
      id: currentUser.id,
      name: `${currentUser.first_name} ${currentUser.last_name}`.trim(),
      type: 'employee',
    });

    if (currentUser.role === 'admin') {
      const employees = await this.employeeRepository.find({
        order: { first_name: 'ASC', last_name: 'ASC' },
      });
      const sections = await this.sectionRepository.find({
        order: { name: 'ASC' },
      });
      const departments = await this.departmentRepository.find({
        order: { name: 'ASC' },
      });

      employees.forEach((e) =>
        reviewableTargets.push({
          id: e.id,
          name: `${e.first_name} ${e.last_name}`,
          type: 'employee',
        }),
      );
      sections.forEach((s) =>
        reviewableTargets.push({ id: s.id, name: s.name, type: 'section' }),
      );
      departments.forEach((d) =>
        reviewableTargets.push({ id: d.id, name: d.name, type: 'department' }),
      );
    } else if (currentUser.role === 'manager') {
      if (currentUser.departmentId) {
        const managedDepartment = await this.departmentRepository.findOne({
          where: { id: currentUser.departmentId },
        });
        if (managedDepartment) {
          reviewableTargets.push({
            id: managedDepartment.id,
            name: managedDepartment.name,
            type: 'department',
          });
        }
        const employeesInDept = await this.employeeRepository.find({
          where: { departmentId: currentUser.departmentId },
          order: { first_name: 'ASC', last_name: 'ASC' },
        });
        employeesInDept.forEach((e) => {
          if (e.id !== currentUser.id) {
            reviewableTargets.push({
              id: e.id,
              name: `${e.first_name} ${e.last_name} `,
              type: 'employee',
            });
          }
        });
        const sectionsInDept = await this.sectionRepository.find({
          where: { department: { id: currentUser.departmentId } },
          order: { name: 'ASC' },
        });
        sectionsInDept.forEach((s) =>
          reviewableTargets.push({ id: s.id, name: s.name, type: 'section' }),
        );
      }
    } else if (currentUser.role === 'department') {
      if (currentUser.departmentId) {
        const ownDepartment = await this.departmentRepository.findOne({
          where: { id: currentUser.departmentId },
        });
        if (ownDepartment) {
          reviewableTargets.push({
            id: ownDepartment.id,
            name: ownDepartment.name,
            type: 'department',
          });
        }
        const employeesInDept = await this.employeeRepository.find({
          where: { departmentId: currentUser.departmentId },
          order: { first_name: 'ASC', last_name: 'ASC' },
        });
        employeesInDept.forEach((e) => {
          if (e.id !== currentUser.id) {
            reviewableTargets.push({
              id: e.id,
              name: `${e.first_name} ${e.last_name} `,
              type: 'employee',
            });
          }
        });
        const sectionsInDept = await this.sectionRepository.find({
          where: { department: { id: currentUser.departmentId } },
          order: { name: 'ASC' },
        });
        sectionsInDept.forEach((s) =>
          reviewableTargets.push({ id: s.id, name: s.name, type: 'section' }),
        );
      }
    } else if (currentUser.role === 'section') {
      if (currentUser.sectionId) {
        const ownSection = await this.sectionRepository.findOne({
          where: { id: currentUser.sectionId },
        });
        if (ownSection) {
          reviewableTargets.push({
            id: ownSection.id,
            name: ownSection.name,
            type: 'section',
          });
        }
        const employeesInSection = await this.employeeRepository.find({
          where: { sectionId: currentUser.sectionId },
          order: { first_name: 'ASC', last_name: 'ASC' },
        });
        employeesInSection.forEach((e) => {
          if (e.id !== currentUser.id) {
            reviewableTargets.push({
              id: e.id,
              name: `${e.first_name} ${e.last_name} `,
              type: 'employee',
            });
          }
        });
      }
    }
    return reviewableTargets;
  }

  async getReviewCycles(currentUser: Employee): Promise<ReviewCycleDto[]> {
    const cycles: ReviewCycleDto[] = [];
    const today = new Date();
    const currentYear = today.getFullYear();

    // Chỉ trả về các năm hiện tại và 2 năm trước đó
    for (let i = 0; i < 3; i++) {
      const year = currentYear - i;
      cycles.push({
        id: `${year}-Year`,
        name: `Năm ${year}`,
      });
    }

    return cycles;
  }

  async getKpisForReview(
    currentUser: Employee,
    targetId: number,
    targetType: 'employee' | 'section' | 'department',
    cycleId: string,
  ): Promise<KpisForReviewResponseDto> {
    // Nếu là tự review bản thân thì luôn cho phép (KHÔNG kiểm tra role/quyền)
    let assignments: KPIAssignment[] = [];

    const { startDate, endDate } = this.getDateRangeFromCycleId(cycleId);
    if (!startDate || !endDate) {
      return { kpisToReview: [], existingOverallReview: null };
    }

    if (targetType === 'employee') {
      assignments = await this.assignmentRepository.find({
        where: {
          assigned_to_employee: targetId,
          startDate: LessThanOrEqual(endDate),
          endDate: MoreThanOrEqual(startDate),
        },
        relations: [
          'kpi',
          'employee',
          'kpiValues',
          'reviews',
          'reviews.reviewedBy',
        ],
      });
    } else if (targetType === 'section') {
      assignments = await this.assignmentRepository.find({
        where: {
          assigned_to_section: targetId,
          startDate: LessThanOrEqual(endDate),
          endDate: MoreThanOrEqual(startDate),
        },
        relations: [
          'kpi',
          'section',
          'kpiValues',
          'reviews',
          'reviews.reviewedBy',
        ],
      });
    } else if (targetType === 'department') {
      assignments = await this.assignmentRepository.find({
        where: {
          assigned_to_department: targetId,
          startDate: LessThanOrEqual(endDate),
          endDate: MoreThanOrEqual(startDate),
        },
        relations: [
          'kpi',
          'department',
          'kpiValues',
          'reviews',
          'reviews.reviewedBy',
        ],
      });
    }

    const kpisToReview: KpiToReviewDto[] = [];

    for (const assignment of assignments) {
      if (!assignment.kpi) continue;

      let relevantKpiValue: KpiValue | undefined = undefined;
      if (assignment.kpiValues && assignment.kpiValues.length > 0) {
        const approvedInCycle = assignment.kpiValues.filter(
          (kv) =>
            kv.status === KpiValueStatus.APPROVED &&
            kv.timestamp >= startDate &&
            kv.timestamp <= endDate,
        );
        let filteredKpiValues =
          approvedInCycle.length > 0
            ? approvedInCycle
            : assignment.kpiValues.filter(
                (kv) => kv.status === KpiValueStatus.APPROVED,
              );
        relevantKpiValue = filteredKpiValues.sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
        )[0];
      }
      const actualValue = relevantKpiValue ? relevantKpiValue.value : null;

      const existingReview = assignment.reviews?.find(
        (review) =>
          review.reviewedBy?.id === currentUser.id &&
          review.cycleId === cycleId,
      );

      // Luôn tìm self review của nhân viên được giao KPI này (không phụ thuộc currentUser hay targetType)
      let selfScoreInner: number | null = null;
      let selfCommentInner: string | null = null;
      const assignedEmployeeId = assignment.assigned_to_employee;
      if (assignedEmployeeId) {
        const selfReview = assignment.reviews?.find(
          (review) =>
            review.reviewedBy?.id === assignedEmployeeId &&
            review.cycleId === cycleId,
        );

        selfScoreInner = selfReview?.selfScore ?? null;
        selfCommentInner = selfReview?.selfComment ?? null;
      }

      kpisToReview.push({
        assignmentId: assignment.id,
        kpiId: assignment.kpi.id,
        kpiName: assignment.kpi.name,
        kpiDescription: assignment.kpi.description,
        targetValue: assignment.targetValue,
        actualValue: actualValue,
        unit: assignment.kpi.unit,
        weight: assignment.weight,
        existingManagerComment: existingReview
          ? existingReview.managerComment
          : null,
        existingManagerScore: existingReview
          ? existingReview.managerScore
          : null,
        selfScore: selfScoreInner,
        selfComment: selfCommentInner,
      });
    }

    console.log('kpisToReview 1 final', kpisToReview);

    // Sau khi tạo kpisToReview xong, nếu là tự xem KPI của mình thì bổ sung selfScore/selfComment
    if (
      targetType === 'employee' &&
      targetId === currentUser.id &&
      kpisToReview.length > 0
    ) {
      const assignmentIds = kpisToReview.map((k) => k.assignmentId);
      const selfReviews = await this.kpiReviewRepository.find({
        where: {
          assignment: { id: In(assignmentIds) },
          reviewedBy: { id: currentUser.id },
          cycleId: cycleId,
        },
      });
      const selfReviewMap = new Map<
        number,
        { selfScore: number | null; selfComment: string | null }
      >();
      selfReviews.forEach((r) => {
        if (r.assignment && typeof r.assignment.id === 'number') {
          selfReviewMap.set(r.assignment.id, {
            selfScore: r.selfScore,
            selfComment: r.selfComment,
          });
        }
      });
      for (const kpi of kpisToReview) {
        // Chỉ ghi đè selfScore/selfComment nếu selfReviewMap có dữ liệu thực sự (không phải undefined/null)
        const selfReview = selfReviewMap.get(kpi.assignmentId);
        if (selfReview) {
          if (
            selfReview.selfScore !== undefined &&
            selfReview.selfScore !== null
          ) {
            kpi.selfScore = selfReview.selfScore;
          }
          if (
            selfReview.selfComment !== undefined &&
            selfReview.selfComment !== null
          ) {
            kpi.selfComment = selfReview.selfComment;
          }
        }
        // Nếu không có selfReviewMap thì giữ nguyên giá trị đã lấy từ assignment.reviews
      }
    }

    console.log('kpisToReview 2 final', kpisToReview);

    let totalWeightedScoreSupervisor = 0;
    if (kpisToReview && Array.isArray(kpisToReview)) {
      for (const kpi of kpisToReview) {
        const score = Number(kpi.existingManagerScore);
        const weight =
          kpi.weight !== null && kpi.weight !== undefined
            ? Number(kpi.weight)
            : 1;

        if (!isNaN(score) && !isNaN(weight)) {
          totalWeightedScoreSupervisor += score * weight;
        }
      }
    }

    let existingOverallReviewData: ExistingOverallReviewDto | null = null;
    const overallReviewRecord = await this.overallReviewRepository.findOne({
      where: {
        targetId: targetId,
        targetType: targetType,
        cycleId: cycleId,
        reviewedById: currentUser.id, // Ensure reviewer-specific record
      },
    });

    if (overallReviewRecord) {
      existingOverallReviewData = {
        overallComment: overallReviewRecord.overallComment,
        status: overallReviewRecord.status,
        employeeComment: overallReviewRecord.employeeComment,
        employeeFeedbackDate: overallReviewRecord.employeeFeedbackDate,
        totalWeightedScoreSupervisor,
      };
    } else {
      // Nếu chưa có overallReviewRecord, trả về status PENDING_REVIEW
      existingOverallReviewData = {
        overallComment: null,
        status: OverallReviewStatus.PENDING_REVIEW,
        employeeComment: null,
        employeeFeedbackDate: null,
        totalWeightedScoreSupervisor,
      };
    }

    console.log('kpisToReview 3 final', kpisToReview);

    return {
      kpisToReview: kpisToReview,
      existingOverallReview: existingOverallReviewData,
    };
  }

  private getDateRangeFromCycleId(cycleId: string): {
    startDate: Date | null;
    endDate: Date | null;
  } {
    if (cycleId.includes('-Year')) {
      const year = parseInt(cycleId.split('-')[0]);
      if (isNaN(year)) return { startDate: null, endDate: null };
      return {
        startDate: new Date(year, 0, 1),
        endDate: new Date(year, 11, 31, 23, 59, 59, 999),
      };
    } else if (cycleId.includes('-Q')) {
      const parts = cycleId.split('-Q');
      if (parts.length !== 2) return { startDate: null, endDate: null };
      const year = parseInt(parts[0]);
      const quarter = parseInt(parts[1]);

      if (isNaN(year) || isNaN(quarter) || quarter < 1 || quarter > 4) {
        return { startDate: null, endDate: null };
      }

      const startMonth = (quarter - 1) * 3;
      const endMonth = startMonth + 2;

      const sDate = new Date(year, startMonth, 1);

      const eDate = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);

      return { startDate: sDate, endDate: eDate };
    }
    return { startDate: null, endDate: null };
  }

  async submitKpiReview(
    currentUser: Employee,
    reviewData: SubmitKpiReviewDto,
  ): Promise<KpisForReviewResponseDto> {
    const reviewableTargets = await this.getReviewableTargets(currentUser);
    const canReviewThisTarget = reviewableTargets.some(
      (rt) =>
        rt.id === reviewData.targetId && rt.type === reviewData.targetType,
    );

    if (!canReviewThisTarget) {
      throw new UnauthorizedException(
        'You do not have permission to review this target.',
      );
    }

    const { startDate, endDate } = this.getDateRangeFromCycleId(
      reviewData.cycleId,
    );
    if (!startDate || !endDate) {
      throw new BadRequestException('Invalid review cycle for validation.');
    }

    let validAssignmentsForTarget: Pick<KPIAssignment, 'id'>[] = [];
    const commonAssignmentQueryOptions = {
      select: ['id'] as (keyof KPIAssignment)[],
      where: {
        startDate: LessThanOrEqual(endDate),
        endDate: MoreThanOrEqual(startDate),
      },
    };

    if (reviewData.targetType === 'employee') {
      validAssignmentsForTarget = await this.assignmentRepository.find({
        ...commonAssignmentQueryOptions,
        where: {
          ...commonAssignmentQueryOptions.where,
          assigned_to_employee: reviewData.targetId,
        },
      });
    } else if (reviewData.targetType === 'section') {
      validAssignmentsForTarget = await this.assignmentRepository.find({
        ...commonAssignmentQueryOptions,
        where: {
          ...commonAssignmentQueryOptions.where,
          assigned_to_section: reviewData.targetId,
        },
      });
    } else if (reviewData.targetType === 'department') {
      validAssignmentsForTarget = await this.assignmentRepository.find({
        ...commonAssignmentQueryOptions,
        where: {
          ...commonAssignmentQueryOptions.where,
          assigned_to_department: reviewData.targetId,
        },
      });
    }

    const validAssignmentIds = new Set(
      validAssignmentsForTarget.map((a) => a.id),
    );

    let savedOverallReview: OverallReview | null = null;
    await this.kpiReviewRepository.manager.transaction(
      async (transactionalEntityManager: EntityManager) => {
        for (const kpiReviewItem of reviewData.kpiReviews) {
          if (
            kpiReviewItem.assignmentId === null ||
            kpiReviewItem.assignmentId === undefined
          ) {
            continue;
          }

          if (!validAssignmentIds.has(kpiReviewItem.assignmentId)) {
            continue;
          }

          let reviewRecord = await transactionalEntityManager.findOne(
            KpiReview,
            {
              where: {
                assignment: { id: kpiReviewItem.assignmentId },
                reviewedBy: { id: currentUser.id },
                cycleId: reviewData.cycleId,
              },
            },
          );

          if (reviewRecord) {
            reviewRecord.managerComment = kpiReviewItem.managerComment ?? null;
            reviewRecord.managerScore = kpiReviewItem.managerScore ?? null;
          } else {
            reviewRecord = transactionalEntityManager.create(KpiReview, {
              assignment: { id: kpiReviewItem.assignmentId },
              reviewedBy: { id: currentUser.id },
              cycleId: reviewData.cycleId,
              managerComment: kpiReviewItem.managerComment ?? null,
              managerScore: kpiReviewItem.managerScore ?? null,
            });
          }
          await transactionalEntityManager.save(KpiReview, reviewRecord);
        }

        if (reviewData.overallComment !== undefined) {
          let totalWeightedScore = 0;
          const assignments = await transactionalEntityManager.find(
            KPIAssignment,
            {
              where: {
                assigned_to_employee: reviewData.targetId,
                startDate: LessThanOrEqual(startDate),
                endDate: MoreThanOrEqual(endDate),
              },
              relations: ['reviews'],
            },
          );
          for (const assignment of assignments) {
            const review = assignment.reviews?.find(
              (r) =>
                r.cycleId === reviewData.cycleId &&
                r.managerScore !== null &&
                r.managerScore !== undefined,
            );
            const score = Number(review ? review.managerScore : NaN);
            const weight = Number(assignment.weight);
            if (!isNaN(score) && !isNaN(weight)) {
              totalWeightedScore += score * weight;
            }
          }
          let overallReviewRecord = await transactionalEntityManager.findOne(
            OverallReview,
            {
              where: {
                targetId: reviewData.targetId,
                targetType: reviewData.targetType,
                cycleId: reviewData.cycleId,
                reviewedById: currentUser.id,
              },
            },
          );

          if (overallReviewRecord) {
            overallReviewRecord.overallComment =
              reviewData.overallComment ?? null;
            overallReviewRecord.status =
              OverallReviewStatus.EMPLOYEE_FEEDBACK_PENDING;
            overallReviewRecord.totalWeightedScore =
              totalWeightedScore !== null
                ? totalWeightedScore.toFixed(2)
                : null;
          } else {
            overallReviewRecord = transactionalEntityManager.create(
              OverallReview,
              {
                targetId: reviewData.targetId,
                targetType: reviewData.targetType,
                cycleId: reviewData.cycleId,
                reviewedById: currentUser.id,
                overallComment: reviewData.overallComment ?? null,
                status: OverallReviewStatus.EMPLOYEE_FEEDBACK_PENDING,
                totalWeightedScore:
                  totalWeightedScore !== null
                    ? totalWeightedScore.toFixed(2)
                    : null,
              },
            );
          }
          savedOverallReview = await transactionalEntityManager.save(
            OverallReview,
            overallReviewRecord,
          );
        }
      },
    );

    if (savedOverallReview) {
      const confirmedReview: OverallReview = savedOverallReview;

      if (
        confirmedReview.status === OverallReviewStatus.EMPLOYEE_FEEDBACK_PENDING
      ) {
        this.eventEmitter.emit('overall_review.employee_feedback_pending', {
          overallReview: confirmedReview,
          manager: currentUser,
          targetId: reviewData.targetId,
          targetType: reviewData.targetType,
        });
      }
    }

    return this.getKpisForReview(
      currentUser,
      reviewData.targetId,
      reviewData.targetType,
      reviewData.cycleId,
    );
  }

  async submitSelfKpiReview(
    currentUser: Employee,
    dto: SubmitSelfKpiReviewDto,
  ): Promise<EmployeeReviewResponseDto> {
    // Lấy các assignment hợp lệ cho user trong cycle
    const { startDate, endDate } = this.getDateRangeFromCycleId(dto.cycleId);
    if (!startDate || !endDate) {
      throw new BadRequestException('Invalid review cycle.');
    }
    const assignments = await this.assignmentRepository.find({
      where: {
        assigned_to_employee: currentUser.id,
        startDate: LessThanOrEqual(endDate),
        endDate: MoreThanOrEqual(startDate),
      },
      relations: ['reviews'],
    });
    const validAssignmentIds = new Set(assignments.map((a) => a.id));
    await this.kpiReviewRepository.manager.transaction(async (em) => {
      for (const item of dto.kpiReviews) {
        if (!validAssignmentIds.has(item.assignmentId)) continue;
        let review = await em.findOne(KpiReview, {
          where: {
            assignment: { id: item.assignmentId },
            reviewedBy: { id: currentUser.id },
            cycleId: dto.cycleId,
          },
        });
        if (review) {
          review.selfScore = item.selfScore;
          review.selfComment = item.selfComment;
        } else {
          review = em.create(KpiReview, {
            assignment: { id: item.assignmentId },
            reviewedBy: { id: currentUser.id },
            cycleId: dto.cycleId,
            selfScore: item.selfScore,
            selfComment: item.selfComment,
          });
        }
        await em.save(KpiReview, review);
      }
      // Bổ sung: Đảm bảo có OverallReview với status DRAFT khi khởi tạo lần đầu
      let overallReview = await em.findOne(OverallReview, {
        where: {
          targetId: currentUser.id,
          targetType: 'employee',
          cycleId: dto.cycleId,
        },
      });
      if (!overallReview) {
        overallReview = em.create(OverallReview, {
          targetId: currentUser.id,
          targetType: 'employee',
          cycleId: dto.cycleId,
          reviewedById: currentUser.id,
          status: OverallReviewStatus.DRAFT,
        });
        await em.save(OverallReview, overallReview);
      }
      // Khi submit self review, nếu đang là DRAFT thì chuyển sang PENDING_REVIEW
      if (overallReview.status === OverallReviewStatus.DRAFT) {
        overallReview.status = OverallReviewStatus.PENDING_REVIEW;
        await em.save(OverallReview, overallReview);
      }
    });
    // Trả về lại dữ liệu review mới nhất cho nhân viên
    return this.getEmployeeReviewDetails(currentUser, dto.cycleId);
  }

  async completeOverallReview(
    currentUser: Employee,
    completeReviewDto: CompleteReviewDto,
  ): Promise<OverallReview> {
    const reviewableTargets = await this.getReviewableTargets(currentUser);
    const canReviewThisTarget = reviewableTargets.some(
      (rt) =>
        rt.id === completeReviewDto.targetId &&
        rt.type === completeReviewDto.targetType,
    );

    if (!canReviewThisTarget) {
      throw new UnauthorizedException(
        'You do not have permission to complete the review for this target.',
      );
    }

    const overallReviewRecord = await this.overallReviewRepository.findOne({
      where: {
        targetId: completeReviewDto.targetId,
        targetType: completeReviewDto.targetType,
        cycleId: completeReviewDto.cycleId,
        reviewedById: currentUser.id,
      },
    });

    if (!overallReviewRecord) {
      throw new BadRequestException('Overall review record not found.');
    }

    const { startDate, endDate } = this.getDateRangeFromCycleId(
      completeReviewDto.cycleId,
    );
    const assignments = await this.assignmentRepository.find({
      where: {
        assigned_to_employee: completeReviewDto.targetId,
        startDate: LessThanOrEqual(endDate as Date),
        endDate: MoreThanOrEqual(startDate as Date),
      },
      relations: ['reviews'],
    });
    let totalWeightedScore = 0;
    for (const assignment of assignments) {
      const review = assignment.reviews?.find(
        (r) =>
          r.cycleId === completeReviewDto.cycleId &&
          r.managerScore !== null &&
          r.managerScore !== undefined,
      );
      const score = review ? Number(review.managerScore) : null;
      const weight =
        assignment.weight !== undefined && assignment.weight !== null
          ? Number(assignment.weight)
          : null;
      if (
        score !== null &&
        weight !== null &&
        !isNaN(score) &&
        !isNaN(weight)
      ) {
        totalWeightedScore += score * weight;
      }
    }
    overallReviewRecord.totalWeightedScore =
      totalWeightedScore !== null ? totalWeightedScore.toFixed(2) : null;

    const allowedPreviousStatuses = [
      OverallReviewStatus.MANAGER_REVIEWED,
      OverallReviewStatus.EMPLOYEE_FEEDBACK_PENDING,
      OverallReviewStatus.EMPLOYEE_RESPONDED,
    ];
    if (
      !allowedPreviousStatuses.includes(
        overallReviewRecord.status as OverallReviewStatus,
      )
    ) {
      throw new BadRequestException(
        `Review cannot be completed from current status: ${overallReviewRecord.status}. Allowed previous statuses are: ${allowedPreviousStatuses.join(', ')}.`,
      );
    }

    overallReviewRecord.status = OverallReviewStatus.COMPLETED;
    const completedReview =
      await this.overallReviewRepository.save(overallReviewRecord);

    this.eventEmitter.emit('overall_review.completed', {
      overallReview: completedReview,
      manager: currentUser,
      targetId: completeReviewDto.targetId,
      targetType: completeReviewDto.targetType,
    });
    return completedReview;
  }

  async getEmployeeReviewDetails(
    employee: Employee,
    cycleId: string,
  ): Promise<EmployeeReviewResponseDto> {
    // Sử dụng helper để lấy bản ghi OverallReview mới nhất
    const overallReviewRecord = await this.findLatestOverallReview(
      employee.id,
      'employee',
      cycleId,
    );

    if (!overallReviewRecord) {
      // Nếu chưa có review tổng thể, vẫn trả về danh sách KPI assignment hợp lệ cho nhân viên trong cycle
      const { startDate, endDate } = this.getDateRangeFromCycleId(cycleId);
      if (!startDate || !endDate) {
        return {
          kpisReviewedByManager: [],
          overallReviewByManager: {
            overallComment: null,
            status: OverallReviewStatus.DRAFT, // Sửa về DRAFT
            employeeComment: null,
            employeeFeedbackDate: null,
            totalWeightedScoreSupervisor: 0,
          },
          totalWeightedScoreSupervisor: 0,
        };
      }
      const assignments = await this.assignmentRepository.find({
        where: {
          assigned_to_employee: employee.id,
          startDate: LessThanOrEqual(endDate as Date),
          endDate: MoreThanOrEqual(startDate as Date),
        },
        relations: ['kpi', 'kpiValues', 'reviews', 'reviews.reviewedBy'],
      });
      const kpisReviewedByManager = (assignments || [])
        .filter((assignment) => assignment.kpi)
        .map((assignment) => {
          const selfReview = assignment.reviews?.find(
            (r) => r.reviewedBy?.id === employee.id && r.cycleId === cycleId,
          );
          let actualValue: number | null = null;
          if (assignment.kpiValues && assignment.kpiValues.length > 0) {
            const approvedInCycle = assignment.kpiValues.filter(
              (kv) =>
                kv.status === KpiValueStatus.APPROVED &&
                kv.timestamp >= startDate &&
                kv.timestamp <= endDate,
            );
            let filteredKpiValues =
              approvedInCycle.length > 0
                ? approvedInCycle
                : assignment.kpiValues.filter(
                    (kv) => kv.status === KpiValueStatus.APPROVED,
                  );
            if (filteredKpiValues.length > 0) {
              const latest = filteredKpiValues.sort(
                (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
              )[0];
              actualValue = latest ? latest.value : null;
            }
          }
          return {
            assignmentId: assignment.id,
            kpiId: assignment.kpi.id,
            kpiName: assignment.kpi.name,
            kpiDescription: assignment.kpi.description,
            targetValue: assignment.targetValue,
            actualValue: actualValue,
            unit: assignment.kpi.unit,
            status: assignment.status,
            weight: assignment.weight,
            selfScore: selfReview?.selfScore ?? null,
            selfComment: selfReview?.selfComment ?? null,
            existingManagerComment: null,
            existingManagerScore: null,
          };
        });
      return {
        kpisReviewedByManager,
        overallReviewByManager: {
          overallComment: null,
          status: OverallReviewStatus.DRAFT, // Sửa về DRAFT
          employeeComment: null,
          employeeFeedbackDate: null,
          totalWeightedScoreSupervisor: 0,
        },
        totalWeightedScoreSupervisor: 0,
      };
    }

    let managerWhoReviewed: Employee | null = null;
    if (overallReviewRecord.reviewedById) {
      managerWhoReviewed = await this.employeeRepository.findOne({ where: { id: overallReviewRecord.reviewedById } });
    }
    const reviewDataFromManagerPerspective = await this.getKpisForReview(
      managerWhoReviewed || employee,
      employee.id,
      'employee',
      cycleId,
    );

    let totalWeightedScoreSupervisor = 0;
    if (
      reviewDataFromManagerPerspective.kpisToReview &&
      Array.isArray(reviewDataFromManagerPerspective.kpisToReview)
    ) {
      for (const kpi of reviewDataFromManagerPerspective.kpisToReview) {
        const score = Number(kpi.existingManagerScore);
        const weight =
          kpi.weight !== null && kpi.weight !== undefined
            ? Number(kpi.weight)
            : 1;
        if (
          !isNaN(score) &&
          !isNaN(weight) &&
          kpi.existingManagerScore !== null &&
          kpi.existingManagerScore !== undefined
        ) {
          totalWeightedScoreSupervisor += score * weight;
        }
      }
    }

    const kpisReviewedByManager = await Promise.all(
      reviewDataFromManagerPerspective.kpisToReview.map(async (kpi) => {
        let selfScore: number | null = null;
        let selfComment: string | null = null;
        if (kpi.assignmentId) {
          const assignment = await this.assignmentRepository.findOne({
            where: { id: kpi.assignmentId },
            relations: ['reviews', 'reviews.reviewedBy'],
          });
          if (assignment && assignment.reviews) {
            const selfReview = assignment.reviews.find(
              (r) =>
                r.reviewedBy?.id === employee.id && r.cycleId === cycleId,
            );
            if (selfReview) {
              if (selfScore === null)
                selfScore = selfReview.selfScore !== undefined ? selfReview.selfScore : null;
              if (selfComment === null)
                selfComment = selfReview.selfComment !== undefined ? selfReview.selfComment : null;
            }
          }
        }
        return {
          ...kpi,
          selfScore,
          selfComment,
        };
      }),
    );

    const response: EmployeeReviewResponseDto = {
      kpisReviewedByManager,
      overallReviewByManager: {
        overallComment: overallReviewRecord.overallComment,
        status: overallReviewRecord.status,
        employeeComment: overallReviewRecord.employeeComment,
        employeeFeedbackDate: overallReviewRecord.employeeFeedbackDate,
        totalWeightedScoreSupervisor,
      },
      totalWeightedScoreSupervisor,
    };
    return response;
  }

  async submitEmployeeFeedback(
    employee: Employee,
    feedbackDto: SubmitEmployeeFeedbackDto,
  ): Promise<OverallReview> {
    // Sử dụng helper để lấy bản ghi OverallReview mới nhất
    const overallReviewRecord = await this.findLatestOverallReview(
      employee.id,
      'employee',
      feedbackDto.cycleId,
    );

    if (!overallReviewRecord) {
      throw new BadRequestException(
        'Overall review record not found for this cycle. Cannot submit feedback.',
      );
    }

    if (
      overallReviewRecord.status !==
      OverallReviewStatus.EMPLOYEE_FEEDBACK_PENDING
    ) {
      throw new BadRequestException(
        `Cannot submit feedback. Review status is '${overallReviewRecord.status}', expected '${OverallReviewStatus.EMPLOYEE_FEEDBACK_PENDING}'.`,
      );
    }

    overallReviewRecord.employeeComment = feedbackDto.employeeComment;
    overallReviewRecord.employeeFeedbackDate = new Date();
    overallReviewRecord.status = OverallReviewStatus.EMPLOYEE_RESPONDED;

    const updatedReview =
      await this.overallReviewRepository.save(overallReviewRecord);

    this.eventEmitter.emit('overall_review.employee_responded', {
      overallReview: updatedReview,
      employee: employee,
    });
    return updatedReview;
  }

  async getReviewHistory(
    currentUser: Employee,
    targetId: number,
    targetType: 'employee' | 'section' | 'department',
  ): Promise<ReviewHistoryResponseDto> {
    let canViewHistory = false;
    if (targetType === 'employee' && currentUser.id === targetId) {
      canViewHistory = true;
    } else if (['admin', 'manager'].includes(currentUser.role)) {
      const reviewableTargets = await this.getReviewableTargets(currentUser);
      canViewHistory = reviewableTargets.some(
        (rt) => rt.id === targetId && rt.type === targetType,
      );
    }

    if (!canViewHistory) {
      throw new UnauthorizedException(
        'You are not authorized to view the review history for this target.',
      );
    }

    const overallReviews = await this.overallReviewRepository.find({
      where: {
        targetId: targetId,
        targetType: targetType,
      },
      relations: ['reviewedBy'],
      order: {
        cycleId: 'DESC',
        createdAt: 'DESC',
      },
    });

    if (!overallReviews || overallReviews.length === 0) {
      return [];
    }

    return overallReviews.map((or) => ({
      overallReviewId: or.id,
      cycleId: or.cycleId,
      overallComment: or.overallComment,
      status: or.status,
      reviewedByUsername: or.reviewedBy?.username || '',
      reviewedAt: or.updatedAt,
      employeeComment: or.employeeComment,
      employeeFeedbackDate: or.employeeFeedbackDate,
    }));
  }

  async getPerformanceObjectivesForEmployee(
    employeeId: number,
    cycleId?: string,
  ): Promise<{
    objectives: PerformanceObjectiveItemDto[];
    totalWeightedScoreSupervisor?: number;
  }> {
    let dateRange;
    if (cycleId) {
      dateRange = this.getDateRangeFromCycleId(cycleId);
      if (!dateRange.startDate || !dateRange.endDate) {
        throw new BadRequestException('Invalid cycle ID provided.');
      }
    } else {
      const today = new Date();
      dateRange = { startDate: today, endDate: today };
    }

    const assignments = await this.assignmentRepository.find({
      where: {
        assigned_to_employee: employeeId,
        startDate: LessThanOrEqual(dateRange.endDate),
        endDate: MoreThanOrEqual(dateRange.startDate),
      },
      relations: [
        'kpi',
        'kpi.perspective',
        'kpiValues',
        'reviews',
        'reviews.reviewedBy',
      ],
      order: { kpi: { perspective: { id: 'ASC' }, name: 'ASC' } },
    });

    const filteredAssignments = assignments.filter(
      (a) => a.startDate && a.endDate,
    );

    let totalWeightedScoreSupervisor = 0;
    const objectives: PerformanceObjectiveItemDto[] = [];

    for (const assignment of filteredAssignments) {
      if (!assignment.kpi) continue;
      const review = assignment.reviews?.find(
        (r) =>
          r.cycleId === cycleId &&
          r.managerScore !== null &&
          r.managerScore !== undefined,
      );
      const supervisorScore = review ? Number(review.managerScore) : NaN;
      const weight =
        assignment.weight !== undefined && assignment.weight !== null
          ? Number(assignment.weight)
          : NaN;
      if (!isNaN(supervisorScore) && !isNaN(weight)) {
        totalWeightedScoreSupervisor += supervisorScore * weight;
      }
      let latestKpiValue: KpiValue | undefined = undefined;
      if (assignment.kpiValues && assignment.kpiValues.length > 0) {
        latestKpiValue = assignment.kpiValues.sort((a, b) => {
          const dateA = a.updated_at || a.timestamp;
          const dateB = b.updated_at || b.timestamp;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        })[0];
      }
      const actualValue = latestKpiValue ? latestKpiValue.value : null;
      objectives.push({
        id: assignment.id,
        name: assignment.kpi.name,
        kpiDescription: assignment.kpi.description,
        target: assignment.targetValue,
        actualResult: actualValue,
        unit: assignment.kpi.unit,
        weight: assignment.weight,
        bscAspect: assignment.kpi.perspective?.name || 'Uncategorized',
        supervisorEvalScore: supervisorScore,
        note: review ? review.managerComment || '' : '',
        start_date: assignment.startDate ?? null,
        end_date: assignment.endDate ?? null,
      });
    }

    return {
      objectives,
      totalWeightedScoreSupervisor,
    };
  }

  async savePerformanceObjectives(
    currentUser: Employee,
    saveData: SavePerformanceObjectivesDto,
  ): Promise<void> {
    const { employeeId, cycleId, evaluations } = saveData;
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId },
    });
    if (!employee) throw new Error('Employee not found');
    if (!Array.isArray(evaluations))
      throw new Error('Evaluations must be an array');
    for (const evaluation of evaluations) {
      if (!evaluation.objectiveId || typeof evaluation.score !== 'number')
        throw new Error('Invalid evaluation data');
      const kpiAssignment = await this.assignmentRepository.findOne({
        where: {
          assigned_to_employee: employeeId,
          kpi_id: evaluation.objectiveId,
        },
      });
      if (!kpiAssignment) continue;
      await this.kpiValueRepository.save({
        kpiAssignment,
        value: evaluation.score,
        note: evaluation.note,
      });
    }
  }

  async getEmployeeKpiScores(
    currentUser: Employee,
    cycleId: string,
  ): Promise<EmployeeKpiScoreDto[]> {
    let employees: Employee[] = [];
    if (currentUser.role === 'admin') {
      employees = await this.employeeRepository.find({
        relations: ['department'],
      });
    } else if (
      currentUser.role === 'manager' ||
      currentUser.role === 'department'
    ) {
      if (currentUser.departmentId) {
        employees = await this.employeeRepository.find({
          where: { departmentId: currentUser.departmentId },
          relations: ['department'],
        });
      }
    }
    const results: EmployeeKpiScoreDto[] = [];
    for (const emp of employees) {
      let reviewStatus: string | undefined = undefined;
      let totalWeightedScore: number = 0;
      const overallReview = await this.overallReviewRepository.findOne({
        where: {
          targetId: emp.id,
          targetType: 'employee',
          cycleId: cycleId,
        },
      });
      if (overallReview) {
        reviewStatus = overallReview.status;
        totalWeightedScore =
          overallReview.totalWeightedScore !== null &&
          overallReview.totalWeightedScore !== undefined
            ? Number(overallReview.totalWeightedScore)
            : 0;
      }
      results.push({
        employeeId: emp.id,
        fullName: `${emp.first_name} ${emp.last_name}`.trim(),
        department: emp.department ? emp.department.name : '',
        totalWeightedScore,
        reviewStatus,
      });
    }
    return results;
  }

  async approveSectionReview(
    overallReviewId: number,
    currentUser: Employee,
  ): Promise<OverallReview> {
    const review = await this.overallReviewRepository.findOne({
      where: { id: overallReviewId },
    });
    if (!review) throw new NotFoundException('Overall review not found');
    if (review.status !== OverallReviewStatus.SECTION_REVIEW_PENDING) {
      throw new BadRequestException('Review is not pending section approval');
    }
    if (
      !['section', 'admin', 'manager'].includes(currentUser.role) ||
      (currentUser.role === 'section' &&
        currentUser.sectionId !== undefined &&
        currentUser.sectionId !== null &&
        currentUser.sectionId !== review.targetId)
    ) {
      throw new UnauthorizedException(
        'You do not have permission to approve this review at section level',
      );
    }
    review.status = OverallReviewStatus.SECTION_REVIEWED;
    await this.overallReviewRepository.save(review);
    review.status = OverallReviewStatus.DEPARTMENT_REVIEW_PENDING;
    return this.overallReviewRepository.save(review);
  }

  async rejectSectionReview(
    overallReviewId: number,
    currentUser: Employee,
    reason?: string,
  ): Promise<OverallReview> {
    const review = await this.overallReviewRepository.findOne({
      where: { id: overallReviewId },
    });
    if (!review) throw new NotFoundException('Overall review not found');
    if (review.status !== OverallReviewStatus.SECTION_REVIEW_PENDING) {
      throw new BadRequestException('Review is not pending section approval');
    }
    if (
      !['section', 'admin', 'manager'].includes(currentUser.role) ||
      (currentUser.role === 'section' &&
        currentUser.sectionId !== undefined &&
        currentUser.sectionId !== null &&
        currentUser.sectionId !== review.targetId)
    ) {
      throw new UnauthorizedException(
        'You do not have permission to reject this review at section level',
      );
    }
    review.status = OverallReviewStatus.SECTION_REVISE_REQUIRED;
    if (reason)
      review.overallComment = `[SECTION REJECTED]: ${reason}\n${review.overallComment || ''}`;
    return this.overallReviewRepository.save(review);
  }

  async approveDepartmentReview(
    overallReviewId: number,
    currentUser: Employee,
  ): Promise<OverallReview> {
    const review = await this.overallReviewRepository.findOne({
      where: { id: overallReviewId },
    });
    if (!review) throw new NotFoundException('Overall review not found');
    if (review.status !== OverallReviewStatus.DEPARTMENT_REVIEW_PENDING) {
      throw new BadRequestException(
        'Review is not pending department approval',
      );
    }
    if (
      !['department', 'admin', 'manager'].includes(currentUser.role) ||
      (currentUser.role === 'department' &&
        currentUser.departmentId !== undefined &&
        currentUser.departmentId !== null &&
        currentUser.departmentId !== review.targetId)
    ) {
      throw new UnauthorizedException(
        'You do not have permission to approve this review at department level',
      );
    }
    review.status = OverallReviewStatus.DEPARTMENT_REVIEWED;
    await this.overallReviewRepository.save(review);
    review.status = OverallReviewStatus.MANAGER_REVIEW_PENDING;
    return this.overallReviewRepository.save(review);
  }

  async rejectDepartmentReview(
    overallReviewId: number,
    currentUser: Employee,
    reason?: string,
  ): Promise<OverallReview> {
    const review = await this.overallReviewRepository.findOne({
      where: { id: overallReviewId },
    });
    if (!review) throw new NotFoundException('Overall review not found');
    if (review.status !== OverallReviewStatus.DEPARTMENT_REVIEW_PENDING) {
      throw new BadRequestException(
        'Review is not pending department approval',
      );
    }
    if (
      !['department', 'admin', 'manager'].includes(currentUser.role) ||
      (currentUser.role === 'department' &&
        currentUser.departmentId !== undefined &&
        currentUser.departmentId !== null &&
        currentUser.departmentId !== review.targetId)
    ) {
      throw new UnauthorizedException(
        'You do not have permission to reject this review at department level',
      );
    }
    review.status = OverallReviewStatus.DEPARTMENT_REVISE_REQUIRED;
    if (reason)
      review.overallComment = `[DEPARTMENT REJECTED]: ${reason}\n${review.overallComment || ''}`;
    return this.overallReviewRepository.save(review);
  }

  async approveManagerReview(
    overallReviewId: number,
    currentUser: Employee,
  ): Promise<OverallReview> {
    const review = await this.overallReviewRepository.findOne({
      where: { id: overallReviewId },
    });
    if (!review) throw new NotFoundException('Overall review not found');
    if (review.status !== OverallReviewStatus.MANAGER_REVIEW_PENDING) {
      throw new BadRequestException('Review is not pending manager approval');
    }
    if (!['manager', 'admin'].includes(currentUser.role)) {
      throw new UnauthorizedException(
        'You do not have permission to approve this review at manager level',
      );
    }
    review.status = OverallReviewStatus.MANAGER_REVIEWED;
    await this.overallReviewRepository.save(review);
    review.status = OverallReviewStatus.EMPLOYEE_FEEDBACK_PENDING;
    return this.overallReviewRepository.save(review);
  }

  async rejectManagerReview(
    overallReviewId: number,
    currentUser: Employee,
    reason?: string,
  ): Promise<OverallReview> {
    const review = await this.overallReviewRepository.findOne({
      where: { id: overallReviewId },
    });
    if (!review) throw new NotFoundException('Overall review not found');
    if (review.status !== OverallReviewStatus.MANAGER_REVIEW_PENDING) {
      throw new BadRequestException('Review is not pending manager approval');
    }
    if (!['manager', 'admin'].includes(currentUser.role)) {
      throw new UnauthorizedException(
        'You do not have permission to reject this review at manager level',
      );
    }
    review.status = OverallReviewStatus.DEPARTMENT_REVISE_REQUIRED;
    if (reason)
      review.overallComment = `[MANAGER REJECTED]: ${reason}\n${review.overallComment || ''}`;
    return this.overallReviewRepository.save(review);
  }

  /**
   * Returns a list of all employee KPI reviews and feedbacks for a manager in a given cycle.
   */
  async getEmployeeReviewsListForManager(
    manager: Employee,
    cycleId: string,
  ): Promise<EmployeeReviewResponseDto[]> {
    // Get employees managed by this manager (same department)
    let employees: Employee[] = [];
    if (manager.role === 'admin') {
      employees = await this.employeeRepository.find();
    } else if (manager.role === 'manager' && manager.departmentId) {
      employees = await this.employeeRepository.find({
        where: { departmentId: manager.departmentId },
      });
    } else {
      return [];
    }
    // For each employee, get their review details for the cycle
    const results: EmployeeReviewResponseDto[] = [];
    for (const emp of employees) {
      // Skip the manager themselves
      if (emp.id === manager.id) continue;
      try {
        const review = await this.getEmployeeReviewDetails(emp, cycleId);
        // Attach employee info
        (review as any).employee = {
          id: emp.id,
          fullName: `${emp.first_name} ${emp.last_name}`.trim(),
          department: emp.departmentId,
        };
        results.push(review);
      } catch (e) {
        // Ignore errors for employees with no review data
      }
    }
    return results;
  }

  /**
   * Lấy tất cả các bản OverallReview của nhân viên do user hiện tại quản lý,
   * bao gồm các trạng thái cần duyệt hoặc đã có feedback.
   */
  async getManagedEmployeeOverallReviews(
    currentUser: Employee,
    statusList?: string[], // optional: lọc theo trạng thái nếu cần
  ) {
    // Lấy danh sách nhân viên do user này quản lý
    let employees: Employee[] = [];
    if (currentUser.role === 'admin') {
      employees = await this.employeeRepository.find();
    } else if (currentUser.role === 'manager' && currentUser.departmentId) {
      employees = await this.employeeRepository.find({
        where: { departmentId: currentUser.departmentId },
      });
    } else if (currentUser.role === 'department' && currentUser.departmentId) {
      employees = await this.employeeRepository.find({
        where: { departmentId: currentUser.departmentId },
      });
    } else if (currentUser.role === 'section' && currentUser.sectionId) {
      employees = await this.employeeRepository.find({
        where: { sectionId: currentUser.sectionId },
      });
    }
    const employeeIds = employees.map(e => e.id);
    if (employeeIds.length === 0) return [];
    // Lấy tất cả OverallReview của các nhân viên này
    const where: any = {
      targetId: employeeIds.length === 1 ? employeeIds[0] : In(employeeIds),
      targetType: 'employee',
    };
    if (statusList && statusList.length > 0) {
      where.status = statusList.length === 1 ? statusList[0] : statusList;
    } else {
      // Nếu không truyền statusList, loại bỏ COMPLETED mặc định
      where.status = Not('COMPLETED');
    }
    const reviews = await this.overallReviewRepository.find({
      where,
      order: { updatedAt: 'DESC' },
      relations: ['reviewedBy'],
    });
    return reviews;
  }
}


