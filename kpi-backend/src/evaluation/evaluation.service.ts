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
import { Employee } from '../entities/employee.entity';
import { Section } from '../entities/section.entity';
import { Department } from '../entities/department.entity';
import { KPIAssignment } from '../entities/kpi-assignment.entity';
import { KpiValue } from '../entities/kpi-value.entity';
import { KpiReview } from '../entities/kpi-review.entity'; // Assuming you have a KpiReview entity
import { OverallReview } from '../entities/overall-review.entity';
import {
  ReviewableTargetDto,
  ReviewCycleDto,
  KpiToReviewDto,
  SubmitKpiReviewDto,
  ExistingOverallReviewDto,
  KpisForReviewResponseDto,
} from './dto/evaluation.dto';
import { KpiValueStatus } from '../entities/kpi-value.entity'; // Adjusted import path

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
    @InjectRepository(KpiReview) // Inject KpiReview Repository
    private readonly kpiReviewRepository: Repository<KpiReview>,
    @InjectRepository(OverallReview) // Inject OverallReview Repository
    private readonly overallReviewRepository: Repository<OverallReview>,
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
      // Giả định Manager quản lý một hoặc nhiều Department.
      // Cần có cách xác định Department(s) mà Manager này quản lý.
      // Ví dụ: Nếu Employee entity có mảng managed_department_ids hoặc một quan hệ.
      // Hoặc, nếu manager cũng là department head, họ sẽ có department_id.
      // Tạm thời, nếu manager có department_id, coi như họ quản lý department đó.
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
            // Manager không tự review mình qua vai trò này
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
      // TODO: Mở rộng logic nếu manager quản lý nhiều department hoặc có cấu trúc phức tạp hơn.
    } else if (currentUser.role === 'department') {
      // Giả định đây là Department Head
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
      // Giả định đây là Section Lead
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
    const currentMonth = today.getMonth(); // 0-11 (Jan=0)
    const currentQuarter = Math.floor(currentMonth / 3) + 1;

    // 1. Current Quarter
    cycles.push({
      id: `${currentYear}-Q${currentQuarter}`,
      name: `Quý ${currentQuarter} - ${currentYear}`,
    });

    // 2. Previous Quarter
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

    // 3. Quarter before Previous Quarter
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

    // 4. Current Year
    cycles.push({ id: `${currentYear}-Year`, name: `Năm ${currentYear}` });

    // 5. Previous Year
    const previousYearVal = currentYear - 1;
    cycles.push({
      id: `${previousYearVal}-Year`,
      name: `Năm ${previousYearVal}`,
    });

    // 6. Q4 of Previous Year
    cycles.push({
      id: `${previousYearVal}-Q4`,
      name: `Quý 4 - ${previousYearVal}`,
    });

    // 7. Q3 of Previous Year
    cycles.push({
      id: `${previousYearVal}-Q3`,
      name: `Quý 3 - ${previousYearVal}`,
    });

    // Remove duplicates using a Map (keyed by id)
    const uniqueCycleMap = new Map<string, ReviewCycleDto>();
    cycles.forEach((cycle) => {
      if (!uniqueCycleMap.has(cycle.id)) {
        uniqueCycleMap.set(cycle.id, cycle);
      }
    });

    // Sort the unique cycles: Year descending, then 'Year' type after 'Qx' type, then Quarter descending
    return Array.from(uniqueCycleMap.values()).sort((a, b) => {
      const [yearA, periodTypeA] = a.id.split('-');
      const [yearB, periodTypeB] = b.id.split('-');
      const numYearA = parseInt(yearA);
      const numYearB = parseInt(yearB);

      if (numYearA !== numYearB) return numYearB - numYearA; // Newer years first

      const isQ_A = periodTypeA.startsWith('Q');
      const isQ_B = periodTypeB.startsWith('Q');

      if (isQ_A && !isQ_B) return -1; // Quarters before "Year"
      if (!isQ_A && isQ_B) return 1; // "Year" after Quarters

      if (isQ_A && isQ_B) {
        // Both are quarters
        const qNumA = parseInt(periodTypeA.substring(1));
        const qNumB = parseInt(periodTypeB.substring(1));
        return qNumB - qNumA; // Higher quarter number first (Q4, Q3, ...)
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
      `[getKpisForReview] Called by user: ${currentUser.id} for target ${targetType}:${targetId}, cycle: ${cycleId}`,
    );

    // 1. Permission Check: Can currentUser review this targetId/targetType?
    const reviewableTargetsForCurrentUser =
      await this.getReviewableTargets(currentUser);
    const isAllowedToReviewTarget = reviewableTargetsForCurrentUser.some(
      (rt) => rt.id === targetId && rt.type === targetType,
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

    // Define date range for the cycleId
    // This is a simplified example; you'll need a robust way to parse cycleId
    // (e.g., '2024-Q2', '2023-Year') into start and end dates.
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
          // Filter assignments that are active within the review cycle
          // Assumes KPIAssignment has start_date and end_date
          // An assignment is relevant if its period overlaps with the review cycle
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
      // Still try to fetch overall review even if no specific KPIs are assigned for review
    }

    const kpisToReview: KpiToReviewDto[] = [];

    for (const assignment of assignments) {
      if (!assignment.kpi) continue; // Skip if KPI definition is missing

      // Determine the correct actualValue for the cycle.
      // Find the latest KpiValue within the cycle's date range that has an 'approved' status.
      // Assumes KpiValue has a 'timestamp' (or created_at/updated_at) and 'status'
      let relevantKpiValue: KpiValue | undefined = undefined;
      if (assignment.kpiValues && assignment.kpiValues.length > 0) {
        relevantKpiValue = assignment.kpiValues
          .filter(
            (kv) =>
              kv.status === KpiValueStatus.APPROVED && // Or your final approved status
              kv.timestamp >= startDate && // Ensure KpiValue timestamp is within cycle
              kv.timestamp <= endDate,
          )
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]; // Get the latest
      }
      const actualValue = relevantKpiValue ? relevantKpiValue.value : null;

      // Find existing review by this currentUser for this assignment and cycle.
      const existingReview = assignment.reviews?.find(
        (review) =>
          review.reviewedBy?.id === currentUser.id && // Check against the ID of the related Employee
          review.cycleId === cycleId, // Make sure KpiReview entity has cycleId
      );

      kpisToReview.push({
        assignmentId: assignment.id,
        kpiId: assignment.kpi.id,
        kpiName: assignment.kpi.name,
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

    // Fetch existing overall review
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
      };
    }

    return {
      kpisToReview: kpisToReview,
      existingOverallReview: existingOverallReviewData,
    };
  }

  // Helper function to parse cycleId - THIS IS A SIMPLIFIED EXAMPLE
  private getDateRangeFromCycleId(cycleId: string): {
    startDate: Date | null;
    endDate: Date | null;
  } {
    // Example: '2024-Q2' -> startDate: 2024-04-01, endDate: 2024-06-30
    // Example: '2023-Year' -> startDate: 2023-01-01, endDate: 2023-12-31
    // You'll need to implement robust parsing based on your cycleId format.
    this.logger.debug(`Parsing cycleId: ${cycleId}`);
    if (cycleId.includes('-Year')) {
      const year = parseInt(cycleId.split('-')[0]);
      if (isNaN(year)) return { startDate: null, endDate: null };
      return {
        startDate: new Date(year, 0, 1), // First day of year
        endDate: new Date(year, 11, 31, 23, 59, 59, 999), // Last millisecond of year
      };
    } else if (cycleId.includes('-Q')) {
      const parts = cycleId.split('-Q');
      if (parts.length !== 2) return { startDate: null, endDate: null };
      const year = parseInt(parts[0]);
      const quarter = parseInt(parts[1]);

      if (isNaN(year) || isNaN(quarter) || quarter < 1 || quarter > 4) {
        return { startDate: null, endDate: null };
      }

      const startMonth = (quarter - 1) * 3; // Q1->0, Q2->3, Q3->6, Q4->9
      const endMonth = startMonth + 2; // Q1->2, Q2->5, Q3->8, Q4->11

      const sDate = new Date(year, startMonth, 1);
      // To get the last day of the endMonth, set day to 0 of the *next* month
      const eDate = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);

      return { startDate: sDate, endDate: eDate };
    }
    return { startDate: null, endDate: null };
  }

  async submitKpiReview(
    currentUser: Employee,
    reviewData: SubmitKpiReviewDto,
  ): Promise<void> {
    this.logger.debug(
      `[submitKpiReview] Called by user: ${currentUser.id} for target ${reviewData.targetType}:${reviewData.targetId}, cycle: ${reviewData.cycleId}`,
    );

    // 1. Permission Check
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

    // 2. Basic Validation (Controller already does some)
    if (!reviewData.kpiReviews || reviewData.kpiReviews.length === 0) {
      this.logger.warn('[submitKpiReview] No KPI reviews provided.');
      // Depending on requirements, this might not be an error if only overallComment is submitted
      // For now, we assume kpiReviews are expected if the array exists.
    }

    // Pre-fetch valid assignment IDs for the given target and cycle to validate against
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
      select: ['id'] as (keyof KPIAssignment)[], // Explicitly type as keys of KPIAssignment
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
      // Potentially throw an error or handle as per business logic
    }

    // 3. Database Operations within a Transaction
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

          // Validate if the assignmentId from the review item belongs to the target being reviewed
          if (!validAssignmentIds.has(kpiReviewItem.assignmentId)) {
            this.logger.warn(
              `[submitKpiReview] Attempted to submit review for assignmentId ${kpiReviewItem.assignmentId} which does not belong to target ${reviewData.targetType}:${reviewData.targetId} in cycle ${reviewData.cycleId}. Skipping.`,
            );
            continue; // Skip this review item
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
            // Update existing review
            reviewRecord.managerComment = kpiReviewItem.managerComment ?? null;
            reviewRecord.managerScore = kpiReviewItem.managerScore ?? null;
            // reviewRecord.updatedAt = new Date(); // Handled by @UpdateDateColumn
          } else {
            // Create new review
            reviewRecord = transactionalEntityManager.create(KpiReview, {
              assignment: { id: kpiReviewItem.assignmentId }, // TypeORM will handle relation by ID
              reviewedBy: { id: currentUser.id }, // TypeORM will handle relation by ID
              cycleId: reviewData.cycleId,
              managerComment: kpiReviewItem.managerComment ?? null,
              managerScore: kpiReviewItem.managerScore ?? null,
            });
          }
          await transactionalEntityManager.save(KpiReview, reviewRecord);
        }

        // Handle saving reviewData.overallComment and reviewData.overallScore
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
            // Update existing overall review
            overallReviewRecord.overallComment =
              reviewData.overallComment ?? null;
            overallReviewRecord.overallScore = reviewData.overallScore ?? null;
          } else {
            // Create new overall review
            overallReviewRecord = transactionalEntityManager.create(
              OverallReview,
              {
                targetId: reviewData.targetId,
                targetType: reviewData.targetType,
                cycleId: reviewData.cycleId,
                reviewedById: currentUser.id,
                overallComment: reviewData.overallComment ?? null,
                overallScore: reviewData.overallScore ?? null,
              },
            );
          }
          await transactionalEntityManager.save(
            OverallReview,
            overallReviewRecord,
          );
        }
      },
    );
    this.logger.log(
      `Review submitted successfully for target ${reviewData.targetType}:${reviewData.targetId}, cycle ${reviewData.cycleId} by user ${currentUser.id}`,
    );
  }
}
