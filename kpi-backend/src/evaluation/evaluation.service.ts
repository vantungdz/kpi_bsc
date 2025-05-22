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
import {
  RBAC_ACTIONS,
  RBAC_RESOURCES,
  RBAC_PERMISSION_PAIRS,
  ROLES,
} from '../common/rbac/rbac.constants';

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
    private readonly entityManager: EntityManager,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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
    const roleName = typeof currentUser.role === 'string' ? currentUser.role : currentUser.role?.name;

    reviewableTargets.push({
      id: currentUser.id,
      name: `${currentUser.first_name} ${currentUser.last_name}`.trim(),
      type: 'employee',
    });

    if (roleName === 'admin') {
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
    } else if (roleName === 'manager') {
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
    } else if (roleName === 'department') {
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
    } else if (roleName === 'section') {
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
            kv.timestamp <= endDate
        );
        let filteredKpiValues =
          approvedInCycle.length > 0
            ? approvedInCycle
            : assignment.kpiValues.filter(
                (kv) => kv.status === KpiValueStatus.APPROVED
              );
        relevantKpiValue = filteredKpiValues.sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
        )[0];
      }
      const actualValue = relevantKpiValue ? relevantKpiValue.value : null;

      // Tìm review của manager (section/department/manager)
      const existingReview = assignment.reviews?.find(
        (review) =>
          review.reviewedBy?.id === currentUser.id &&
          review.cycleId === cycleId
      );

      // Tìm review của employee (self review)
      const employeeReview = assignment.reviews?.find(
        (review) =>
          review.reviewedBy?.id === assignment.assigned_to_employee &&
          review.cycleId === cycleId
      );

      // Tìm review của section
      const sectionReview = assignment.reviews?.find(
        (review) => review.reviewedBy?.role?.name === 'section' && review.cycleId === cycleId
      );

      const kpiToReview = {
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
        sectionComment: sectionReview?.managerComment || null,
        sectionScore: sectionReview?.managerScore || null,
        selfScore: employeeReview?.selfScore ?? null,
        selfComment: employeeReview?.selfComment ?? null,
      };

      kpisToReview.push(kpiToReview);
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

    let existingOverallReviewData: ExistingOverallReviewDto | null = {
      overallComment: null,
      status: OverallReviewStatus.PENDING_REVIEW,
      employeeComment: null,
      employeeFeedbackDate: null,
      totalWeightedScoreSupervisor: 0,
    };

    if (targetType === 'department') {
      // Check if there are any section reviews
      const hasSectionReviews = assignments.some((assignment) =>
        assignment.reviews?.some((review) =>
          review.reviewedBy?.role?.name === 'section' && review.cycleId === cycleId
        )
      );

      console.log("[getKpisForReview] Section reviews detected for department:", hasSectionReviews);

      if (hasSectionReviews) {
        existingOverallReviewData.status = OverallReviewStatus.DEPARTMENT_REVIEW_PENDING;
      } else {
        existingOverallReviewData.status = OverallReviewStatus.PENDING_REVIEW;
      }
    }

    if (currentUser.role?.name === 'department') {
      // Ensure the status is DEPARTMENT_REVIEW_PENDING if section reviews exist
      const hasSectionReviews = assignments.some((assignment) =>
        assignment.reviews?.some((review) =>
          review.reviewedBy?.role?.name === 'section' && review.cycleId === cycleId
        )
      );

      console.log("[getKpisForReview] Department role detected. Section reviews exist:", hasSectionReviews);

      if (hasSectionReviews) {
        existingOverallReviewData.status = OverallReviewStatus.DEPARTMENT_REVIEW_PENDING;
      } else {
        existingOverallReviewData.status = OverallReviewStatus.PENDING_REVIEW;
      }
    }

    console.log("[getKpisForReview] Final status for department role:", existingOverallReviewData.status);

    const overallReviewRecord = await this.overallReviewRepository.findOne({
      where: {
        targetId: targetId,
        reviewedById: currentUser.id,
      },
    });

    console.log("[getKpisForReview] Retrieved overallReviewRecord:", overallReviewRecord);

    if (!overallReviewRecord && targetType === 'department') {
      // Debugging: Log assignments and section reviews
      console.log("[getKpisForReview] Checking for section reviews in assignments:", assignments);

      // Ensure the status is set to DEPARTMENT_REVIEW_PENDING if section reviews exist
      const hasSectionReviews = assignments.some((assignment) =>
        assignment.reviews?.some((review) =>
          review.reviewedBy?.role?.name === 'section' && review.cycleId === cycleId
        )
      );

      console.log("[getKpisForReview] Section reviews detected:", hasSectionReviews);

      if (hasSectionReviews) {
        console.log("[getKpisForReview] Setting status to DEPARTMENT_REVIEW_PENDING due to section reviews.");
        existingOverallReviewData.status = OverallReviewStatus.DEPARTMENT_REVIEW_PENDING;
      } else {
        console.log("[getKpisForReview] No section reviews found. Keeping status as PENDING_REVIEW.");
        existingOverallReviewData.status = OverallReviewStatus.PENDING_REVIEW;
      }
    }

    if (overallReviewRecord) {
      console.log("[getKpisForReview] Found overallReviewRecord with status:", overallReviewRecord.status);
      existingOverallReviewData = {
        overallComment: overallReviewRecord.overallComment,
        status: existingOverallReviewData.status === OverallReviewStatus.DEPARTMENT_REVIEW_PENDING
          ? OverallReviewStatus.DEPARTMENT_REVIEW_PENDING
          : (overallReviewRecord?.status || OverallReviewStatus.PENDING_REVIEW),
        employeeComment: overallReviewRecord.employeeComment,
        employeeFeedbackDate: overallReviewRecord.employeeFeedbackDate,
        totalWeightedScoreSupervisor,
      };
    } else {
      console.log("[getKpisForReview] No overallReviewRecord found. Current status:", existingOverallReviewData.status);
      // Ensure the status remains DEPARTMENT_REVIEW_PENDING if applicable
      if (existingOverallReviewData.status === OverallReviewStatus.DEPARTMENT_REVIEW_PENDING) {
        existingOverallReviewData.status = OverallReviewStatus.DEPARTMENT_REVIEW_PENDING;
      }
    }

    console.log("[getKpisForReview] existingOverallReviewData.status:", existingOverallReviewData.status);

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

          // Ensure no new reviews are created in KpiReview
          if (!reviewRecord && reviewData.targetType !== 'employee') {
            throw new UnauthorizedException(
              'Creating new KPI reviews is not allowed in KpiReview.'
            );
          }

          // Allow creating new reviews only for MyKpiReview (targetType: 'employee')
          if (!reviewRecord && reviewData.targetType === 'employee') {
            reviewRecord = transactionalEntityManager.create(KpiReview, {
              assignment: { id: kpiReviewItem.assignmentId },
              reviewedBy: { id: currentUser.id },
              cycleId: reviewData.cycleId,
              managerComment: kpiReviewItem.managerComment ?? null,
              managerScore: kpiReviewItem.managerScore ?? null,
            });
          }

          if (reviewData.targetType === 'section' && currentUser.role?.name === 'section') {
            if (!reviewRecord) {
              reviewRecord = transactionalEntityManager.create(KpiReview, {
                assignment: { id: kpiReviewItem.assignmentId },
                reviewedBy: { id: currentUser.id },
                cycleId: reviewData.cycleId,
                managerComment: kpiReviewItem.managerComment ?? null,
                managerScore: kpiReviewItem.managerScore ?? null,
              });
            } else {
              reviewRecord.managerComment = kpiReviewItem.managerComment ?? null;
              reviewRecord.managerScore = kpiReviewItem.managerScore ?? null;
            }
          
            // Update the status to indicate the review is forwarded to the department
            let overallReviewRecord = await transactionalEntityManager.findOne(OverallReview, {
              where: {
                targetId: reviewData.targetId,
                targetType: 'section',
                cycleId: reviewData.cycleId,
              },
            });
          
            if (overallReviewRecord) {
              overallReviewRecord.status = OverallReviewStatus.DEPARTMENT_REVIEW_PENDING;
              await transactionalEntityManager.save(OverallReview, overallReviewRecord);
            }
          }

          if (reviewRecord) {
            reviewRecord.managerComment = kpiReviewItem.managerComment ?? null;
            reviewRecord.managerScore = kpiReviewItem.managerScore ?? null;
          }
          if (reviewRecord) {
            await transactionalEntityManager.save(KpiReview, reviewRecord);
          }
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

          // Check if an existing overall review from 'section' can be reused
          if (!overallReviewRecord && reviewData.targetType === 'department') {
            overallReviewRecord = await transactionalEntityManager.findOne(
              OverallReview,
              {
                where: {
                  targetId: reviewData.targetId,
                  targetType: 'section',
                  cycleId: reviewData.cycleId,
                },
              },
            );

            if (overallReviewRecord) {
              console.log("[submitKpiReview] Reusing overall review from section for department.");
              overallReviewRecord.reviewedById = currentUser.id;
              overallReviewRecord.targetType = 'department';
            }
          }

          let newStatus = OverallReviewStatus.PENDING_REVIEW;
          const roleName = typeof currentUser.role === 'string' ? currentUser.role : currentUser.role?.name;
          if (roleName === 'section') {
            newStatus = OverallReviewStatus.DEPARTMENT_REVIEW_PENDING;
          } else if (roleName === 'department') {
            const sectionReviewsExist = await transactionalEntityManager.count(KpiReview, {
              where: {
                assignment: { id: reviewData.targetId },
                cycleId: reviewData.cycleId,
                reviewedBy: { role: { name: 'section' } },
              },
            });

            console.log("[submitKpiReview] Section reviews exist:", sectionReviewsExist);

            if (sectionReviewsExist > 0) {
              newStatus = OverallReviewStatus.DEPARTMENT_REVIEW_PENDING;
            } else {
              newStatus = OverallReviewStatus.MANAGER_REVIEW_PENDING;
            }
          } else if (roleName === 'manager' || roleName === 'admin') {
            newStatus = OverallReviewStatus.EMPLOYEE_FEEDBACK_PENDING;
          }

          if (overallReviewRecord) {
            // Ensure DEPARTMENT_REVIEW_PENDING is retained if section reviews exist
            if (
              newStatus === OverallReviewStatus.MANAGER_REVIEW_PENDING &&
              overallReviewRecord.status === OverallReviewStatus.DEPARTMENT_REVIEW_PENDING
            ) {
              const sectionReviewsExist = await transactionalEntityManager.count(KpiReview, {
                where: {
                  assignment: { id: reviewData.targetId },
                  cycleId: reviewData.cycleId,
                },
              });

              if (sectionReviewsExist > 0) {
                newStatus = OverallReviewStatus.DEPARTMENT_REVIEW_PENDING;
              }
            }

            overallReviewRecord.overallComment = reviewData.overallComment ?? null;
            overallReviewRecord.status = newStatus;
            overallReviewRecord.totalWeightedScore =
              totalWeightedScore !== null ? totalWeightedScore.toFixed(2) : null;
          } else {
            overallReviewRecord = transactionalEntityManager.create(OverallReview, {
              targetId: reviewData.targetId,
              targetType: reviewData.targetType,
              cycleId: reviewData.cycleId,
              reviewedById: currentUser.id,
              overallComment: reviewData.overallComment ?? null,
              status: newStatus,
              totalWeightedScore:
                totalWeightedScore !== null ? totalWeightedScore.toFixed(2) : null,
            });
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
      if (overallReview.status === OverallReviewStatus.DRAFT) {
        overallReview.status = OverallReviewStatus.PENDING_REVIEW;
        await em.save(OverallReview, overallReview);
      }
    });
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
    const { startDate, endDate } = this.getDateRangeFromCycleId(cycleId);
    if (!startDate || !endDate) {
      throw new BadRequestException('Invalid review cycle for validation.');
    }

    const assignments = await this.assignmentRepository.find({
      where: {
        assigned_to_employee: employee.id,
        startDate: LessThanOrEqual(endDate),
        endDate: MoreThanOrEqual(startDate),
      },
      relations: [
        'kpi',
        'kpiValues',
        'reviews',
        'reviews.reviewedBy',
        'reviews.reviewedBy.role', // Ensure the role relation is loaded
      ],
    });

    const kpisReviewedByManager = assignments
      .filter((assignment) => assignment.kpi)
      .map((assignment) => {
        const approvedKpiValues = assignment.kpiValues.filter(
          (kv) => kv.status === KpiValueStatus.APPROVED
        );

        const latestApprovedValue = approvedKpiValues.sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
        )[0];

        // Log toàn bộ dữ liệu của assignment.reviews trước khi lọc
        console.log('All Reviews for Assignment:', assignment.reviews);

        // Cập nhật logic xác định Manager Review
        const managerReview = assignment.reviews.find((review) => {
          const hasPermission = this.hasPermissionToReview(review.reviewedBy, employee);
          const hasValidComment = review.managerComment !== null && review.managerComment !== undefined;
          const hasValidScore = review.managerScore !== null && review.managerScore !== undefined;

          if (!hasPermission) {
            console.warn(`Reviewer ${review.reviewedBy.id} does not have permission to review employee ${employee.id}`);
          }

          return hasPermission && hasValidComment && hasValidScore;
        });

        if (!managerReview) {
          console.warn(
            `No valid manager review found for assignmentId: ${assignment.id}, employeeId: ${employee.id}`
          );
        } else {
          console.log(
            `Manager Review Found: Comment - ${managerReview.managerComment}, Score - ${managerReview.managerScore}`
          );
        }

        // Log dữ liệu của selfReview
        const selfReview = assignment.reviews.find(
          (review) => review.reviewedBy.id === employee.id
        );
        console.log('Self Review Found:', selfReview);

        return {
          assignmentId: assignment.id,
          kpiId: assignment.kpi.id,
          kpiName: assignment.kpi.name,
          kpiDescription: assignment.kpi.description,
          targetValue: assignment.targetValue,
          actualValue: latestApprovedValue ? latestApprovedValue.value : null,
          unit: assignment.kpi.unit,
          weight: assignment.weight,
          existingManagerComment: managerReview?.managerComment || null,
          existingManagerScore: managerReview?.managerScore || null,
          selfScore: selfReview?.selfScore || null,
          selfComment: selfReview?.selfComment || null,
        };
      })
      .filter((kpi) => kpi.actualValue !== null);

    const overallReview = await this.overallReviewRepository.findOne({
      where: {
        targetId: employee.id,
        targetType: 'employee',
        cycleId,
      },
    });

    return {
      kpisReviewedByManager,
      overallReviewByManager: {
        overallComment: overallReview?.overallComment || null,
        status: overallReview?.status || OverallReviewStatus.DRAFT,
        employeeComment: overallReview?.employeeComment || null,
        employeeFeedbackDate: overallReview?.employeeFeedbackDate || null,
        totalWeightedScoreSupervisor: overallReview?.totalWeightedScore ? parseFloat(overallReview.totalWeightedScore) : 0,
      },
    };
  }

  private hasPermissionToReview(reviewer: Employee, employee: Employee): boolean {
    // Ensure the role is loaded
    if (!reviewer.role) {
      console.warn(`Reviewer ${reviewer.id} does not have a role loaded.`);
      return false;
    }

    // Check if the reviewer has permission to view KPI reviews
    const hasPermission = RBAC_PERMISSION_PAIRS.some(
      (pair) =>
        pair.action === RBAC_ACTIONS.VIEW &&
        pair.resource === RBAC_RESOURCES.KPI_REVIEW &&
        reviewer.role.name === pair.resource
    );

    // Allow self-review for admin and manager roles
    const isSelfReview = reviewer.id === employee.id && [ROLES.ADMIN, ROLES.MANAGER].includes(reviewer.role.name);

    return hasPermission || isSelfReview;
  }

  async submitEmployeeFeedback(
    employee: Employee,
    feedbackDto: SubmitEmployeeFeedbackDto,
  ): Promise<OverallReview> {
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
    const roleName = typeof currentUser.role === 'string' ? currentUser.role : currentUser.role?.name;
    if (targetType === 'employee' && currentUser.id === targetId) {
      canViewHistory = true;
    } else if (['admin', 'manager'].includes(roleName)) {
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
    const roleName = typeof currentUser.role === 'string' ? currentUser.role : currentUser.role?.name;
    if (roleName === 'admin') {
      employees = await this.employeeRepository.find({
        relations: ['department'],
      });
    } else if (roleName === 'manager' || roleName === 'department') {
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
    const roleName = typeof currentUser.role === 'string' ? currentUser.role : currentUser.role?.name;
    if (
      !['section', 'admin', 'manager'].includes(roleName) ||
      (roleName === 'section' &&
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
    const roleName = typeof currentUser.role === 'string' ? currentUser.role : currentUser.role?.name;
    if (
      !['section', 'admin', 'manager'].includes(roleName) ||
      (roleName === 'section' &&
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
    const roleName = typeof currentUser.role === 'string' ? currentUser.role : currentUser.role?.name;
    if (
      !['department', 'admin', 'manager'].includes(roleName) ||
      (roleName === 'department' &&
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
    const roleName = typeof currentUser.role === 'string' ? currentUser.role : currentUser.role?.name;
    if (
      !['department', 'admin', 'manager'].includes(roleName) ||
      (roleName === 'department' &&
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
    const roleName = typeof currentUser.role === 'string' ? currentUser.role : currentUser.role?.name;
    if (!['manager', 'admin'].includes(roleName)) {
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
    const roleName = typeof currentUser.role === 'string' ? currentUser.role : currentUser.role?.name;
    if (!['manager', 'admin'].includes(roleName)) {
      throw new UnauthorizedException(
        'You do not have permission to reject this review at manager level',
      );
    }
    review.status = OverallReviewStatus.DEPARTMENT_REVISE_REQUIRED;
    if (reason)
      review.overallComment = `[MANAGER REJECTED]: ${reason}\n${review.overallComment || ''}`;
    return this.overallReviewRepository.save(review);
  }

  async getEmployeeReviewsListForManager(
    manager: Employee,
    cycleId: string,
  ): Promise<EmployeeReviewResponseDto[]> {
    let employees: Employee[] = [];
    const roleName = typeof manager.role === 'string' ? manager.role : manager.role?.name;
    if (roleName === 'admin') {
      employees = await this.employeeRepository.find();
    } else if (roleName === 'manager' && manager.departmentId) {
      employees = await this.employeeRepository.find({
        where: { departmentId: manager.departmentId },
      });
    } else {
      return [];
    }
    const results: EmployeeReviewResponseDto[] = [];
    for (const emp of employees) {
      if (emp.id === manager.id) continue;
      try {
        const review = await this.getEmployeeReviewDetails(emp, cycleId);
        (review as any).employee = {
          id: emp.id,
          fullName: `${emp.first_name} ${emp.last_name}`.trim(),
          department: emp.departmentId,
        };
        results.push(review);
      } catch (e) {
      }
    }
    return results;
  }

  async getManagedEmployeeOverallReviews(
    currentUser: Employee,
    statusList?: string[],
  ) {
    const qb = this.overallReviewRepository.createQueryBuilder('review')
      .leftJoinAndSelect('review.reviewedBy', 'reviewedBy');

    if (statusList && statusList.length > 0) {
      qb.andWhere('review.status IN (:...statusList)', { statusList });
    }
    qb.andWhere('review.status != :completedStatus', { completedStatus: 'COMPLETED' });
    qb.andWhere(qb2 => {
      const subQuery = qb2.subQuery()
        .select('MAX(subReview.updatedAt)')
        .from('overall_reviews', 'subReview')
        .where('subReview.targetId = review.targetId')
        .andWhere('subReview.targetType = review.targetType')
        .andWhere('subReview.cycleId = review.cycleId')
        .getQuery();
      return 'review.updatedAt = ' + subQuery;
    });
    const overallReviews = await qb.getMany();

    // Filter: Only return OverallReview if ALL assignments in the cycle have at least one APPROVED KpiValue
    const filtered: OverallReview[] = [];
    for (const review of overallReviews) {
      // Find all assignments for this review's target in the cycle
      let assignments: KPIAssignment[] = [];
      if (review.targetType === 'employee') {
        assignments = await this.assignmentRepository.find({
          where: {
            assigned_to_employee: review.targetId,
            startDate: LessThanOrEqual(new Date(review.updatedAt)),
            endDate: MoreThanOrEqual(new Date(review.updatedAt)),
          },
          relations: ['kpiValues'],
        });
      } else if (review.targetType === 'section') {
        assignments = await this.assignmentRepository.find({
          where: {
            assigned_to_section: review.targetId,
            startDate: LessThanOrEqual(new Date(review.updatedAt)),
            endDate: MoreThanOrEqual(new Date(review.updatedAt)),
          },
          relations: ['kpiValues'],
        });
      } else if (review.targetType === 'department') {
        assignments = await this.assignmentRepository.find({
          where: {
            assigned_to_department: review.targetId,
            startDate: LessThanOrEqual(new Date(review.updatedAt)),
            endDate: MoreThanOrEqual(new Date(review.updatedAt)),
          },
          relations: ['kpiValues'],
        });
      }
      // If there are no assignments, skip
      if (!assignments.length) continue;
      // All assignments must have at least one APPROVED KpiValue
      const allHaveApproved = assignments.every(a =>
        Array.isArray(a.kpiValues) &&
        a.kpiValues.some(kv => kv.status === KpiValueStatus.APPROVED)
      );
      if (allHaveApproved) filtered.push(review);
    }
    return filtered;
  }
}


