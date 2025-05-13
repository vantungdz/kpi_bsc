import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
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
import { PerformanceObjectiveEvaluation } from '../entities/performance-objective-evaluation.entity';
import { PerformanceObjectiveEvaluationDetail } from '../entities/performance-objective-evaluation-detail.entity';
import { PerformanceObjectiveEvaluationHistory } from '../entities/performance-objective-evaluation-history.entity';
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
} from './dto/evaluation.dto';
import { SavePerformanceObjectivesDto } from './dto/save-performance-objectives.dto';
import { OverallReviewStatus } from '../entities/overall-review.entity';
import { RejectObjectiveEvaluationDto } from './dto/reject-objective-evaluation.dto';
import { KpiValueStatus } from '../entities/kpi-value.entity';
import { ObjectiveEvaluationStatus } from 'src/entities/objective-evaluation-status.enum';

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);

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
    @InjectRepository(PerformanceObjectiveEvaluation)
    private readonly objectiveEvaluationRepository: Repository<PerformanceObjectiveEvaluation>,
    @InjectRepository(PerformanceObjectiveEvaluationDetail)
    private readonly objectiveEvaluationDetailRepository: Repository<PerformanceObjectiveEvaluationDetail>,
    @InjectRepository(PerformanceObjectiveEvaluationHistory)
    private readonly objectiveEvaluationHistoryRepository: Repository<PerformanceObjectiveEvaluationHistory>,
    private readonly entityManager: EntityManager,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getReviewableTargets(
    currentUser: Employee,
  ): Promise<ReviewableTargetDto[]> {
    const reviewableTargets: ReviewableTargetDto[] = [];

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
    const currentMonth = today.getMonth();
    const currentQuarter = Math.floor(currentMonth / 3) + 1;

    cycles.push({
      id: `${currentYear}-Q${currentQuarter}`,
      name: `Quý ${currentQuarter} - ${currentYear}`,
    });

    let prevQYear = currentYear;
    let prevQuarter = currentQuarter - 1;
    if (prevQuarter === 0) {
      prevQuarter = 4;
      prevQYear--;
    }
    cycles.push({
      id: `${prevQYear}-Q${prevQuarter}`,
      name: `Quý ${prevQuarter} - ${prevQYear}`,
    });

    let prevPrevQYear = prevQYear;
    let prevPrevQuarter = prevQuarter - 1;
    if (prevPrevQuarter === 0) {
      prevPrevQuarter = 4;
      prevPrevQYear--;
    }
    cycles.push({
      id: `${prevPrevQYear}-Q${prevPrevQuarter}`,
      name: `Quý ${prevPrevQuarter} - ${prevPrevQYear}`,
    });

    cycles.push({ id: `${currentYear}-Year`, name: `Năm ${currentYear}` });

    const previousYearVal = currentYear - 1;
    cycles.push({
      id: `${previousYearVal}-Year`,
      name: `Năm ${previousYearVal}`,
    });

    cycles.push({
      id: `${previousYearVal}-Q4`,
      name: `Quý 4 - ${previousYearVal}`,
    });

    cycles.push({
      id: `${previousYearVal}-Q3`,
      name: `Quý 3 - ${previousYearVal}`,
    });

    const uniqueCycleMap = new Map<string, ReviewCycleDto>();
    cycles.forEach((cycle) => {
      if (!uniqueCycleMap.has(cycle.id)) {
        uniqueCycleMap.set(cycle.id, cycle);
      }
    });

    return Array.from(uniqueCycleMap.values()).sort((a, b) => {
      const [yearA, periodTypeA] = a.id.split('-');
      const [yearB, periodTypeB] = b.id.split('-');
      const numYearA = parseInt(yearA);
      const numYearB = parseInt(yearB);

      if (numYearA !== numYearB) return numYearB - numYearA;

      const isQ_A = periodTypeA.startsWith('Q');
      const isQ_B = periodTypeB.startsWith('Q');

      if (isQ_A && !isQ_B) return -1;
      if (!isQ_A && isQ_B) return 1;

      if (isQ_A && isQ_B) {
        const qNumA = parseInt(periodTypeA.substring(1));
        const qNumB = parseInt(periodTypeB.substring(1));
        return qNumB - qNumA;
      }
      return 0;
    });
  }

  async getKpisForReview(
    currentUser: Employee,
    targetId: number,
    targetType: 'employee' | 'section' | 'department',
    cycleId: string,
  ): Promise<KpisForReviewResponseDto> {
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
        relevantKpiValue = assignment.kpiValues
          .filter(
            (kv) =>
              kv.status === KpiValueStatus.APPROVED &&
              kv.timestamp >= startDate &&
              kv.timestamp <= endDate,
          )
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
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
        existingManagerComment: existingReview
          ? existingReview.managerComment
          : null,
        existingManagerScore: existingReview
          ? existingReview.managerScore
          : null,
      });
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
  ): Promise<OverallReview | null> {
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
    return savedOverallReview;
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
      const emptyResponse: EmployeeReviewResponseDto = {
        kpisReviewedByManager: [],
        overallReviewByManager: null,
      };
      return emptyResponse;
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

    const response: EmployeeReviewResponseDto = {
      kpisReviewedByManager: reviewDataFromManagerPerspective.kpisToReview,
      overallReviewByManager:
        reviewDataFromManagerPerspective.existingOverallReview ?? null,
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
  }> {
    this.logger.debug(
      `[getPerformanceObjectivesForEmployee] Called for employee ${employeeId}, cycle ${cycleId ?? 'N/A'}`,
    );

    let dateRange;
    if (cycleId) {
      dateRange = this.getDateRangeFromCycleId(cycleId);
      if (!dateRange.startDate || !dateRange.endDate) {
        this.logger.warn(
          `[getPerformanceObjectivesForEmployee] Invalid cycleId ${cycleId} for date range.`,
        );
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
      relations: ['kpi', 'kpi.perspective', 'kpiValues'],
      order: { kpi: { perspective: { id: 'ASC' }, name: 'ASC' } },
    });

    // Fetch the existing PerformanceObjectiveEvaluation for this employee and cycle (if any)
    // to get previously saved supervisor scores and notes.
    let existingObjectiveEvaluation: PerformanceObjectiveEvaluation | null =
      null;
    if (employeeId) {
      // Chỉ cần employeeId là đủ để fetch status?
      if (cycleId) {
        // Nếu cycleId được cung cấp, dùng nó
        this.logger.debug(
          `[getPerformanceObjectivesForEmployee] Fetching evaluation for employee ${employeeId} and cycle ${cycleId}.`,
        );
        existingObjectiveEvaluation =
          await this.objectiveEvaluationRepository.findOne({
            where: {
              employee_id: employeeId,
              review_cycle_id: Number(cycleId),
            },
            relations: ['details'],
          });
      } else {
        // Nếu cycleId KHÔNG được cung cấp, tìm bản ghi mới nhất cho employeeId
        this.logger.debug(
          `[getPerformanceObjectivesForEmployee] No cycleId provided. Fetching latest evaluation for employee ${employeeId}.`,
        );
        existingObjectiveEvaluation =
          await this.objectiveEvaluationRepository.findOne({
            where: {
              employee_id: employeeId,
            },
            order: {
              updated_at: 'DESC', // Hoặc created_at, hoặc review_cycle_id nếu nó thể hiện sự mới nhất
            },
            relations: ['details'],
          });
      }
    }

    if (!assignments || assignments.length === 0) {
      return {
        objectives: [],
        evaluationStatus:
          existingObjectiveEvaluation?.status ??
          ObjectiveEvaluationStatus.PENDING_SECTION_APPROVAL,
      };
    }

    const objectives: PerformanceObjectiveItemDto[] = [];

    for (const assignment of assignments) {
      if (!assignment.kpi) continue;

      console.log(
        `KPI Values for assignment ${assignment.id}:`,
        assignment.kpiValues,
      );

      let latestKpiValue: KpiValue | undefined = undefined;
      if (assignment.kpiValues && assignment.kpiValues.length > 0) {
        latestKpiValue = assignment.kpiValues.sort((a, b) => {
          const dateA = a.updated_at || a.timestamp;
          const dateB = b.updated_at || b.timestamp;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        })[0];
      }

      const actualValue = latestKpiValue ? latestKpiValue.value : null;
      // Get supervisor score and note from existingObjectiveEvaluation.details
      // We need to match by the original KPI's ID (assignment.kpi.id)
      // because performance_objective_id in Detail entity refers to Kpi.id
      const existingEvalDetail = existingObjectiveEvaluation?.details?.find(
        (detail) => detail.performance_objective_id === assignment.kpi_id,
      );

      const supervisorScore = existingEvalDetail
        ? existingEvalDetail.score
        : null;
      const supervisorNote = existingEvalDetail ? existingEvalDetail.note : '';

      objectives.push({
        id: assignment.id,
        name: assignment.kpi.name,
        kpiDescription: assignment.kpi.description,
        target: assignment.targetValue,
        actualResult: actualValue, // This is from KpiValue
        unit: assignment.kpi.unit,
        weight: assignment.weight,
        bscAspect: assignment.kpi.perspective?.name || 'Uncategorized',
        supervisorEvalScore: supervisorScore, // Score from PerformanceObjectiveEvaluationDetail
        note: supervisorNote, // Note from PerformanceObjectiveEvaluationDetail
      });
    }
    return {
      objectives,
      evaluationStatus:
        existingObjectiveEvaluation?.status ??
        ObjectiveEvaluationStatus.PENDING_SECTION_APPROVAL,
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
    if (!employee) {
      throw new Error('Employee not found');
    }

    if (!Array.isArray(evaluations)) {
      throw new Error('Evaluations must be an array');
    }

    for (const evaluation of evaluations) {
      if (!evaluation.objectiveId || typeof evaluation.score !== 'number') {
        throw new Error('Invalid evaluation data');
      }

      console.log(
        `Processing evaluation for employeeId: ${employeeId}, KPI ID: ${evaluation.objectiveId}`,
      );

      const kpiAssignment = await this.assignmentRepository.findOne({
        where: {
          assigned_to_employee: employeeId,
          kpi_id: evaluation.objectiveId,
        },
      });

      if (!kpiAssignment) {
        console.warn(
          `KPI Assignment not found for employeeId: ${employeeId}, KPI ID: ${evaluation.objectiveId}. Skipping this evaluation.`,
        );
        continue;
      }

      await this.kpiValueRepository.save({
        kpiAssignment: kpiAssignment,
        value: evaluation.score,
        note: evaluation.note,
      });
    }
  }

  async submitObjectiveEvaluation(
    evaluator: Employee,
    dto: SavePerformanceObjectivesDto,
  ): Promise<PerformanceObjectiveEvaluation> {
    return this.entityManager.transaction<PerformanceObjectiveEvaluation>(
      async (
        transactionalEntityManager,
      ): Promise<PerformanceObjectiveEvaluation> => {
        const objEvalRepo = transactionalEntityManager.getRepository(
          PerformanceObjectiveEvaluation,
        );
        const objEvalDetailRepo = transactionalEntityManager.getRepository(
          PerformanceObjectiveEvaluationDetail,
        );
        const objEvalHistoryRepo = transactionalEntityManager.getRepository(
          PerformanceObjectiveEvaluationHistory,
        );
        const assignmentRepo =
          transactionalEntityManager.getRepository(KPIAssignment);

        const { employeeId, cycleId, evaluations } = dto;

        const evaluatedEmployee = await this.employeeRepository.findOneBy({
          id: employeeId,
        });
        if (!evaluatedEmployee) {
          throw new BadRequestException(
            `Employee with ID ${employeeId} not found.`,
          );
        }

        let totalWeightedScore = 0;
        let totalWeightForAverage = 0;

        const detailEntities: PerformanceObjectiveEvaluationDetail[] = [];

        for (const evalItem of evaluations) {
          const assignment = await assignmentRepo.findOne({
            where: {
              id: evalItem.objectiveId,
              assigned_to_employee: employeeId,
            },
            relations: ['kpi'],
          });

          if (!assignment || !assignment.kpi) {
            this.logger.warn(
              `KPI Assignment ID ${evalItem.objectiveId} for employee ${employeeId} not found or KPI missing. Skipping.`,
            );
            continue;
          }

          const detail = new PerformanceObjectiveEvaluationDetail();
          detail.performance_objective_id = assignment.kpi.id;
          detail.score = evalItem.score ?? null;
          detail.note = evalItem.note || '';
          detailEntities.push(detail);

          if (
            typeof evalItem.score === 'number' &&
            typeof assignment.weight === 'number'
          ) {
            totalWeightedScore += evalItem.score * assignment.weight;
            if (assignment.weight > 0) {
              totalWeightForAverage += assignment.weight;
            }
          }
        }

        const averageScore =
          totalWeightForAverage > 0
            ? totalWeightedScore / totalWeightForAverage
            : 0;

        let objectiveEvaluation = await objEvalRepo.findOne({
          where: {
            employee_id: employeeId,
            // Giả sử cycleId luôn được cung cấp khi lưu từ PerformanceObjectives.vue
            // Nếu cycleId có thể là undefined, cần xử lý cẩn thận hơn ở đây
            // hoặc đảm bảo frontend luôn gửi cycleId khi lưu.
            // Hiện tại, SavePerformanceObjectivesDto có cycleId là optional.
            // Để đơn giản, ta giả định cycleId sẽ được truyền khi cần.
            review_cycle_id: cycleId ? Number(cycleId) : undefined,
          },
        });
        const isNewEvaluation = !objectiveEvaluation;

        let newStatusForEvaluation: ObjectiveEvaluationStatus; // <-- Khai báo biến ở đây

        if (evaluator.role === 'section') {
          // Nếu Trưởng Bộ phận (section) là người submit,
          // coi như bước Section đã hoàn thành. Chuyển cho Trưởng Phòng (department) duyệt.
          newStatusForEvaluation =
            ObjectiveEvaluationStatus.PENDING_DEPT_APPROVAL;
        } else if (evaluator.role === 'department') {
          // Nếu Trưởng Phòng (department) là người submit,
          // coi như bước Department đã hoàn thành. Chuyển cho Quản lý (manager) duyệt.
          newStatusForEvaluation =
            ObjectiveEvaluationStatus.PENDING_MANAGER_APPROVAL;
        } else if (evaluator.role === 'manager' || evaluator.role === 'admin') {
          // Nếu Quản lý (manager) hoặc Admin là người submit,
          // coi như đã được phê duyệt hoàn toàn (vì họ là cấp cao nhất hoặc có quyền).
          newStatusForEvaluation = ObjectiveEvaluationStatus.APPROVED;
        } else {
          // Đối với các vai trò khác (nếu có) hoặc trường hợp không xác định,
          // hoặc nếu quy trình yêu cầu mọi đánh giá (kể cả do cấp cao hơn nhập)
          // đều phải bắt đầu từ Section, thì đặt là PENDING_SECTION_APPROVAL.
          // Dựa trên yêu cầu "bắt đầu từ section", đây là default hợp lý
          // khi người nhập không phải là section/department/manager/admin trực tiếp thực hiện bước của họ.
          // Tuy nhiên, với logic trên, nếu Manager/Admin nhập, nó sẽ APPROVED.
          // Nếu muốn Manager/Admin nhập mà vẫn qua Section, thì cần điều chỉnh logic if/else ở trên.
          // Hiện tại, logic này ưu tiên: nếu người có vai trò X nhập, thì bước X coi như xong.
          newStatusForEvaluation =
            ObjectiveEvaluationStatus.PENDING_SECTION_APPROVAL;
        }

        // Nếu bạn muốn một quy trình cứng nhắc hơn:
        // Bất kể ai nhập (Manager, Admin, Dept Head), nếu không phải Section Leader của nhân viên đó,
        // thì trạng thái luôn là PENDING_SECTION_APPROVAL.
        // Chỉ khi Section Leader của nhân viên đó nhập, mới là PENDING_DEPT_APPROVAL.
        // Điều này sẽ phức tạp hơn vì cần kiểm tra quan hệ quản lý.
        // Logic hiện tại đơn giản hơn: dựa vào vai trò của người nhấn nút Save.

        /*
        // Logic cũ hơn, luôn bắt đầu từ PENDING_SECTION_APPROVAL trừ khi có điều chỉnh cụ thể
        if (evaluator.role === 'section') {
           newStatusForEvaluation = ObjectiveEvaluationStatus.PENDING_DEPT_APPROVAL;
        } else {
           newStatusForEvaluation = ObjectiveEvaluationStatus.PENDING_SECTION_APPROVAL;
        }
        */

        // Correctly define statusBefore and historyAction
        // statusBefore should be captured from the original objectiveEvaluation (if it exists)
        // before its status property is modified.
        const statusBefore = objectiveEvaluation?.status;
        const historyAction = isNewEvaluation
          ? 'CREATE_SUBMITTED'
          : 'UPDATE_SUBMITTED';

        if (objectiveEvaluation) {
          // For existing evaluations being re-submitted,
          // we also reset to PENDING_SECTION_APPROVAL to restart the full approval flow.
          // If a different logic is needed for re-submissions (e.g., based on evaluator's role),
          // this can be adjusted.
          const currentObjectiveEvaluation: PerformanceObjectiveEvaluation =
            objectiveEvaluation;

          currentObjectiveEvaluation.evaluator = evaluator;
          currentObjectiveEvaluation.total_weighted_score_supervisor =
            totalWeightedScore;
          currentObjectiveEvaluation.average_score_supervisor = averageScore;
          currentObjectiveEvaluation.status = newStatusForEvaluation;
          currentObjectiveEvaluation.updated_by = evaluator.id;
          currentObjectiveEvaluation.rejection_reason = null;

          await objEvalDetailRepo.remove(
            await objEvalDetailRepo.find({
              where: { evaluation_id: currentObjectiveEvaluation.id },
            }),
          );
          currentObjectiveEvaluation.details = detailEntities.map((d) => {
            d.evaluation = currentObjectiveEvaluation;
            return d;
          });
        } else {
          objectiveEvaluation = objEvalRepo.create({
            employee_id: employeeId,
            evaluated_by_id: evaluator.id,
            review_cycle_id: cycleId ? Number(cycleId) : undefined,
            total_weighted_score_supervisor: totalWeightedScore,
            average_score_supervisor: averageScore,
            status: newStatusForEvaluation,
            details: detailEntities,
            updated_by: evaluator.id,
          });
        }

        const savedObjectiveEvaluation =
          await objEvalRepo.save(objectiveEvaluation);

        // Ensure details are always saved/updated correctly
        // First, ensure all detail entities have the correct evaluation_id
        for (const detail of detailEntities) {
          // Use detailEntities which holds the latest data
          detail.evaluation_id = savedObjectiveEvaluation.id;
        }
        await objEvalDetailRepo.save(detailEntities); // Save all new/updated details

        await this.logObjectiveEvaluationWorkflowHistory(
          transactionalEntityManager,
          savedObjectiveEvaluation,
          isNewEvaluation ? null : statusBefore, // statusBefore is null for new evaluations
          historyAction,
          evaluator.id,
        );

        return savedObjectiveEvaluation;
      },
    );
  }

  async getPendingObjectiveEvaluations(
    currentUser: Employee,
  ): Promise<PerformanceObjectiveEvaluation[]> {
    const query = this.objectiveEvaluationRepository
      .createQueryBuilder('objEval')
      .innerJoinAndSelect('objEval.employee', 'evaluatedEmployee')
      .leftJoinAndSelect('objEval.evaluator', 'evaluator')
      .leftJoinAndSelect('evaluatedEmployee.section', 'empSection')
      .leftJoinAndSelect('evaluatedEmployee.department', 'empDepartment')
      .leftJoinAndSelect('empSection.department', 'empSectionDepartment');

    switch (currentUser.role) {
      case 'section':
        if (!currentUser.sectionId) return [];
        query
          .where('objEval.status = :status', {
            status: ObjectiveEvaluationStatus.PENDING_SECTION_APPROVAL,
          })
          .andWhere('evaluatedEmployee.sectionId = :sectionId', {
            sectionId: currentUser.sectionId,
          });
        break;
      case 'department':
        if (!currentUser.departmentId) return [];
        query
          .where('objEval.status = :status', {
            status: ObjectiveEvaluationStatus.PENDING_DEPT_APPROVAL,
          })
          .andWhere(
            new Brackets((qb) => {
              qb.where('evaluatedEmployee.departmentId = :deptId', {
                deptId: currentUser.departmentId,
              }).orWhere('empSectionDepartment.id = :deptId', {
                deptId: currentUser.departmentId,
              });
            }),
          );
        break;
      case 'manager':
        query.where('objEval.status = :status', {
          status: ObjectiveEvaluationStatus.PENDING_MANAGER_APPROVAL,
        });

        break;
      case 'admin':
        query.where('objEval.status IN (:...statuses)', {
          statuses: [
            ObjectiveEvaluationStatus.PENDING_SECTION_APPROVAL,
            ObjectiveEvaluationStatus.PENDING_DEPT_APPROVAL,
            ObjectiveEvaluationStatus.PENDING_MANAGER_APPROVAL,
          ],
        });
        break;
      default:
        return [];
    }
    query.orderBy('objEval.updated_at', 'ASC');
    return query.getMany();
  }

  private async findObjectiveEvaluationForWorkflow(
    evaluationId: number,
  ): Promise<PerformanceObjectiveEvaluation> {
    const evaluation = await this.objectiveEvaluationRepository.findOne({
      where: { id: evaluationId },
      relations: [
        'employee',
        'employee.section',
        'employee.department',
        'employee.section.department',
      ],
    });
    if (!evaluation) {
      throw new NotFoundException(
        `Performance Objective Evaluation with ID ${evaluationId} not found.`,
      );
    }
    if (!evaluation.employee) {
      throw new BadRequestException(
        `Evaluated employee details not found for evaluation ID ${evaluationId}`,
      );
    }
    return evaluation;
  }

  private async checkPermissionForObjectiveEvaluation(
    approver: Employee,
    evaluation: PerformanceObjectiveEvaluation,
    actionLevel: 'SECTION' | 'DEPARTMENT' | 'MANAGER',
  ): Promise<boolean> {
    const targetEmployee = evaluation.employee;

    if (!targetEmployee) {
      this.logger.warn(
        `Target employee not loaded for evaluation ID ${evaluation.id}`,
      );
      return false;
    }

    switch (actionLevel) {
      case 'SECTION':
        return (
          (approver.role === 'section' &&
            approver.sectionId === targetEmployee.sectionId) ||
          (approver.role === 'department' &&
            approver.departmentId ===
              (targetEmployee.departmentId ||
                targetEmployee.section?.department.id)) ||
          approver.role === 'manager' ||
          approver.role === 'admin'
        );
      case 'DEPARTMENT':
        return (
          (approver.role === 'department' &&
            approver.departmentId ===
              (targetEmployee.departmentId ||
                targetEmployee.section?.department.id)) ||
          approver.role === 'manager' ||
          approver.role === 'admin'
        );
      case 'MANAGER':
        return approver.role === 'manager' || approver.role === 'admin';
      default:
        return false;
    }
  }

  private async processApprovalOrRejection(
    evaluationId: number,
    approver: Employee,
    action: 'APPROVE' | 'REJECT',
    currentLevelStatus: ObjectiveEvaluationStatus,
    nextLevelStatusOnApprove: ObjectiveEvaluationStatus,
    rejectedStatusThisLevel: ObjectiveEvaluationStatus,
    rejectedStatusByManagerAdmin: ObjectiveEvaluationStatus,
    permissionLevel: 'SECTION' | 'DEPARTMENT' | 'MANAGER',
    historyActionPrefix: string,
    rejectionReason?: string,
  ): Promise<PerformanceObjectiveEvaluation> {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const objEvalRepo = transactionalEntityManager.getRepository(
          PerformanceObjectiveEvaluation,
        );
        const evaluation =
          await this.findObjectiveEvaluationForWorkflow(evaluationId);
        const statusBefore = evaluation.status;

        const hasPermission = await this.checkPermissionForObjectiveEvaluation(
          approver,
          evaluation,
          permissionLevel,
        );
        if (!hasPermission) {
          throw new UnauthorizedException(
            `User does not have permission for ${permissionLevel} level action.`,
          );
        }

        if (evaluation.status !== currentLevelStatus) {
          throw new BadRequestException(
            `Cannot perform action. Evaluation status is '${evaluation.status}', expected '${currentLevelStatus}'.`,
          );
        }

        if (
          action === 'REJECT' &&
          (!rejectionReason || rejectionReason.trim() === '')
        ) {
          throw new BadRequestException('Rejection reason is required.');
        }

        if (action === 'APPROVE') {
          evaluation.status =
            approver.role === 'manager' || approver.role === 'admin'
              ? ObjectiveEvaluationStatus.APPROVED
              : nextLevelStatusOnApprove;
          evaluation.rejection_reason = null;
        } else {
          evaluation.status =
            approver.role === 'manager' || approver.role === 'admin'
              ? rejectedStatusByManagerAdmin
              : rejectedStatusThisLevel;
          evaluation.rejection_reason = rejectionReason!;
        }

        evaluation.updated_by = approver.id;
        evaluation.approved_by_id =
          evaluation.status === ObjectiveEvaluationStatus.APPROVED
            ? approver.id
            : null;
        evaluation.approved_at =
          evaluation.status === ObjectiveEvaluationStatus.APPROVED
            ? new Date()
            : null;

        const savedEvaluation = await objEvalRepo.save(evaluation);

        await this.logObjectiveEvaluationWorkflowHistory(
          transactionalEntityManager,
          savedEvaluation,
          statusBefore,
          `${historyActionPrefix}_${permissionLevel}`,
          approver.id,
          action === 'REJECT' ? rejectionReason : undefined,
        );

        return savedEvaluation;
      },
    );
  }

  async approveObjectiveEvaluationBySection(
    evaluationId: number,
    approver: Employee,
  ): Promise<PerformanceObjectiveEvaluation> {
    return this.processApprovalOrRejection(
      evaluationId,
      approver,
      'APPROVE',
      ObjectiveEvaluationStatus.PENDING_SECTION_APPROVAL,
      ObjectiveEvaluationStatus.PENDING_DEPT_APPROVAL,
      ObjectiveEvaluationStatus.REJECTED_BY_SECTION,
      ObjectiveEvaluationStatus.REJECTED_BY_MANAGER,
      'SECTION',
      'APPROVE',
    );
  }
  async rejectObjectiveEvaluationBySection(
    evaluationId: number,
    approver: Employee,
    dto: RejectObjectiveEvaluationDto,
  ): Promise<PerformanceObjectiveEvaluation> {
    return this.processApprovalOrRejection(
      evaluationId,
      approver,
      'REJECT',
      ObjectiveEvaluationStatus.PENDING_SECTION_APPROVAL,
      ObjectiveEvaluationStatus.PENDING_DEPT_APPROVAL,
      ObjectiveEvaluationStatus.REJECTED_BY_SECTION,
      ObjectiveEvaluationStatus.REJECTED_BY_MANAGER,
      'SECTION',
      'REJECT',
      dto.reason,
    );
  }
  async approveObjectiveEvaluationByDepartment(
    evaluationId: number,
    approver: Employee,
  ): Promise<PerformanceObjectiveEvaluation> {
    return this.processApprovalOrRejection(
      evaluationId,
      approver,
      'APPROVE',
      ObjectiveEvaluationStatus.PENDING_DEPT_APPROVAL,
      ObjectiveEvaluationStatus.PENDING_MANAGER_APPROVAL,
      ObjectiveEvaluationStatus.REJECTED_BY_DEPT,
      ObjectiveEvaluationStatus.REJECTED_BY_MANAGER,
      'DEPARTMENT',
      'APPROVE',
    );
  }
  async rejectObjectiveEvaluationByDepartment(
    evaluationId: number,
    approver: Employee,
    dto: RejectObjectiveEvaluationDto,
  ): Promise<PerformanceObjectiveEvaluation> {
    return this.processApprovalOrRejection(
      evaluationId,
      approver,
      'REJECT',
      ObjectiveEvaluationStatus.PENDING_DEPT_APPROVAL,
      ObjectiveEvaluationStatus.PENDING_MANAGER_APPROVAL,
      ObjectiveEvaluationStatus.REJECTED_BY_DEPT,
      ObjectiveEvaluationStatus.REJECTED_BY_MANAGER,
      'DEPARTMENT',
      'REJECT',
      dto.reason,
    );
  }
  async approveObjectiveEvaluationByManager(
    evaluationId: number,
    approver: Employee,
  ): Promise<PerformanceObjectiveEvaluation> {
    return this.processApprovalOrRejection(
      evaluationId,
      approver,
      'APPROVE',
      ObjectiveEvaluationStatus.PENDING_MANAGER_APPROVAL,
      ObjectiveEvaluationStatus.APPROVED,
      ObjectiveEvaluationStatus.REJECTED_BY_MANAGER,
      ObjectiveEvaluationStatus.REJECTED_BY_MANAGER,
      'MANAGER',
      'APPROVE',
    );
  }
  async rejectObjectiveEvaluationByManager(
    evaluationId: number,
    approver: Employee,
    dto: RejectObjectiveEvaluationDto,
  ): Promise<PerformanceObjectiveEvaluation> {
    return this.processApprovalOrRejection(
      evaluationId,
      approver,
      'REJECT',
      ObjectiveEvaluationStatus.PENDING_MANAGER_APPROVAL,
      ObjectiveEvaluationStatus.APPROVED,
      ObjectiveEvaluationStatus.REJECTED_BY_MANAGER,
      ObjectiveEvaluationStatus.REJECTED_BY_MANAGER,
      'MANAGER',
      'REJECT',
      dto.reason,
    );
  }

  async getObjectiveEvaluationHistory(
    evaluationId: number,
  ): Promise<PerformanceObjectiveEvaluationHistory[]> {
    return this.objectiveEvaluationHistoryRepository.find({
      where: { performance_objective_evaluation_id: evaluationId },
      relations: ['changedBy'],
      order: { changed_at: 'DESC' },
    });
  }

  private async logObjectiveEvaluationWorkflowHistory(
    entityManager: EntityManager,
    evaluation: PerformanceObjectiveEvaluation,
    statusBefore: ObjectiveEvaluationStatus | null | undefined,
    action: string,
    changedById: number,
    reason?: string,
  ): Promise<void> {
    const historyRepo = entityManager.getRepository(
      PerformanceObjectiveEvaluationHistory,
    );
    const historyEntry = historyRepo.create({
      performance_objective_evaluation_id: evaluation.id,
      status_before: statusBefore ?? null,
      status_after: evaluation.status,
      action: action,
      changed_by_id: changedById,
      reason: reason ?? null,
      changed_at: new Date(),
    });
    await historyRepo.save(historyEntry);
  }
}
