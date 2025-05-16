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
  Brackets, // + Import Brackets
  EntityManager,
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
  ObjectiveEvaluationListItemDto, // + Import DTO
  ObjectiveEvaluationHistoryItemDto, // + Import History DTO
  SubmitSelfKpiReviewDto, // + Import SubmitSelfKpiReviewDto
} from './dto/evaluation.dto';
import { SavePerformanceObjectivesDto } from './dto/save-performance-objectives.dto';
import { OverallReviewStatus } from '../entities/overall-review.entity';
// import { RejectObjectiveEvaluationDto } from './dto/reject-objective-evaluation.dto'; // This DTO might be old or replaced
import { KpiValueStatus } from '../entities/kpi-value.entity';
import { ObjectiveEvaluationStatus } from '../entities/objective-evaluation-status.enum';
import { ObjectiveEvaluation } from '../entities/objective-evaluation.entity'; // + Import Entity
import { ObjectiveEvaluationHistory } from '../entities/objective-evaluation-history.entity'; // + Import History Entity

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
    @InjectRepository(ObjectiveEvaluation) // + Inject ObjectiveEvaluationRepository
    private readonly objectiveEvaluationRepository: Repository<ObjectiveEvaluation>,
    @InjectRepository(ObjectiveEvaluationHistory) // + Inject ObjectiveEvaluationHistoryRepository
    private readonly objectiveEvaluationHistoryRepository: Repository<ObjectiveEvaluationHistory>,
    private readonly entityManager: EntityManager,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getReviewableTargets(
    currentUser: Employee,
  ): Promise<ReviewableTargetDto[]> {
    const reviewableTargets: ReviewableTargetDto[] = [];

    // Bổ sung: Nếu là employee thì luôn cho phép review KPI của chính mình
    if (currentUser.role === 'employee') {
      reviewableTargets.push({
        id: currentUser.id,
        name: `${currentUser.first_name} ${currentUser.last_name}`.trim(),
        type: 'employee',
      });
    }

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
    // Nếu là employee và target là chính mình thì luôn cho phép
    if (
      !(
        currentUser.role === 'employee' &&
        targetType === 'employee' &&
        targetId === currentUser.id
      )
    ) {
      const reviewableTargetsForCurrentUser =
        await this.getReviewableTargets(currentUser);
      const isAllowedToReviewTarget = reviewableTargetsForCurrentUser.some(
        (rt) => rt.id === targetId && rt.type === targetType,
      );
      if (!isAllowedToReviewTarget) {
        throw new UnauthorizedException(
          'You are not authorized to review KPIs for this target.',
        );
      }
    }
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
      });
    }

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
        reviewedById: currentUser.id,
      },
    });

    if (overallReviewRecord) {
      existingOverallReviewData = {
        overallComment: overallReviewRecord.overallComment,
        overallScore: overallReviewRecord.overallScore,
        status: overallReviewRecord.status,
        employeeComment: overallReviewRecord.employeeComment,
        employeeFeedbackDate: overallReviewRecord.employeeFeedbackDate,
        totalWeightedScoreSupervisor,
      };
    }

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

        if (
          reviewData.overallComment !== undefined ||
          reviewData.overallScore !== undefined
        ) {
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
            overallReviewRecord.overallScore = reviewData.overallScore ?? null;
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
                overallScore: reviewData.overallScore ?? null,
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
      // Bổ sung: Đảm bảo có OverallReview với status PENDING_REVIEW
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
          status: OverallReviewStatus.PENDING_REVIEW,
        });
        await em.save(OverallReview, overallReview);
      } else if (overallReview.status !== OverallReviewStatus.PENDING_REVIEW) {
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
    const overallReviewRecord = await this.overallReviewRepository.findOne({
      where: {
        targetId: employee.id,
        targetType: 'employee',
        cycleId: cycleId,
      },
    });

    if (!overallReviewRecord) {
      // Nếu chưa có review tổng thể, vẫn trả về danh sách KPI assignment hợp lệ cho nhân viên trong cycle
      const { startDate, endDate } = this.getDateRangeFromCycleId(cycleId);
      // Đảm bảo startDate/endDate là Date, không phải null
      if (!startDate || !endDate) {
        return {
          kpisReviewedByManager: [],
          overallReviewByManager: null,
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
      const kpisReviewedByManager = assignments.map((assignment) => {
        // Tìm review self của nhân viên cho assignment này (nếu có)
        const selfReview = assignment.reviews?.find(
          (r) => r.reviewedBy?.id === employee.id && r.cycleId === cycleId,
        );
        // Lấy actualValue từ kpiValues (giá trị APPROVED gần nhất trong chu kỳ)
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
          weight: assignment.weight,
          selfScore: selfReview?.selfScore ?? null,
          selfComment: selfReview?.selfComment ?? null,
          existingManagerComment: null,
          existingManagerScore: null,
        };
      });
      return {
        kpisReviewedByManager,
        overallReviewByManager: null,
        totalWeightedScoreSupervisor: 0,
      };
    }

    const managerWhoReviewedId = overallReviewRecord.reviewedById;

    const managerWhoReviewed = await this.employeeRepository.findOne({
      where: { id: managerWhoReviewedId },
    });

    if (!managerWhoReviewed) {
      const errorIndicatingResponse: EmployeeReviewResponseDto = {
        kpisReviewedByManager: [],
        overallReviewByManager: {
          overallComment: `Error: Could not load review details because the reviewing manager (ID: ${managerWhoReviewedId}) was not found.`,
          status: OverallReviewStatus.PENDING_REVIEW,
          overallScore: null,
        },
      };
      return errorIndicatingResponse;
    }

    const reviewDataFromManagerPerspective = await this.getKpisForReview(
      managerWhoReviewed,
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

    const response: EmployeeReviewResponseDto = {
      kpisReviewedByManager: reviewDataFromManagerPerspective.kpisToReview,
      overallReviewByManager:
        reviewDataFromManagerPerspective.existingOverallReview
          ? {
              ...reviewDataFromManagerPerspective.existingOverallReview,
              totalWeightedScoreSupervisor,
            }
          : null,
      totalWeightedScoreSupervisor,
    };
    return response;
  }

  async submitEmployeeFeedback(
    employee: Employee,
    feedbackDto: SubmitEmployeeFeedbackDto,
  ): Promise<OverallReview> {
    const overallReviewRecord = await this.overallReviewRepository.findOne({
      where: {
        targetId: employee.id,
        targetType: 'employee',
        cycleId: feedbackDto.cycleId,
      },
    });

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
      overallScore: or.overallScore,
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
    evaluationStatus: ObjectiveEvaluationStatus | null;
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

    let evaluationStatus: ObjectiveEvaluationStatus | null = null;
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

    evaluationStatus = null;

    return {
      objectives,
      evaluationStatus,
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

  async getPendingObjectiveEvaluationsForApprover(
    currentUser: Employee,
  ): Promise<ObjectiveEvaluationListItemDto[]> {
    const queryBuilder = this.objectiveEvaluationRepository
      .createQueryBuilder('objEval')
      .leftJoinAndSelect('objEval.employee', 'employee')
      .leftJoinAndSelect('employee.department', 'empDepartment')
      .leftJoinAndSelect('employee.section', 'empSection')
      .leftJoinAndSelect('objEval.evaluator', 'evaluator')
      .orderBy('objEval.updated_at', 'DESC');

    const conditions: Brackets[] = [];

    if (currentUser.role === 'admin') {
      conditions.push(
        new Brackets((qb) => {
          qb.where('objEval.status = :statusManager', {
            statusManager: ObjectiveEvaluationStatus.PENDING_MANAGER_APPROVAL,
          });
        }),
      );
    } else if (currentUser.role === 'manager') {
      conditions.push(
        new Brackets((qb) => {
          if (currentUser.departmentId) {
            qb.orWhere(
              '(objEval.status = :statusDept AND empDepartment.id = :deptId)',
              {
                statusDept: ObjectiveEvaluationStatus.PENDING_DEPT_APPROVAL,
                deptId: currentUser.departmentId,
              },
            );
          }
          if (currentUser.sectionId) {
            qb.orWhere(
              '(objEval.status = :statusSection AND empSection.id = :sectionId)',
              {
                statusSection:
                  ObjectiveEvaluationStatus.PENDING_SECTION_APPROVAL,
                sectionId: currentUser.sectionId,
              },
            );
          }
          // Manager can also see PENDING_MANAGER_APPROVAL if they are not the original evaluator
          qb.orWhere(
            'objEval.status = :statusManager AND objEval.evaluatorId != :currentUserId',
            {
              statusManager: ObjectiveEvaluationStatus.PENDING_MANAGER_APPROVAL,
              currentUserId: currentUser.id,
            },
          );
        }),
      );
    } else if (currentUser.role === 'department' && currentUser.departmentId) {
      conditions.push(
        new Brackets((qb) => {
          qb.where(
            'objEval.status = :statusDept AND empDepartment.id = :deptId',
            {
              statusDept: ObjectiveEvaluationStatus.PENDING_DEPT_APPROVAL,
              deptId: currentUser.departmentId,
            },
          );
        }),
      );
    } else if (currentUser.role === 'section' && currentUser.sectionId) {
      conditions.push(
        new Brackets((qb) => {
          qb.where(
            'objEval.status = :statusSection AND empSection.id = :sectionId',
            {
              statusSection: ObjectiveEvaluationStatus.PENDING_SECTION_APPROVAL,
              sectionId: currentUser.sectionId,
            },
          );
        }),
      );
    }

    if (conditions.length > 0) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          conditions.forEach((condition) => qb.orWhere(condition));
        }),
      );
    } else {
      // If no conditions match (e.g., a role without approval duties), return empty
      return [];
    }

    const evaluations = await queryBuilder.getMany();

    return evaluations.map((e) => ({
      id: e.id,
      employee: e.employee
        ? {
            id: e.employee.id,
            first_name: e.employee.first_name,
            last_name: e.employee.last_name,
            username: e.employee.username,
          }
        : null,
      evaluator: e.evaluator
        ? {
            id: e.evaluator.id,
            first_name: e.evaluator.first_name,
            last_name: e.evaluator.last_name,
            username: e.evaluator.username,
          }
        : null,
      cycleId: e.cycleId,
      totalWeightedScoreSupervisor: e.totalWeightedScoreSupervisor
        ? parseFloat(e.totalWeightedScoreSupervisor.toString())
        : undefined,
      averageScoreSupervisor: e.averageScoreSupervisor
        ? parseFloat(e.averageScoreSupervisor.toString())
        : undefined,
      status: e.status,
      updated_at: e.updated_at,
    }));
  }

  private async updateObjectiveEvaluationStatus(
    evaluationId: number,
    currentUser: Employee,
    newStatus: ObjectiveEvaluationStatus,
    rejectionReason: string | undefined,
    oldStatusCheck: ObjectiveEvaluationStatus,
  ): Promise<ObjectiveEvaluation> {
    const evaluation = await this.objectiveEvaluationRepository.findOne({
      where: { id: evaluationId },
      relations: [
        'employee',
        'employee.department',
        'employee.section',
        'evaluator',
      ],
    });

    if (!evaluation) {
      throw new NotFoundException(
        `Objective evaluation with ID ${evaluationId} not found.`,
      );
    }
    if (evaluation.status !== oldStatusCheck) {
      throw new BadRequestException(
        `Evaluation is not in ${oldStatusCheck} status. Current status: ${evaluation.status}`,
      );
    }

    const employee = evaluation.employee;
    let canApproveOrReject = false;
    if (
      currentUser.role === 'admin' &&
      oldStatusCheck === ObjectiveEvaluationStatus.PENDING_MANAGER_APPROVAL
    )
      canApproveOrReject = true;
    if (currentUser.role === 'manager') {
      if (
        oldStatusCheck === ObjectiveEvaluationStatus.PENDING_DEPT_APPROVAL &&
        employee?.department?.id === currentUser.departmentId
      )
        canApproveOrReject = true;
      if (
        oldStatusCheck === ObjectiveEvaluationStatus.PENDING_SECTION_APPROVAL &&
        employee?.section?.id === currentUser.sectionId
      )
        canApproveOrReject = true;
      if (oldStatusCheck === ObjectiveEvaluationStatus.PENDING_MANAGER_APPROVAL)
        canApproveOrReject = true; // Manager can be final approver
    }
    if (
      currentUser.role === 'department' &&
      oldStatusCheck === ObjectiveEvaluationStatus.PENDING_DEPT_APPROVAL &&
      employee?.department?.id === currentUser.departmentId
    )
      canApproveOrReject = true;
    if (
      currentUser.role === 'section' &&
      oldStatusCheck === ObjectiveEvaluationStatus.PENDING_SECTION_APPROVAL &&
      employee?.section?.id === currentUser.sectionId
    )
      canApproveOrReject = true;

    if (!canApproveOrReject) {
      throw new UnauthorizedException(
        'You do not have permission to perform this action on this evaluation.',
      );
    }

    evaluation.status = newStatus;
    if (rejectionReason) {
      evaluation.currentRejectionReason = rejectionReason;
    }
    const savedEvaluation =
      await this.objectiveEvaluationRepository.save(evaluation);

    // Log history
    await this.objectiveEvaluationHistoryRepository.save({
      evaluationId: savedEvaluation.id,
      oldStatus: oldStatusCheck,
      newStatus: newStatus,
      reason: rejectionReason || null,
      changedById: currentUser.id,
    });
    await this.objectiveEvaluationRepository.save(evaluation);
    // TODO: Emit event for notification
    this.eventEmitter.emit('objective_evaluation.status_changed', {
      evaluation: savedEvaluation,
      actor: currentUser,
      previousStatus: oldStatusCheck,
    });
    return savedEvaluation;
  }

  async approveObjectiveEvaluationByLevel(
    evaluationId: number,
    currentUser: Employee,
    level: 'section' | 'dept' | 'manager',
  ): Promise<ObjectiveEvaluation> {
    let oldStatus: ObjectiveEvaluationStatus;
    let newStatus: ObjectiveEvaluationStatus;

    switch (level) {
      case 'section':
        oldStatus = ObjectiveEvaluationStatus.PENDING_SECTION_APPROVAL;
        newStatus = ObjectiveEvaluationStatus.PENDING_DEPT_APPROVAL;
        break;
      case 'dept':
        oldStatus = ObjectiveEvaluationStatus.PENDING_DEPT_APPROVAL;
        newStatus = ObjectiveEvaluationStatus.PENDING_MANAGER_APPROVAL;
        break;
      case 'manager':
        oldStatus = ObjectiveEvaluationStatus.PENDING_MANAGER_APPROVAL;
        newStatus = ObjectiveEvaluationStatus.APPROVED;
        break;
      default:
        throw new BadRequestException('Invalid approval level');
    }
    return this.updateObjectiveEvaluationStatus(
      evaluationId,
      currentUser,
      newStatus,
      undefined,
      oldStatus,
    );
  }

  async rejectObjectiveEvaluationByLevel(
    evaluationId: number,
    currentUser: Employee,
    reason: string,
    level: 'section' | 'dept' | 'manager',
  ): Promise<ObjectiveEvaluation> {
    let oldStatus: ObjectiveEvaluationStatus;
    let newStatus: ObjectiveEvaluationStatus;
    switch (level) {
      case 'section':
        oldStatus = ObjectiveEvaluationStatus.PENDING_SECTION_APPROVAL;
        newStatus = ObjectiveEvaluationStatus.REJECTED_BY_SECTION;
        break;
      case 'dept':
        oldStatus = ObjectiveEvaluationStatus.PENDING_DEPT_APPROVAL;
        newStatus = ObjectiveEvaluationStatus.REJECTED_BY_DEPT;
        break;
      case 'manager':
        oldStatus = ObjectiveEvaluationStatus.PENDING_MANAGER_APPROVAL;
        newStatus = ObjectiveEvaluationStatus.REJECTED_BY_MANAGER;
        break;
      default:
        throw new BadRequestException('Invalid rejection level');
    }
    return this.updateObjectiveEvaluationStatus(
      evaluationId,
      currentUser,
      newStatus,
      reason,
      oldStatus,
    );
  }

  async getObjectiveEvaluationHistory(
    evaluationId: number,
    currentUser: Employee, // Assuming only users with approval roles or the employee themselves can view history
  ): Promise<ObjectiveEvaluationHistoryItemDto[]> {
    // TODO: Implement permission check here based on currentUser role and the evaluation's employee/department/section
    // For now, assuming anyone with access to the list can view history.
    // A more robust check would involve loading the evaluation and checking if currentUser has scope over the employee.

    const history = await this.objectiveEvaluationHistoryRepository.find({
      where: { evaluationId: evaluationId },
      relations: ['changedBy'],
      order: { timestamp: 'ASC' },
    });

    return history.map((item) => ({
      id: item.id,
      oldStatus: item.oldStatus,
      newStatus: item.newStatus,
      reason: item.reason,
      changedBy: item.changedBy
        ? {
            id: item.changedBy.id,
            first_name: item.changedBy.first_name,
            last_name: item.changedBy.last_name,
            username: item.changedBy.username,
          }
        : null,
      timestamp: item.timestamp,
    }));
  }
}
