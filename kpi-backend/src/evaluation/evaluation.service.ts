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
} from './dto/evaluation.dto';
import { SavePerformanceObjectivesDto } from './dto/save-performance-objectives.dto';
import { OverallReviewStatus } from '../entities/overall-review.entity';
import { RejectObjectiveEvaluationDto } from './dto/reject-objective-evaluation.dto';
import { KpiValueStatus } from '../entities/kpi-value.entity';
import { ObjectiveEvaluationStatus } from '../entities/objective-evaluation-status.enum';

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
        // Prefer APPROVED value in the cycle, fallback to latest APPROVED value if none in cycle
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
        weight: assignment.weight, // Thêm trường weight vào response
        existingManagerComment: existingReview
          ? existingReview.managerComment
          : null,
        existingManagerScore: existingReview
          ? existingReview.managerScore
          : null,
      });
    }

    // Tính tổng weighted score supervisor cho từng KPI đã review
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
    // Đổi kiểu trả về
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
          // Tính lại tổng weighted score cho overall review
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

    // Sau khi lưu xong, trả về lại dữ liệu giống getKpisForReview (bao gồm tổng weighted score)
    return this.getKpisForReview(
      currentUser,
      reviewData.targetId,
      reviewData.targetType,
      reviewData.cycleId,
    );
  }

  async completeOverallReview(
    currentUser: Employee,
    completeReviewDto: CompleteReviewDto,
  ): Promise<OverallReview> {
    console.log('===> completeOverallReview called', completeReviewDto);
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

    // Tính lại tổng weighted score khi hoàn tất review
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
    console.log(
      'Assignments for review:',
      assignments.length,
      assignments.map((a) => a.id),
    );
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
      console.log(
        'Assignment:',
        assignment.id,
        'Score:',
        score,
        'Weight:',
        weight,
      );
      if (
        score !== null &&
        weight !== null &&
        !isNaN(score) &&
        !isNaN(weight)
      ) {
        console.log('Adding to total:', score * weight);
        totalWeightedScore += score * weight;
      }
    }
    overallReviewRecord.totalWeightedScore =
      totalWeightedScore !== null ? totalWeightedScore.toFixed(2) : null;
    console.log(
      'Saving totalWeightedScore:',
      overallReviewRecord.totalWeightedScore,
    );
    await this.overallReviewRepository.save(overallReviewRecord);

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

    // Tính tổng weighted score supervisor
    let totalWeightedScoreSupervisor = 0;
    if (
      reviewDataFromManagerPerspective.kpisToReview &&
      Array.isArray(reviewDataFromManagerPerspective.kpisToReview)
    ) {
      for (const kpi of reviewDataFromManagerPerspective.kpisToReview) {
        const score = Number(kpi.existingManagerScore);
        // Nếu weight null/undefined hoặc chưa review thì bỏ qua
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
    // Lấy assignment và review giống logic getKpisForReview
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
      // Lấy review manager cho assignment này trong chu kỳ
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

    // Lấy trạng thái đánh giá: Đã chuyển sang lấy từ review/assignment mới, không còn lấy từ entity cũ
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
    // Lấy danh sách nhân viên thuộc quyền quản lý của user
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
      // Lấy trạng thái review tổng thể (OverallReviewStatus) cho nhân viên này trong chu kỳ
      let reviewStatus: string | undefined = undefined;
      let totalWeightedScore: number = 0;
      const overallReview = await this.overallReviewRepository.findOne({
        where: {
          targetId: emp.id,
          targetType: 'employee',
          cycleId: cycleId,
        },
      });
      console.log('overallReview', overallReview);
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
}
