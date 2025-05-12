import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
  EntityManager,
  In,
} from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter'; // Thêm import này
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
  ReviewHistoryItemDto,
  ReviewHistoryResponseDto,
} from './dto/evaluation.dto';
import { OverallReviewStatus } from '../entities/overall-review.entity';
import { KpiValueStatus } from '../entities/kpi-value.entity';

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
    private readonly eventEmitter: EventEmitter2, // Inject EventEmitter
  ) {}

  async getReviewableTargets(
    currentUser: Employee,
  ): Promise<ReviewableTargetDto[]> {
    this.logger.debug(
      `[getReviewableTargets] Called by user: ${currentUser.id}`,
    );
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
          name: `${e.first_name} ${e.last_name} (${e.username})`,
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
              name: `${e.first_name} ${e.last_name} (${e.username})`,
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
              name: `${e.first_name} ${e.last_name} (${e.username})`,
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
              name: `${e.first_name} ${e.last_name} (${e.username})`,
              type: 'employee',
            });
          }
        });
      }
    }
    return reviewableTargets;
  }

  async getReviewCycles(currentUser: Employee): Promise<ReviewCycleDto[]> {
    this.logger.debug(`[getReviewCycles] Called by user: ${currentUser.id}`);

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
    this.logger.debug(
      `[getKpisForReview - ENTRY] Called by (simulated/actual) user ID: ${currentUser.id} for target ${targetType}:${targetId}, cycle: ${cycleId}`,
    );

    this.logger.debug(
      `[getKpisForReview] Called by user: ${currentUser.id} for target ${targetType}:${targetId}, cycle: ${cycleId}`,
    );

    const reviewableTargetsForCurrentUser =
      await this.getReviewableTargets(currentUser);
    const isAllowedToReviewTarget = reviewableTargetsForCurrentUser.some(
      (rt) => rt.id === targetId && rt.type === targetType,
    );
    this.logger.debug(
      `[getKpisForReview] reviewableTargetsForCurrentUser (for user ${currentUser.id}): ${JSON.stringify(reviewableTargetsForCurrentUser.map((rt) => rt.id + '-' + rt.type))}`,
    );
    this.logger.debug(
      `[getKpisForReview] Checking if user ${currentUser.id} can review ${targetType}:${targetId}. Result: ${isAllowedToReviewTarget}`,
    );

    if (!isAllowedToReviewTarget) {
      this.logger.warn(
        `[getKpisForReview] User ${currentUser.id} (${currentUser.role}) is not authorized to review target ${targetType}:${targetId}.`,
      );
      throw new UnauthorizedException(
        'You are not authorized to review KPIs for this target.',
      );
    }
    let assignments: KPIAssignment[] = [];

    const { startDate, endDate } = this.getDateRangeFromCycleId(cycleId);
    if (!startDate || !endDate) {
      this.logger.warn(
        `[getKpisForReview] Invalid cycleId or unable to parse: ${cycleId}`,
      );
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

    if (!assignments || assignments.length === 0) {
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
    this.logger.debug(`Parsing cycleId: ${cycleId}`);
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
    this.logger.debug(
      `[submitKpiReview] Called by user: ${currentUser.id} for target ${reviewData.targetType}:${reviewData.targetId}, cycle: ${reviewData.cycleId}`,
    );

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

    if (!reviewData.kpiReviews || reviewData.kpiReviews.length === 0) {
      this.logger.warn('[submitKpiReview] No KPI reviews provided.');
    }

    const { startDate, endDate } = this.getDateRangeFromCycleId(
      reviewData.cycleId,
    );
    if (!startDate || !endDate) {
      this.logger.warn(
        `[submitKpiReview] Invalid cycleId or unable to parse for validation: ${reviewData.cycleId}`,
      );
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
    if (validAssignmentIds.size === 0 && reviewData.kpiReviews.length > 0) {
      this.logger.warn(
        `[submitKpiReview] No valid assignments found for target ${reviewData.targetType}:${reviewData.targetId} in cycle ${reviewData.cycleId}, but reviews were submitted.`,
      );
    }

    let savedOverallReview: OverallReview | null = null;
    await this.kpiReviewRepository.manager.transaction(
      async (transactionalEntityManager: EntityManager) => {
        for (const kpiReviewItem of reviewData.kpiReviews) {
          if (
            kpiReviewItem.assignmentId === null ||
            kpiReviewItem.assignmentId === undefined
          ) {
            this.logger.warn(
              `[submitKpiReview] Skipping review item with null/undefined assignmentId.`,
            );
            continue;
          }

          if (!validAssignmentIds.has(kpiReviewItem.assignmentId)) {
            this.logger.warn(
              `[submitKpiReview] Attempted to submit review for assignmentId ${kpiReviewItem.assignmentId} which does not belong to target ${reviewData.targetType}:${reviewData.targetId} in cycle ${reviewData.cycleId}. Skipping.`,
            );
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
    this.logger.log(
      `Review submitted successfully for target ${reviewData.targetType}:${reviewData.targetId}, cycle ${reviewData.cycleId} by user ${currentUser.id}`,
    );

    // Phát sự kiện khi quản lý submit review và trạng thái là EMPLOYEE_FEEDBACK_PENDING
    // Explicitly check for null and then access properties
    if (savedOverallReview) {
      // This also checks for null/undefined
      // Re-assign to a new const with explicit type to help TS
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
    this.logger.debug(
      `[completeOverallReview] Called by user: ${currentUser.id} for target ${completeReviewDto.targetType}:${completeReviewDto.targetId}, cycle: ${completeReviewDto.cycleId}`,
    );

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

    // Phát sự kiện khi review được hoàn tất
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
    this.logger.debug(
      `[getEmployeeReviewDetails - ENTRY] Called by actual employee: ${employee.id} (${employee.username}) for cycle: ${cycleId}`,
    );

    this.logger.debug(
      `[getEmployeeReviewDetails] Called by employee: ${employee.id} for cycle: ${cycleId}`,
    );

    const overallReviewRecord = await this.overallReviewRepository.findOne({
      where: {
        targetId: employee.id,
        targetType: 'employee',
        cycleId: cycleId,
      },
    });
    this.logger.debug(
      `[getEmployeeReviewDetails] Found overallReviewRecord: ${overallReviewRecord ? overallReviewRecord.id : 'null'}`,
    );

    if (!overallReviewRecord) {
      this.logger.warn(
        `[getEmployeeReviewDetails] No overall review found for employee ${employee.id}, cycle ${cycleId}`,
      );
      const emptyResponse: EmployeeReviewResponseDto = {
        kpisReviewedByManager: [],
        overallReviewByManager: null,
      };
      return emptyResponse;
    }

    const managerWhoReviewedId = overallReviewRecord.reviewedById;
    this.logger.debug(
      `[getEmployeeReviewDetails] managerWhoReviewedId from overallReviewRecord: ${managerWhoReviewedId}`,
    );

    const managerWhoReviewed = await this.employeeRepository.findOne({
      where: { id: managerWhoReviewedId },
    });

    if (!managerWhoReviewed) {
      this.logger.error(
        `[getEmployeeReviewDetails] Manager (reviewer) with ID ${managerWhoReviewedId} not found. Returning DTO with error indication.`,
      );
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
    this.logger.debug(
      `[submitEmployeeFeedback] Called by employee: ${employee.id} for cycle: ${feedbackDto.cycleId}`,
    );

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

    this.logger.log(
      `Employee feedback submitted for review ID ${updatedReview.id} by employee ${employee.id}`,
    );

    // Phát sự kiện khi nhân viên gửi phản hồi
    this.eventEmitter.emit('overall_review.employee_responded', {
      overallReview: updatedReview,
      employee: employee, // Nhân viên gửi phản hồi
    });
    return updatedReview;
  }

  async getReviewHistory(
    currentUser: Employee,
    targetId: number,
    targetType: 'employee' | 'section' | 'department',
  ): Promise<ReviewHistoryResponseDto> {
    this.logger.debug(
      `[getReviewHistory] Called by user ${currentUser.id} for target ${targetType}:${targetId}`,
    );

    // Permission Check:
    // 1. If employee, can only view their own history.
    // 2. If manager/admin, can view history of targets they are allowed to review.
    let canViewHistory = false;
    if (targetType === 'employee' && currentUser.id === targetId) {
      canViewHistory = true; // Employee viewing their own history
    } else if (['admin', 'manager'].includes(currentUser.role)) {
      const reviewableTargets = await this.getReviewableTargets(currentUser);
      canViewHistory = reviewableTargets.some(
        (rt) => rt.id === targetId && rt.type === targetType,
      );
    }
    // Add more specific roles like 'department' or 'section' head if they can view history of their units

    if (!canViewHistory) {
      throw new UnauthorizedException(
        'You are not authorized to view the review history for this target.',
      );
    }

    // Fetch all overall reviews for the target, ordered by cycleId or createdAt
    const overallReviews = await this.overallReviewRepository.find({
      where: {
        targetId: targetId,
        targetType: targetType,
      },
      relations: ['reviewedBy'], // Eager load the reviewer (manager)
      order: {
        cycleId: 'DESC', // Or createdAt: 'DESC'
        // Consider how cycleId is structured for sorting (e.g., '2023-Q4' vs '2023-Year')
        // If cycleId is not easily sortable, sort by createdAt or updatedAt of OverallReview
        createdAt: 'DESC',
      },
    });

    if (!overallReviews || overallReviews.length === 0) {
      return []; // No history found
    }

    return overallReviews.map((or) => ({
      overallReviewId: or.id,
      cycleId: or.cycleId,
      overallComment: or.overallComment,
      overallScore: or.overallScore,
      status: or.status,
      reviewedByUsername: or.reviewedBy?.username || '', // Get username from related reviewedBy
      reviewedAt: or.updatedAt, // Or createdAt, depending on your logic
      employeeComment: or.employeeComment,
      employeeFeedbackDate: or.employeeFeedbackDate,
    }));
  }
}
