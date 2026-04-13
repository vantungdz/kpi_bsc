import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository, DataSource, DeepPartial, Brackets } from 'typeorm';
import { KpiValue, KpiValueStatus } from './entities/kpi-value.entity';
import { KpiValueHistory } from './entities/kpi-value-history.entity';
import { KPIAssignment } from '../kpi-assessments/entities/kpi-assignment.entity';
import { Employee } from '../employees/entities/employee.entity';
import { userHasPermission } from '../common/utils/permission.utils';
import { KpiDefinitionStatus } from '../kpis/entities/kpi.entity';
import { getKpiStatus } from '../kpis/kpis.service';
import { ReviewCycle } from '../review-cycle/entities/review-cycle.entity';
import {
  EvaluationPhase,
  KpiReview,
  ReviewStatus,
} from '../evaluation/entities/kpi-review.entity';
import { resolveActiveEvaluationPhase } from '../evaluation/annual-review-score.util';
import { KpiReviewService } from '../evaluation/kpi-review.service';
import { RBAC_ACTIONS, RBAC_RESOURCES } from 'src/common/rbac/rbac.constants';

@Injectable()
export class KpiValuesService {
  private readonly logger = new Logger(KpiValuesService.name);

  constructor(
    private dataSource: DataSource,
    @InjectRepository(KpiValue)
    private kpiValuesRepository: Repository<KpiValue>,
    @InjectRepository(KpiValueHistory)
    private kpiValueHistoryRepository: Repository<KpiValueHistory>,
    @InjectRepository(KPIAssignment)
    private readonly kpiAssignmentRepository: Repository<KPIAssignment>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(ReviewCycle)
    private readonly reviewCycleRepository: Repository<ReviewCycle>,
    @InjectRepository(KpiReview)
    private readonly kpiReviewRepository: Repository<KpiReview>,
    private readonly kpiReviewService: KpiReviewService,
    private eventEmitter: EventEmitter2,
  ) {}

  private async resolveEvaluationPhaseWithRepo(
    repo: Repository<KpiReview>,
    assignmentId: number,
    cycle: string,
  ): Promise<EvaluationPhase> {
    const mid = await repo.findOne({
      where: {
        assignment: { id: assignmentId },
        cycle,
        evaluationPhase: EvaluationPhase.MID_YEAR,
      },
    });
    const yearEnd = await repo.findOne({
      where: {
        assignment: { id: assignmentId },
        cycle,
        evaluationPhase: EvaluationPhase.YEAR_END,
      },
    });
    return (
      resolveActiveEvaluationPhase(mid, yearEnd) ?? EvaluationPhase.MID_YEAR
    );
  }

  /**
   * Helper method để tìm ReviewCycle có date range overlap với KPI date range
   * @param kpiStartDate - Ngày bắt đầu của KPI
   * @param kpiEndDate - Ngày kết thúc của KPI
   * @returns Cycle ID (string) hoặc null nếu không tìm thấy
   */
  private async findOverlappingCycleId(
    kpiStartDate: Date | string | null,
    kpiEndDate: Date | string | null,
  ): Promise<string | null> {
    if (!kpiStartDate || !kpiEndDate) {
      return null;
    }

    try {
      const kpiStart = new Date(kpiStartDate);
      const kpiEnd = new Date(kpiEndDate);

      if (isNaN(kpiStart.getTime()) || isNaN(kpiEnd.getTime())) {
        return null;
      }

      // Lấy tất cả review cycles
      const allCycles = await this.reviewCycleRepository.find({
        order: { startDate: 'DESC' }, // Lấy cycle mới nhất trước
      });

      // Tìm cycle có date range overlap
      // Logic overlap: kpiStart <= cycleEnd && kpiEnd >= cycleStart
      const overlappingCycles = allCycles.filter((cycle) => {
        const cycleStart = new Date(cycle.startDate);
        const cycleEnd = new Date(cycle.endDate);

        if (isNaN(cycleStart.getTime()) || isNaN(cycleEnd.getTime())) {
          return false;
        }

        return kpiStart <= cycleEnd && kpiEnd >= cycleStart;
      });

      if (overlappingCycles.length === 0) {
        this.logger.warn(
          `No review cycle found overlapping with KPI date range: ${kpiStartDate} to ${kpiEndDate}`,
        );
        return null;
      }

      // Nếu có nhiều cycles overlap, chọn cycle đầu tiên (mới nhất do đã sort)
      const selectedCycle = overlappingCycles[0];
      return selectedCycle.id.toString();
    } catch (error) {
      this.logger.error(
        `Error finding cycle by date range: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Lấy tất cả các KPI values trong hệ thống
   * @returns Danh sách tất cả KPI values
   */
  async findAll(): Promise<KpiValue[]> {
    return await this.kpiValuesRepository.find({});
  }

  /**
   * Tìm một KPI value theo ID
   * @param id - ID của KPI value cần tìm
   * @returns KPI value tìm được
   * @throws UnauthorizedException nếu không tìm thấy
   */
  async findOne(id: number): Promise<KpiValue> {
    const data = await this.kpiValuesRepository.findOne({
      where: { id },
    });

    if (!data) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return data;
  }

  /**
   * Tạo mới một KPI value và lưu vào lịch sử
   * @param kpiValueData - Dữ liệu KPI value cần tạo
   * @param createdBy - ID của người tạo
   * @returns KPI value đã được tạo
   */
  async create(
    kpiValueData: Partial<KpiValue>,
    createdBy: number,
  ): Promise<KpiValue> {
    const newKpiValue = this.kpiValuesRepository.create(kpiValueData);
    const savedKpiValue = await this.kpiValuesRepository.save(newKpiValue);

    const historyEntry = this.kpiValueHistoryRepository.create({
      kpi_value_id: savedKpiValue.id,

      value: savedKpiValue.value,
      timestamp: savedKpiValue.timestamp,
      notes: savedKpiValue.notes,
      action: 'CREATE',
      changed_by: createdBy,
    });
    await this.kpiValueHistoryRepository.save(historyEntry);

    return savedKpiValue;
  }

  /**
   * Cập nhật một KPI value
   * Hỗ trợ cập nhật bình thường hoặc correction bởi approver
   * @param id - ID của KPI value cần cập nhật
   * @param updateData - Dữ liệu cập nhật (có thể chứa correctedByApprover và correctionNotes)
   * @param updatedBy - ID của người cập nhật
   * @returns KPI value đã được cập nhật
   * @throws NotFoundException nếu không tìm thấy KPI value
   * @throws BadRequestException nếu KPI đã hết hạn
   */
  async update(
    id: number,
    updateData: Partial<KpiValue>,
    updatedBy: number,
  ): Promise<KpiValue> {
    const kpiValue = await this.kpiValuesRepository.findOne({
      where: { id },
      relations: ['kpiAssignment', 'kpiAssignment.kpi'],
    });
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found`);
    }

    // Check if KPI has expired
    if (kpiValue.kpiAssignment?.kpi) {
      const kpiValidityStatus = getKpiStatus(
        kpiValue.kpiAssignment.kpi.start_date,
        kpiValue.kpiAssignment.kpi.end_date,
      );
      if (kpiValidityStatus === 'expired') {
        throw new BadRequestException(
          'Cannot update values for expired KPI. This KPI is no longer valid.',
        );
      }
    }

    // Determine if this is a correction by approver
    const isCorrectionByApprover = updateData['correctedByApprover'] === true;
    const correctionNotes = updateData['correctionNotes'] || updateData.notes;

    // Create history entry
    const historyEntry = this.kpiValueHistoryRepository.create({
      kpi_value_id: kpiValue.id,
      kpi_assigment_id: kpiValue.kpi_assigment_id,
      kpi_id: kpiValue.kpiAssignment?.kpi_id || kpiValue.kpiAssignment?.kpi?.id,
      value: kpiValue.value,
      timestamp: kpiValue.timestamp,
      notes: isCorrectionByApprover ? correctionNotes : kpiValue.notes,
      action: isCorrectionByApprover ? 'CORRECTED_BY_APPROVER' : 'UPDATE',
      changed_by: updatedBy,
    });
    await this.kpiValueHistoryRepository.save(historyEntry);

    // Remove temporary fields before saving
    const cleanUpdateData = { ...updateData };
    delete cleanUpdateData['correctedByApprover'];
    delete cleanUpdateData['correctionNotes'];

    // If correction by approver, update corrected_value instead of value
    if (isCorrectionByApprover && cleanUpdateData.value !== undefined) {
      cleanUpdateData.corrected_value = cleanUpdateData.value;
      cleanUpdateData.correction_notes = correctionNotes; // Save correction notes
      delete cleanUpdateData.value; // Don't update original value
    }

    Object.assign(kpiValue, cleanUpdateData);
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = updatedBy;
    return this.kpiValuesRepository.save(kpiValue);
  }

  /**
   * Xóa một KPI value và ghi lại vào lịch sử
   * @param id - ID của KPI value cần xóa
   * @param deletedBy - ID của người xóa
   * @returns true nếu xóa thành công
   * @throws NotFoundException nếu không tìm thấy KPI value
   */
  async delete(id: number, deletedBy: number): Promise<boolean> {
    const kpiValue = await this.kpiValuesRepository.findOne({
      where: { id },
    });
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found`);
    }

    const historyEntry = this.kpiValueHistoryRepository.create({
      kpi_value_id: kpiValue.id,

      value: kpiValue.value,
      timestamp: kpiValue.timestamp,
      notes: kpiValue.notes,
      action: 'DELETE',
      changed_by: deletedBy,
    });
    await this.kpiValueHistoryRepository.save(historyEntry);

    await this.kpiValuesRepository.delete(id);
    return true;
  }

  /**
   * Submit progress update cho một KPI assignment
   * Tự động tính toán value từ projectDetails và xác định status dựa trên quyền của user
   * Nếu record chưa tồn tại sẽ tạo mới, nếu đã tồn tại sẽ cập nhật
   * Tự động tạo/update KpiReview nếu có selfScore và selfComment
   * @param assignmentId - ID của KPI assignment
   * @param notes - Ghi chú
   * @param projectDetails - Danh sách chi tiết project để tính toán value
   * @param userId - ID của người submit
   * @param selfScore - Điểm tự đánh giá (1-5), optional
   * @param selfComment - Comment tự đánh giá, optional
   * @returns KPI value đã được submit
   * @throws NotFoundException nếu không tìm thấy assignment
   * @throws BadRequestException nếu KPI không approved hoặc đã hết hạn
   */
  async submitProgressUpdate(
    assignmentId: number,
    notes: string,
    projectDetails: any[],
    userId: number,
    selfScore?: number,
    selfComment?: string,
  ): Promise<KpiValue> {
    return await this.dataSource.transaction(
      async (transactionalEntityManager) => {
        const kpiValueRepo = transactionalEntityManager.getRepository(KpiValue);
        const historyRepo =
          transactionalEntityManager.getRepository(KpiValueHistory);
        const assignmentRepo =
          transactionalEntityManager.getRepository(KPIAssignment);

        const assignment = await assignmentRepo.findOne({
          where: { id: assignmentId },
          relations: ['kpi'],
        });

        if (!assignment) {
          throw new NotFoundException(
            `KPI Assignment with ID ${assignmentId} not found. Cannot submit progress.`,
          );
        }
        if (!assignment.kpi) {
          throw new InternalServerErrorException(
            `Could not load parent KPI for Assignment ID ${assignmentId}.`,
          );
        }

        if (assignment.kpi.status !== KpiDefinitionStatus.APPROVED) {
          throw new BadRequestException(
            `Cannot submit value for a KPI that is not APPROVED (current status: ${assignment.kpi.status}).`,
          );
        }

        // Check if KPI has expired
        const kpiValidityStatus = getKpiStatus(
          assignment.kpi.start_date,
          assignment.kpi.end_date,
        );
        if (kpiValidityStatus === 'expired') {
          throw new BadRequestException(
            'Cannot update values for expired KPI. This KPI is no longer valid.',
          );
        }

        await this.kpiReviewService.ensureYearEndReviewForAssignmentIfNeeded(
          assignmentId,
        );

        let calculatedValue = 0;
        if (projectDetails && Array.isArray(projectDetails)) {
          calculatedValue = projectDetails.reduce(
            (sum, project) =>
              sum + Number(project.value || project.projectValue || 0),
            0,
          );
        }

        let existingRecord = await kpiValueRepo.findOneBy({
          kpi_assigment_id: assignmentId,
        });

        let savedKpiValue: KpiValue;
        let historyAction: string;
        const currentTimestamp = new Date();
        const projectDetailsObject = projectDetails;

        const submitter = await transactionalEntityManager
          .getRepository(Employee)
          .findOne({
            where: { id: userId },
            relations: ['roles', 'roles.permissions'],
          });
        if (!submitter) {
          throw new UnauthorizedException('Submitter information not found.');
        }

        let initialStatusAfterSubmit: KpiValueStatus;

        if (userHasPermission(submitter, 'approve', 'kpi-value', 'manager')) {
          initialStatusAfterSubmit = KpiValueStatus.APPROVED;
        } else if (
          userHasPermission(submitter, 'approve', 'kpi-value', 'department')
        ) {
          initialStatusAfterSubmit = KpiValueStatus.PENDING_MANAGER_APPROVAL;
        } else if (
          userHasPermission(submitter, 'approve', 'kpi-value', 'section')
        ) {
          initialStatusAfterSubmit = KpiValueStatus.PENDING_DEPT_APPROVAL;
        } else {
          initialStatusAfterSubmit = KpiValueStatus.PENDING_SECTION_APPROVAL;
        }

        const statusBeforeSubmit = existingRecord?.status;

        if (existingRecord) {
          historyAction = 'SUBMIT_UPDATE';
          existingRecord.value = calculatedValue;
          existingRecord.notes = notes;
          existingRecord.project_details = projectDetailsObject;
          existingRecord.status = initialStatusAfterSubmit;
          existingRecord.timestamp = currentTimestamp;
          existingRecord.updated_by = userId;
          existingRecord.rejection_reason = null;
          savedKpiValue = await kpiValueRepo.save(existingRecord);
        } else {
          historyAction = 'SUBMIT_CREATE';
          const newKpiValueData: Partial<KpiValue> = {
            kpi_assigment_id: assignmentId,
            value: calculatedValue,
            timestamp: currentTimestamp,
            notes: notes,
            status: initialStatusAfterSubmit,
            project_details: projectDetailsObject,
            updated_by: userId,
          };
          const newKpiValue = kpiValueRepo.create(newKpiValueData);
          savedKpiValue = await kpiValueRepo.save(newKpiValue);
        }

        const historyEntry = historyRepo.create({
          kpi_value_id: savedKpiValue.id,
          kpi_assigment_id: assignmentId,
          kpi_id: assignment.kpi_id,
          value: savedKpiValue.value,
          timestamp: savedKpiValue.timestamp,
          notes: savedKpiValue.notes,
          status_before: statusBeforeSubmit,
          status_after: savedKpiValue.status,
          action: historyAction,
          changed_by: userId,
          changed_at: new Date(),
        } as DeepPartial<KpiValueHistory>);
        await historyRepo.save(historyEntry);

        // Tạo/update KpiReview nếu có selfScore hoặc selfComment
        if (selfScore !== undefined || selfComment !== undefined) {
          try {
            const cycle = await this.findOverlappingCycleId(
              assignment.kpi.start_date,
              assignment.kpi.end_date,
            );

            if (cycle) {
              const kpiReviewRepo =
                transactionalEntityManager.getRepository(KpiReview);

              const evaluationPhase =
                await this.resolveEvaluationPhaseWithRepo(
                  kpiReviewRepo,
                  assignmentId,
                  cycle,
                );

              // Tìm KpiReview hiện có
              let existingReview = await kpiReviewRepo.findOne({
                where: {
                  assignment: { id: assignmentId },
                  cycle: cycle,
                  employee: { id: userId },
                  evaluationPhase,
                },
                relations: ['assignment', 'employee', 'kpi'],
              });

              const targetValue =
                assignment.targetValue ?? assignment.kpi.target ?? 0;

              if (existingReview) {
                if (existingReview.status === ReviewStatus.COMPLETED) {
                  // Locked: progress updates must not touch completed phase rows
                } else {
                  // Update existing review
                  existingReview.actualValue = calculatedValue;
                  existingReview.targetValue = targetValue;
                  if (selfScore !== undefined) {
                    existingReview.selfScore = selfScore;
                  }
                  if (selfComment !== undefined) {
                    existingReview.selfComment = selfComment;
                  }
                  // Set status to SELF_REVIEWED if selfScore is provided
                  if (selfScore !== undefined) {
                    existingReview.status = ReviewStatus.SELF_REVIEWED;
                  }
                  await kpiReviewRepo.save(existingReview);
                }
              } else {
                // Create new review
                const newReview = kpiReviewRepo.create({
                  kpi: assignment.kpi,
                  assignment: assignment,
                  employee: submitter,
                  cycle: cycle,
                  evaluationPhase,
                  targetValue: targetValue,
                  actualValue: calculatedValue,
                  selfScore: selfScore,
                  selfComment: selfComment,
                  status:
                    selfScore !== undefined
                      ? ReviewStatus.SELF_REVIEWED
                      : ReviewStatus.PENDING,
                });
                await kpiReviewRepo.save(newReview);
              }
            } else {
              this.logger.warn(
                `Could not find review cycle for KPI ${assignment.kpi_id} with date range ${assignment.kpi.start_date} to ${assignment.kpi.end_date}. Skipping KpiReview creation.`,
              );
            }
          } catch (error) {
            this.logger.error(
              `Error creating/updating KpiReview: ${error.message}`,
              error.stack,
            );
            // Don't throw error, KpiValue creation is still successful
          }
        }

        if (assignment.kpi) {
          if (
            savedKpiValue.status === KpiValueStatus.PENDING_SECTION_APPROVAL
          ) {
            this.eventEmitter.emit('kpi_value.submitted_for_section_approval', {
              kpiValue: savedKpiValue,
              submitter: submitter,
              kpiName: assignment.kpi.name,
              assignmentId: assignment.id,
              kpiId: assignment.kpi_id,
            });
          } else if (
            savedKpiValue.status === KpiValueStatus.PENDING_DEPT_APPROVAL
          ) {
            this.eventEmitter.emit('kpi_value.submitted_for_dept_approval', {
              kpiValue: savedKpiValue,
              submitter,
              kpiName: assignment.kpi.name,
              assignmentId: assignment.id,
              kpiId: assignment.kpi_id,
            });
          } else if (
            savedKpiValue.status === KpiValueStatus.PENDING_MANAGER_APPROVAL
          ) {
            this.eventEmitter.emit('kpi_value.submitted_for_manager_approval', {
              kpiValue: savedKpiValue,
              submitter,
              kpiName: assignment.kpi.name,
              assignmentId: assignment.id,
              kpiId: assignment.kpi_id,
            });
          }
        }

        return savedKpiValue;
      },
    );
  }

  /**
   * Lưu draft progress update cho một KPI assignment
   * Tương tự submitProgressUpdate nhưng status luôn là DRAFT
   * Có thể lưu draft cho cả KpiReview nếu có selfScore/selfComment
   * @param assignmentId - ID của KPI assignment
   * @param notes - Ghi chú
   * @param projectDetails - Danh sách chi tiết project để tính toán value
   * @param userId - ID của người lưu
   * @param selfScore - Điểm tự đánh giá (1-5), optional
   * @param selfComment - Comment tự đánh giá, optional
   * @returns KPI value đã được lưu với status DRAFT
   * @throws NotFoundException nếu không tìm thấy assignment
   * @throws BadRequestException nếu KPI không approved hoặc đã hết hạn
   */
  async saveDraftProgressUpdate(
    assignmentId: number,
    notes: string,
    projectDetails: any[],
    userId: number,
    selfScore?: number,
    selfComment?: string,
  ): Promise<KpiValue> {
    return await this.dataSource.transaction(
      async (transactionalEntityManager) => {
        const kpiValueRepo = transactionalEntityManager.getRepository(KpiValue);
        const historyRepo =
          transactionalEntityManager.getRepository(KpiValueHistory);
        const assignmentRepo =
          transactionalEntityManager.getRepository(KPIAssignment);

        const assignment = await assignmentRepo.findOne({
          where: { id: assignmentId },
          relations: ['kpi'],
        });

        if (!assignment) {
          throw new NotFoundException(
            `KPI Assignment with ID ${assignmentId} not found. Cannot save draft.`,
          );
        }
        if (!assignment.kpi) {
          throw new InternalServerErrorException(
            `Could not load parent KPI for Assignment ID ${assignmentId}.`,
          );
        }

        if (assignment.kpi.status !== KpiDefinitionStatus.APPROVED) {
          throw new BadRequestException(
            `Cannot save draft for a KPI that is not APPROVED (current status: ${assignment.kpi.status}).`,
          );
        }

        // Check if KPI has expired
        const kpiValidityStatus = getKpiStatus(
          assignment.kpi.start_date,
          assignment.kpi.end_date,
        );
        if (kpiValidityStatus === 'expired') {
          throw new BadRequestException(
            'Cannot save draft for expired KPI. This KPI is no longer valid.',
          );
        }

        await this.kpiReviewService.ensureYearEndReviewForAssignmentIfNeeded(
          assignmentId,
        );

        let calculatedValue = 0;
        if (projectDetails && Array.isArray(projectDetails)) {
          calculatedValue = projectDetails.reduce(
            (sum, project) =>
              sum + Number(project.value || project.projectValue || 0),
            0,
          );
        }

        let existingRecord = await kpiValueRepo.findOneBy({
          kpi_assigment_id: assignmentId,
        });

        let savedKpiValue: KpiValue;
        let historyAction: string;
        const currentTimestamp = new Date();
        const projectDetailsObject = projectDetails;

        const statusBeforeSubmit = existingRecord?.status;

        if (existingRecord) {
          historyAction = 'UPDATE_DRAFT';
          existingRecord.value = calculatedValue;
          existingRecord.notes = notes;
          existingRecord.project_details = projectDetailsObject;
          existingRecord.status = KpiValueStatus.DRAFT;
          existingRecord.timestamp = currentTimestamp;
          existingRecord.updated_by = userId;
          existingRecord.rejection_reason = null;
          savedKpiValue = await kpiValueRepo.save(existingRecord);
        } else {
          historyAction = 'SAVE_DRAFT';
          const newKpiValueData: Partial<KpiValue> = {
            kpi_assigment_id: assignmentId,
            value: calculatedValue,
            timestamp: currentTimestamp,
            notes: notes,
            status: KpiValueStatus.DRAFT,
            project_details: projectDetailsObject,
            updated_by: userId,
          };
          const newKpiValue = kpiValueRepo.create(newKpiValueData);
          savedKpiValue = await kpiValueRepo.save(newKpiValue);
        }

        const historyEntry = historyRepo.create({
          kpi_value_id: savedKpiValue.id,
          kpi_assigment_id: assignmentId,
          kpi_id: assignment.kpi_id,
          value: savedKpiValue.value,
          timestamp: savedKpiValue.timestamp,
          notes: savedKpiValue.notes,
          status_before: statusBeforeSubmit,
          status_after: savedKpiValue.status,
          action: historyAction,
          changed_by: userId,
          changed_at: new Date(),
        } as DeepPartial<KpiValueHistory>);
        await historyRepo.save(historyEntry);

        // Lưu draft cho KpiReview nếu có selfScore hoặc selfComment
        // Note: Draft review không set status SELF_REVIEWED, giữ nguyên PENDING
        if (selfScore !== undefined || selfComment !== undefined) {
          try {
            // Get employee for KpiReview
            const employee = await transactionalEntityManager
              .getRepository(Employee)
              .findOne({
                where: { id: userId },
              });

            if (!employee) {
              this.logger.warn(
                `Employee with ID ${userId} not found. Skipping KpiReview draft creation.`,
              );
            } else {
              const cycle = await this.findOverlappingCycleId(
                assignment.kpi.start_date,
                assignment.kpi.end_date,
              );

              if (cycle) {
                const kpiReviewRepo =
                  transactionalEntityManager.getRepository(KpiReview);

                const evaluationPhase =
                  await this.resolveEvaluationPhaseWithRepo(
                    kpiReviewRepo,
                    assignmentId,
                    cycle,
                  );

                // Tìm KpiReview hiện có
                let existingReview = await kpiReviewRepo.findOne({
                  where: {
                    assignment: { id: assignmentId },
                    cycle: cycle,
                    employee: { id: userId },
                    evaluationPhase,
                  },
                  relations: ['assignment', 'employee', 'kpi'],
                });

                const targetValue =
                  assignment.targetValue ?? assignment.kpi.target ?? 0;

                if (existingReview) {
                  if (existingReview.status === ReviewStatus.COMPLETED) {
                    // Mid-year locked; draft must not overwrite completed row
                  } else {
                    // Update existing review (draft - không đổi status)
                    existingReview.actualValue = calculatedValue;
                    existingReview.targetValue = targetValue;
                    if (selfScore !== undefined) {
                      existingReview.selfScore = selfScore;
                    }
                    if (selfComment !== undefined) {
                      existingReview.selfComment = selfComment;
                    }
                    // Không đổi status khi là draft
                    await kpiReviewRepo.save(existingReview);
                  }
                } else {
                  // Create new review với status PENDING (draft)
                  const newReview = kpiReviewRepo.create({
                    kpi: assignment.kpi,
                    assignment: assignment,
                    employee: employee,
                    cycle: cycle,
                    evaluationPhase,
                    targetValue: targetValue,
                    actualValue: calculatedValue,
                    selfScore: selfScore,
                    selfComment: selfComment,
                    status: ReviewStatus.PENDING, // Draft nên giữ PENDING
                  });
                  await kpiReviewRepo.save(newReview);
                }
              } else {
                this.logger.warn(
                  `Could not find review cycle for KPI ${assignment.kpi_id} with date range ${assignment.kpi.start_date} to ${assignment.kpi.end_date}. Skipping KpiReview draft creation.`,
                );
              }
            }
          } catch (error) {
            this.logger.error(
              `Error creating/updating KpiReview draft: ${error.message}`,
              error.stack,
            );
            // Don't throw error, KpiValue draft creation is still successful
          }
        }

        return savedKpiValue;
      },
    );
  }

  /**
   * Submit nhiều draft values cùng lúc trong một transaction
   * Nếu bất kỳ assignment nào lỗi, toàn bộ transaction sẽ rollback
   * @param assignmentIds - Mảng ID của các assignment cần submit
   * @param userId - ID của người submit
   * @returns Object chứa danh sách success và failed assignments
   */
  async batchSubmitDrafts(
    assignmentIds: number[],
    userId: number,
  ): Promise<{
    success: number[];
    failed: Array<{ id: number; reason: string }>;
  }> {
    const success: number[] = [];
    const failed: Array<{ id: number; reason: string }> = [];

    try {
      await this.dataSource.transaction(async (transactionalEntityManager) => {
        const kpiValueRepo = transactionalEntityManager.getRepository(KpiValue);
        const historyRepo =
          transactionalEntityManager.getRepository(KpiValueHistory);
        const assignmentRepo =
          transactionalEntityManager.getRepository(KPIAssignment);

        // Get submitter once for all assignments
        const submitter = await transactionalEntityManager
          .getRepository(Employee)
          .findOne({
            where: { id: userId },
            relations: ['roles', 'roles.permissions'],
          });

        if (!submitter) {
          throw new Error('Submitter information not found');
        }

        let initialStatusAfterSubmit: KpiValueStatus;

        if (userHasPermission(submitter, 'approve', 'kpi-value', 'manager')) {
          initialStatusAfterSubmit = KpiValueStatus.APPROVED;
        } else if (
          userHasPermission(submitter, 'approve', 'kpi-value', 'department')
        ) {
          initialStatusAfterSubmit = KpiValueStatus.PENDING_MANAGER_APPROVAL;
        } else if (
          userHasPermission(submitter, 'approve', 'kpi-value', 'section')
        ) {
          initialStatusAfterSubmit = KpiValueStatus.PENDING_DEPT_APPROVAL;
        } else {
          initialStatusAfterSubmit = KpiValueStatus.PENDING_SECTION_APPROVAL;
        }

        for (const assignmentId of assignmentIds) {
          const assignment = await assignmentRepo.findOne({
            where: { id: assignmentId },
            relations: ['kpi'],
          });

          if (!assignment) {
            throw new Error(`Assignment ${assignmentId} not found`);
          }

          if (!assignment.kpi) {
            throw new Error(`KPI not found for assignment ${assignmentId}`);
          }

          if (assignment.kpi.status !== KpiDefinitionStatus.APPROVED) {
            throw new Error(`KPI is not approved`);
          }

          // Check if KPI has expired
          const kpiValidityStatus = getKpiStatus(
            assignment.kpi.start_date,
            assignment.kpi.end_date,
          );
          if (kpiValidityStatus === 'expired') {
            throw new Error('KPI has expired');
          }

          const existingRecord = await kpiValueRepo.findOneBy({
            kpi_assigment_id: assignmentId,
          });

          if (!existingRecord) {
            throw new Error('No draft found for this assignment');
          }

          if (existingRecord.status !== KpiValueStatus.DRAFT) {
            throw new Error('KPI value is not in DRAFT status');
          }

          const statusBeforeSubmit = existingRecord.status;
          existingRecord.status = initialStatusAfterSubmit;
          existingRecord.timestamp = new Date();
          existingRecord.updated_by = userId;

          const savedKpiValue = await kpiValueRepo.save(existingRecord);

          const historyEntry = historyRepo.create({
            kpi_value_id: savedKpiValue.id,
            kpi_assigment_id: assignmentId,
            kpi_id: assignment.kpi_id,
            value: savedKpiValue.value,
            timestamp: savedKpiValue.timestamp,
            notes: savedKpiValue.notes,
            status_before: statusBeforeSubmit,
            status_after: savedKpiValue.status,
            action: 'BATCH_SUBMIT',
            changed_by: userId,
            changed_at: new Date(),
          } as DeepPartial<KpiValueHistory>);
          await historyRepo.save(historyEntry);

          if (assignment.kpi) {
            if (
              savedKpiValue.status === KpiValueStatus.PENDING_SECTION_APPROVAL
            ) {
              this.eventEmitter.emit(
                'kpi_value.submitted_for_section_approval',
                {
                  kpiValue: savedKpiValue,
                  submitter: submitter,
                  kpiName: assignment.kpi.name,
                  assignmentId: assignment.id,
                  kpiId: assignment.kpi_id,
                },
              );
            } else if (
              savedKpiValue.status === KpiValueStatus.PENDING_DEPT_APPROVAL
            ) {
              this.eventEmitter.emit('kpi_value.submitted_for_dept_approval', {
                kpiValue: savedKpiValue,
                submitter,
                kpiName: assignment.kpi.name,
                assignmentId: assignment.id,
                kpiId: assignment.kpi_id,
              });
            } else if (
              savedKpiValue.status === KpiValueStatus.PENDING_MANAGER_APPROVAL
            ) {
              this.eventEmitter.emit(
                'kpi_value.submitted_for_manager_approval',
                {
                  kpiValue: savedKpiValue,
                  submitter,
                  kpiName: assignment.kpi.name,
                  assignmentId: assignment.id,
                  kpiId: assignment.kpi_id,
                },
              );
            }
          }

          success.push(assignmentId);
        }
      });
    } catch (error) {
      // If any assignment fails, all will be rolled back
      // Mark all assignments as failed since transaction rolled back
      const errorMessage = error.message || 'Unknown error';

      // Try to identify which assignment caused the error
      const assignmentIdMatch = errorMessage.match(/Assignment (\d+)/);
      const failedAssignmentId = assignmentIdMatch
        ? parseInt(assignmentIdMatch[1])
        : null;

      for (const id of assignmentIds) {
        if (failedAssignmentId && id === failedAssignmentId) {
          failed.push({
            id: id,
            reason: errorMessage,
          });
        } else {
          failed.push({
            id: id,
            reason: failedAssignmentId
              ? `Transaction rolled back due to error in assignment ${failedAssignmentId}: ${errorMessage}`
              : `Transaction rolled back: ${errorMessage}`,
          });
        }
      }
    }

    return { success, failed };
  }

  /**
   * Lấy lịch sử thay đổi của một KPI value
   * @param kpiValueId - ID của KPI value
   * @returns Danh sách lịch sử được sắp xếp theo thời gian giảm dần
   */
  async getHistory(kpiValueId: number): Promise<KpiValueHistory[]> {
    return this.kpiValueHistoryRepository.find({
      where: { kpi_value_id: kpiValueId },
      relations: ['changedByUser'],
      order: { changed_at: 'DESC' },
    });
  }

  /**
   * Approve KPI value ở cấp Section
   * Kiểm tra quyền của user và chuyển status sang PENDING_DEPT_APPROVAL hoặc APPROVED
   * Tự động lưu sectionScore và sectionComment vào KpiReview nếu được cung cấp
   * @param valueId - ID của KPI value cần approve
   * @param userId - ID của người approve
   * @param sectionScore - Điểm đánh giá của section (optional)
   * @param sectionComment - Comment đánh giá của section (optional)
   * @returns KPI value đã được approve
   * @throws UnauthorizedException nếu user không có quyền
   * @throws BadRequestException nếu status không phù hợp
   */
  async approveValueBySection(
    valueId: number,
    userId: number,
    sectionScore?: number,
    sectionComment?: string,
  ): Promise<KpiValue> {
    const kpiValue = await this.findKpiValueForWorkflow(valueId);
    const statusBefore = kpiValue.status;
    const user = await this.employeeRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });
    if (!user) {
      throw new UnauthorizedException('Approving user not found.');
    }

    const assignment =
      kpiValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOne({
        where: { id: kpiValue.kpi_assigment_id },
        relations: ['kpi', 'employee', 'section', 'department'],
      }));

    // Check basic permission first
    let canApprove = userHasPermission(user, 'approve', 'kpi-value', 'section');

    // If no basic permission, check section-specific logic
    if (!canApprove && user.sectionId && assignment) {
      canApprove =
        userHasPermission(user, 'approve', 'kpi-value', 'section') &&
        (assignment.assigned_to_section === user.sectionId ||
          assignment.employee?.sectionId === user.sectionId);
    }

    if (!canApprove) {
      throw new UnauthorizedException(
        'User does not have permission for section approval.',
      );
    }
    if (kpiValue.status !== KpiValueStatus.PENDING_SECTION_APPROVAL) {
      throw new BadRequestException(
        `Cannot perform Section Approval on value with status '${kpiValue.status}'. Expected '${KpiValueStatus.PENDING_SECTION_APPROVAL}'.`,
      );
    }

    // Section approve always goes to PENDING_DEPT_APPROVAL (no skip level)
    kpiValue.status = KpiValueStatus.PENDING_DEPT_APPROVAL;
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = userId;
    kpiValue.rejection_reason = null;
    const savedValue = await this.kpiValuesRepository.save(kpiValue);
    await this.logWorkflowHistory(
      savedValue,
      statusBefore,
      'APPROVE_SECTION',
      userId,
    );

    // Update KpiReview with section score/comment
    // If sectionScore not provided, fallback to selfScore
    if (assignment && assignment.kpi) {
      try {
        await this.kpiReviewService.ensureYearEndReviewForAssignmentIfNeeded(
          assignment.id,
        );
        const cycle = await this.findOverlappingCycleId(
          assignment.kpi.start_date,
          assignment.kpi.end_date,
        );

        if (cycle) {
          const evaluationPhase = await this.resolveEvaluationPhaseWithRepo(
            this.kpiReviewRepository,
            assignment.id,
            cycle,
          );

          let existingReview = await this.kpiReviewRepository.findOne({
            where: {
              assignment: { id: assignment.id },
              cycle: cycle,
              employee: assignment.employee
                ? { id: assignment.employee.id }
                : undefined,
              evaluationPhase,
            },
          });

          if (existingReview) {
            if (existingReview.status === ReviewStatus.COMPLETED) {
              // locked
            } else {
              if (sectionScore !== undefined && sectionScore !== null) {
                existingReview.sectionScore = sectionScore;
              } else if (
                existingReview.selfScore !== undefined &&
                existingReview.selfScore !== null
              ) {
                existingReview.sectionScore = existingReview.selfScore;
              }
              if (sectionComment !== undefined) {
                existingReview.sectionComment = sectionComment;
              }
              await this.kpiReviewRepository.save(existingReview);
            }
          } else {
            const employee = assignment.employee
              ? await this.employeeRepository.findOne({
                  where: { id: assignment.employee.id },
                })
              : null;

            if (employee) {
              let fallbackScore = sectionScore;
              if (
                (fallbackScore === undefined || fallbackScore === null) &&
                assignment.id
              ) {
                const anyReview = await this.kpiReviewRepository.findOne({
                  where: {
                    assignment: { id: assignment.id },
                    evaluationPhase,
                  },
                  order: { updatedAt: 'DESC' },
                });
                if (
                  anyReview &&
                  anyReview.selfScore !== undefined &&
                  anyReview.selfScore !== null
                ) {
                  fallbackScore = anyReview.selfScore;
                }
              }

              const newReview = this.kpiReviewRepository.create({
                kpi: assignment.kpi,
                assignment: assignment,
                employee: employee,
                cycle: cycle,
                evaluationPhase,
                targetValue:
                  assignment.targetValue ?? assignment.kpi.target ?? 0,
                actualValue: savedValue.value ?? 0,
                sectionScore: fallbackScore,
                sectionComment: sectionComment,
                status: ReviewStatus.SECTION_REVIEWED,
              });
              await this.kpiReviewRepository.save(newReview);
            }
          }
        }
      } catch (error) {
        this.logger.warn(
          `Could not update KpiReview during section approval: ${error.message}`,
        );
        // Don't throw error, approval is still successful
      }
    }

    const assignmentFound =
      savedValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOne({
        where: { id: savedValue.kpi_assigment_id },
        relations: ['kpi'],
      }));
    if (savedValue.status === KpiValueStatus.APPROVED) {
      if (assignmentFound && typeof assignmentFound.kpi_id === 'number') {
        this.eventEmitter.emit('kpi_value.approved', {
          kpiId: assignmentFound.kpi_id,
        });
      }
      if (
        assignmentFound &&
        assignmentFound.employee_id &&
        assignmentFound.employee_id !== userId
      ) {
        this.eventEmitter.emit('kpi_value.approved_by_user', {
          kpiValue: savedValue,
          submitterId: assignmentFound.employee_id,
          kpiName: assignmentFound.kpi?.name || '',
        });
      }
    } else if (savedValue.status === KpiValueStatus.PENDING_DEPT_APPROVAL) {
      const submitter = assignmentFound?.employee_id
        ? await this.employeeRepository.findOne({
            where: { id: assignmentFound.employee_id },
          })
        : null;
      if (submitter && assignmentFound?.kpi) {
        this.eventEmitter.emit('kpi_value.submitted_for_dept_approval', {
          kpiValue: savedValue,
          submitter,
          kpiName: assignmentFound.kpi.name,
          assignmentId: assignmentFound.id,
          kpiId: assignmentFound.kpi_id,
        });
      }
    }
    return savedValue;
  }

  /**
   * Reject KPI value ở cấp Section
   * @param valueId - ID của KPI value cần reject
   * @param reason - Lý do reject (bắt buộc)
   * @param userId - ID của người reject
   * @returns KPI value đã được reject
   * @throws UnauthorizedException nếu user không có quyền
   * @throws BadRequestException nếu status không phù hợp hoặc thiếu lý do
   */
  async rejectValueBySection(
    valueId: number,
    reason: string,
    userId: number,
  ): Promise<KpiValue> {
    const kpiValue = await this.findKpiValueForWorkflow(valueId);
    const statusBefore = kpiValue.status;
    const user = await this.employeeRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });
    if (!user) throw new UnauthorizedException('Rejecting user not found.');
    const assignment =
      kpiValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: kpiValue.kpi_assigment_id,
      }));
    // Check basic permission first
    let canReject = userHasPermission(user, 'reject', 'kpi-value', 'section');

    // If no basic permission, check section-specific logic
    if (!canReject && user.sectionId && assignment) {
      canReject =
        userHasPermission(user, 'reject', 'kpi-value', 'section') &&
        (assignment.assigned_to_section === user.sectionId ||
          assignment.employee?.sectionId === user.sectionId);
    }
    if (!canReject) {
      throw new UnauthorizedException(
        'User does not have permission to reject at Section level.',
      );
    }
    if (kpiValue.status !== KpiValueStatus.PENDING_SECTION_APPROVAL) {
      throw new BadRequestException(
        `Cannot reject value from status '${kpiValue.status}'. Expected '${KpiValueStatus.PENDING_SECTION_APPROVAL}'.`,
      );
    }
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Rejection reason is required.');
    }

    let newStatus: KpiValueStatus;
    let logAction: string;
    if (userHasPermission(user, 'reject', 'kpi-value', 'manager')) {
      newStatus = KpiValueStatus.REJECTED_BY_MANAGER;
      logAction = 'REJECT_MANAGER';
    } else if (userHasPermission(user, 'reject', 'kpi-value', 'department')) {
      newStatus = KpiValueStatus.REJECTED_BY_DEPT;
      logAction = 'REJECT_DEPT';
    } else {
      newStatus = KpiValueStatus.REJECTED_BY_SECTION;
      logAction = 'REJECT_SECTION';
    }
    kpiValue.status = newStatus;
    kpiValue.rejection_reason = reason;
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = userId;
    await this.logWorkflowHistory(
      kpiValue,
      statusBefore,
      logAction,
      userId,
      reason,
    );
    const rejectedValue = await this.kpiValuesRepository.save(kpiValue);
    const assignmentFound = await this.kpiAssignmentRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.kpi', 'kpi')
      .where('assignment.id = :id', { id: rejectedValue.kpi_assigment_id })
      .getOne();
    if (!assignmentFound) {
      console.error(
        'No assignment found for ID:',
        rejectedValue.kpi_assigment_id,
      );
    }
    if (assignmentFound && assignmentFound.employee_id) {
      this.eventEmitter.emit('kpi_value.rejected_by_user', {
        kpiValue: rejectedValue,
        submitterId: assignmentFound.employee_id,
        kpiName: assignmentFound.kpi?.name || '',
        reason,
      });
    }
    return rejectedValue;
  }

  /**
   * Approve KPI value ở cấp Department
   * Có thể approve từ PENDING_DEPT_APPROVAL hoặc PENDING_SECTION_APPROVAL
   * Tự động lưu departmentScore và departmentComment vào KpiReview nếu được cung cấp
   * @param valueId - ID của KPI value cần approve
   * @param userId - ID của người approve
   * @param departmentScore - Điểm đánh giá của department (optional)
   * @param departmentComment - Comment đánh giá của department (optional)
   * @returns KPI value đã được approve
   * @throws UnauthorizedException nếu user không có quyền
   * @throws BadRequestException nếu status không phù hợp
   */
  async approveValueByDepartment(
    valueId: number,
    userId: number,
    departmentScore?: number,
    departmentComment?: string,
  ): Promise<KpiValue> {
    const kpiValue = await this.findKpiValueForWorkflow(valueId);
    const statusBefore = kpiValue.status;
    const user = await this.employeeRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new UnauthorizedException('Approving user not found.');
    }
    const assignment =
      kpiValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOne({
        where: { id: kpiValue.kpi_assigment_id },
        relations: ['kpi', 'employee', 'section', 'department'],
      }));
    // Check basic permission first
    let canApprove = userHasPermission(
      user,
      RBAC_ACTIONS.APPROVE,
      RBAC_RESOURCES.KPI_VALUE,
      'department',
    );

    // If no basic permission, check department-specific logic
    if (!canApprove && user.departmentId && assignment) {
      canApprove =
        userHasPermission(user, 'approve', 'kpi-value', 'department') &&
        (assignment.assigned_to_department === user.departmentId ||
          assignment.employee?.departmentId === user.departmentId ||
          assignment.section?.department?.id === user.departmentId);
    }
    if (!canApprove) {
      throw new UnauthorizedException(
        'User does not have permission for department approval.',
      );
    }
    if (
      ![
        KpiValueStatus.PENDING_DEPT_APPROVAL,
        KpiValueStatus.PENDING_SECTION_APPROVAL,
      ].includes(kpiValue.status)
    ) {
      throw new BadRequestException(
        `Cannot perform Department Approval on value with status '${kpiValue.status}'. Expected '${KpiValueStatus.PENDING_DEPT_APPROVAL}' or lower.`,
      );
    }

    const hasManagerPermission = userHasPermission(
      user,
      'approve',
      'kpi-value',
      'manager',
    );
    const newStatus = hasManagerPermission
      ? KpiValueStatus.APPROVED
      : KpiValueStatus.PENDING_MANAGER_APPROVAL;

    kpiValue.status = newStatus;
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = userId;
    kpiValue.rejection_reason = null;
    const savedValue = await this.kpiValuesRepository.save(kpiValue);

    // Validation: Ensure status is correct after save
    if (statusBefore === KpiValueStatus.PENDING_SECTION_APPROVAL) {
      if (savedValue.status === KpiValueStatus.PENDING_DEPT_APPROVAL) {
        // Force correct status
        savedValue.status = newStatus;
        await this.kpiValuesRepository.save(savedValue);
      }
    }

    await this.logWorkflowHistory(
      savedValue,
      statusBefore,
      'APPROVE_DEPT',
      userId,
    );

    // Update KpiReview with department score/comment
    // If departmentScore not provided, fallback to sectionScore or selfScore
    if (assignment && assignment.kpi) {
      try {
        await this.kpiReviewService.ensureYearEndReviewForAssignmentIfNeeded(
          assignment.id,
        );
        const cycle = await this.findOverlappingCycleId(
          assignment.kpi.start_date,
          assignment.kpi.end_date,
        );

        if (cycle) {
          const evaluationPhase = await this.resolveEvaluationPhaseWithRepo(
            this.kpiReviewRepository,
            assignment.id,
            cycle,
          );

          let existingReview = await this.kpiReviewRepository.findOne({
            where: {
              assignment: { id: assignment.id },
              cycle: cycle,
              employee: assignment.employee
                ? { id: assignment.employee.id }
                : undefined,
              evaluationPhase,
            },
          });

          if (existingReview) {
            if (existingReview.status === ReviewStatus.COMPLETED) {
              // locked
            } else {
            // If approving from PENDING_SECTION_APPROVAL, auto-fill section score/comment first
            if (statusBefore === KpiValueStatus.PENDING_SECTION_APPROVAL) {
              // Auto-fill sectionScore if not already set
              if (
                existingReview.sectionScore === undefined ||
                existingReview.sectionScore === null
              ) {
                if (
                  existingReview.selfScore !== undefined &&
                  existingReview.selfScore !== null
                ) {
                  existingReview.sectionScore = existingReview.selfScore;
                }
              }
              // Auto-fill sectionComment if not already set (can use departmentComment as fallback)
              if (
                (existingReview.sectionComment === undefined ||
                  existingReview.sectionComment === null) &&
                departmentComment
              ) {
                existingReview.sectionComment = departmentComment;
              }
            }

            // Update existing review with department score/comment
            // If departmentScore not provided, fallback logic depends on status:
            // - If from PENDING_DEPT_APPROVAL: use sectionScore (section already approved), then selfScore
            // - If from PENDING_SECTION_APPROVAL: use selfScore (section not approved yet)
            if (departmentScore !== undefined && departmentScore !== null) {
              existingReview.departmentScore = departmentScore;
            } else {
              // Fallback logic
              if (statusBefore === KpiValueStatus.PENDING_DEPT_APPROVAL) {
                // Section already approved, prefer sectionScore over selfScore
                if (
                  existingReview.sectionScore !== undefined &&
                  existingReview.sectionScore !== null
                ) {
                  existingReview.departmentScore = existingReview.sectionScore;
                } else if (
                  existingReview.selfScore !== undefined &&
                  existingReview.selfScore !== null
                ) {
                  existingReview.departmentScore = existingReview.selfScore;
                }
              } else {
                // From PENDING_SECTION_APPROVAL, use selfScore
                if (
                  existingReview.selfScore !== undefined &&
                  existingReview.selfScore !== null
                ) {
                  existingReview.departmentScore = existingReview.selfScore;
                } else if (
                  existingReview.sectionScore !== undefined &&
                  existingReview.sectionScore !== null
                ) {
                  existingReview.departmentScore = existingReview.sectionScore;
                }
              }
            }
            if (departmentComment !== undefined) {
              existingReview.departmentComment = departmentComment;
            }

            // If user has manager permission, auto-fill manager score/comment and approve all levels
            if (userHasPermission(user, 'approve', 'kpi-value', 'manager')) {
              if (
                existingReview.managerScore === undefined ||
                existingReview.managerScore === null
              ) {
                existingReview.managerScore =
                  existingReview.departmentScore ??
                  existingReview.sectionScore ??
                  existingReview.selfScore;
              }
              if (
                existingReview.managerComment === undefined ||
                existingReview.managerComment === null
              ) {
                existingReview.managerComment =
                  departmentComment ??
                  existingReview.departmentComment ??
                  existingReview.sectionComment;
              }
              existingReview.status = ReviewStatus.COMPLETED;
              existingReview.reviewedBy = user;
            } else {
              existingReview.status = ReviewStatus.DEPARTMENT_REVIEWED;
            }

            await this.kpiReviewRepository.save(existingReview);

            if (
              existingReview.evaluationPhase === EvaluationPhase.MID_YEAR &&
              existingReview.status === ReviewStatus.COMPLETED
            ) {
              await this.kpiReviewService.ensureYearEndReviewAfterMidCompleted(
                existingReview,
              );
            }
            }
          } else {
            // Create new review if doesn't exist
            const employee = assignment.employee
              ? await this.employeeRepository.findOne({
                  where: { id: assignment.employee.id },
                })
              : null;

            if (employee) {
              // Try to find any review for this assignment to get scores for fallback
              let fallbackScore = departmentScore;
              let sectionScoreValue: number | null = null;
              let sectionCommentValue: string | null = null;

              // If approving from PENDING_SECTION_APPROVAL, need to get section score/comment
              if (
                statusBefore === KpiValueStatus.PENDING_SECTION_APPROVAL &&
                assignment.id
              ) {
                const anyReview = await this.kpiReviewRepository.findOne({
                  where: {
                    assignment: { id: assignment.id },
                    evaluationPhase,
                  },
                  order: { updatedAt: 'DESC' },
                });
                if (anyReview) {
                  // Get sectionScore if available, otherwise use selfScore
                  if (
                    anyReview.sectionScore !== undefined &&
                    anyReview.sectionScore !== null
                  ) {
                    sectionScoreValue = anyReview.sectionScore;
                  } else if (
                    anyReview.selfScore !== undefined &&
                    anyReview.selfScore !== null
                  ) {
                    sectionScoreValue = anyReview.selfScore;
                  }
                  // Get sectionComment if available
                  if (anyReview.sectionComment) {
                    sectionCommentValue = anyReview.sectionComment;
                  }
                }
              }

              if (
                (fallbackScore === undefined || fallbackScore === null) &&
                assignment.id
              ) {
                const anyReview = await this.kpiReviewRepository.findOne({
                  where: {
                    assignment: { id: assignment.id },
                    evaluationPhase,
                  },
                  order: { updatedAt: 'DESC' },
                });
                if (anyReview) {
                  // Fallback logic depends on status
                  if (statusBefore === KpiValueStatus.PENDING_DEPT_APPROVAL) {
                    // Section already approved, prefer sectionScore
                    if (
                      anyReview.sectionScore !== undefined &&
                      anyReview.sectionScore !== null
                    ) {
                      fallbackScore = anyReview.sectionScore;
                    } else if (
                      anyReview.selfScore !== undefined &&
                      anyReview.selfScore !== null
                    ) {
                      fallbackScore = anyReview.selfScore;
                    }
                  } else {
                    // From PENDING_SECTION_APPROVAL, use selfScore first
                    if (
                      anyReview.selfScore !== undefined &&
                      anyReview.selfScore !== null
                    ) {
                      fallbackScore = anyReview.selfScore;
                    } else if (
                      anyReview.sectionScore !== undefined &&
                      anyReview.sectionScore !== null
                    ) {
                      fallbackScore = anyReview.sectionScore;
                    }
                  }
                }
              }

              // If user has manager permission, auto-fill manager score/comment
              let managerScore = fallbackScore;
              let managerCommentValue = departmentComment;
              let reviewStatus = ReviewStatus.DEPARTMENT_REVIEWED;

              if (userHasPermission(user, 'approve', 'kpi-value', 'manager')) {
                managerScore = fallbackScore;
                managerCommentValue = departmentComment;
                reviewStatus = ReviewStatus.COMPLETED;
              }

              const newReview = this.kpiReviewRepository.create({
                kpi: assignment.kpi,
                assignment: assignment,
                employee: employee,
                cycle: cycle,
                evaluationPhase,
                targetValue:
                  assignment.targetValue ?? assignment.kpi.target ?? 0,
                actualValue: savedValue.value ?? 0,
                sectionScore: sectionScoreValue ?? fallbackScore ?? undefined,
                sectionComment:
                  sectionCommentValue ?? departmentComment ?? null,
                departmentScore: fallbackScore,
                departmentComment: departmentComment,
                managerScore: managerScore,
                managerComment: managerCommentValue,
                status: reviewStatus,
                reviewedBy:
                  reviewStatus === ReviewStatus.COMPLETED ? user : undefined,
              });
              const savedNew = await this.kpiReviewRepository.save(newReview);
              if (
                savedNew.evaluationPhase === EvaluationPhase.MID_YEAR &&
                savedNew.status === ReviewStatus.COMPLETED
              ) {
                await this.kpiReviewService.ensureYearEndReviewAfterMidCompleted(
                  savedNew,
                );
              }
            }
          }
        }
      } catch (error) {
        this.logger.warn(
          `Could not update KpiReview during department approval: ${error.message}`,
        );
        // Don't throw error, approval is still successful
      }
    }

    const assignmentFound =
      savedValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOne({
        where: { id: savedValue.kpi_assigment_id },
        relations: ['kpi'],
      }));

    // Final validation before returning: ensure status is correct
    if (statusBefore === KpiValueStatus.PENDING_SECTION_APPROVAL) {
      if (savedValue.status !== newStatus) {
        // Reload to get latest status
        const reloadedValue = await this.kpiValuesRepository.findOne({
          where: { id: savedValue.id },
        });
        if (reloadedValue && reloadedValue.status !== newStatus) {
          reloadedValue.status = newStatus;
          await this.kpiValuesRepository.save(reloadedValue);
          return reloadedValue;
        }
        return reloadedValue || savedValue;
      }
    }

    if (savedValue.status === KpiValueStatus.APPROVED) {
      if (assignmentFound && typeof assignmentFound.kpi_id === 'number') {
        this.eventEmitter.emit('kpi_value.approved', {
          kpiId: assignmentFound.kpi_id,
        });
      }
      if (
        assignmentFound &&
        assignmentFound.employee_id &&
        assignmentFound.employee_id !== userId
      ) {
        this.eventEmitter.emit('kpi_value.approved_by_user', {
          kpiValue: savedValue,
          submitterId: assignmentFound.employee_id,
          kpiName: assignmentFound.kpi?.name || '',
        });
      }
    } else if (savedValue.status === KpiValueStatus.PENDING_MANAGER_APPROVAL) {
      const submitter = assignmentFound?.employee_id
        ? await this.employeeRepository.findOne({
            where: { id: assignmentFound.employee_id },
          })
        : null;
      if (submitter && assignmentFound?.kpi) {
        this.eventEmitter.emit('kpi_value.submitted_for_manager_approval', {
          kpiValue: savedValue,
          submitter,
          kpiName: assignmentFound.kpi.name,
          assignmentId: assignmentFound.id,
          kpiId: assignmentFound.kpi_id,
        });
      }
    }
    return savedValue;
  }

  /**
   * Reject KPI value ở cấp Department
   * Có thể reject từ PENDING_DEPT_APPROVAL hoặc PENDING_SECTION_APPROVAL
   * @param valueId - ID của KPI value cần reject
   * @param reason - Lý do reject (bắt buộc)
   * @param userId - ID của người reject
   * @returns KPI value đã được reject
   * @throws UnauthorizedException nếu user không có quyền
   * @throws BadRequestException nếu status không phù hợp hoặc thiếu lý do
   */
  async rejectValueByDepartment(
    valueId: number,
    reason: string,
    userId: number,
  ): Promise<KpiValue> {
    const kpiValue = await this.findKpiValueForWorkflow(valueId);
    const statusBefore = kpiValue.status;
    const user = await this.employeeRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) throw new UnauthorizedException('Rejecting user not found.');
    const assignment =
      kpiValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: kpiValue.kpi_assigment_id,
      }));
    // Check basic permission first
    let canReject = userHasPermission(
      user,
      'reject',
      'kpi-value',
      'department',
    );

    // If no basic permission, check department-specific logic
    if (!canReject && user.departmentId && assignment) {
      canReject =
        userHasPermission(user, 'reject', 'kpi-value', 'department') &&
        (assignment.assigned_to_department === user.departmentId ||
          assignment.employee?.departmentId === user.departmentId ||
          assignment.section?.department?.id === user.departmentId);
    }
    if (!canReject) {
      throw new UnauthorizedException(
        'User does not have permission for Department level rejection.',
      );
    }
    if (
      ![
        KpiValueStatus.PENDING_DEPT_APPROVAL,
        KpiValueStatus.PENDING_SECTION_APPROVAL,
      ].includes(kpiValue.status)
    ) {
      throw new BadRequestException(
        `Cannot reject value from status '${kpiValue.status}'. Expected '${KpiValueStatus.PENDING_DEPT_APPROVAL}' or '${KpiValueStatus.PENDING_SECTION_APPROVAL}'.`,
      );
    }
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Rejection reason is required.');
    }

    let newStatus: KpiValueStatus;
    let logAction: string;
    if (userHasPermission(user, 'reject', 'kpi-value', 'manager')) {
      newStatus = KpiValueStatus.REJECTED_BY_MANAGER;
      logAction = 'REJECT_MANAGER';
    } else if (userHasPermission(user, 'reject', 'kpi-value', 'department')) {
      newStatus = KpiValueStatus.REJECTED_BY_DEPT;
      logAction = 'REJECT_DEPT';
    } else {
      newStatus = KpiValueStatus.REJECTED_BY_SECTION;
      logAction = 'REJECT_SECTION';
    }
    kpiValue.status = newStatus;
    kpiValue.rejection_reason = reason;
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = userId;
    await this.logWorkflowHistory(
      kpiValue,
      statusBefore,
      logAction,
      userId,
      reason,
    );
    const rejectedValue = await this.kpiValuesRepository.save(kpiValue);
    const assignmentFound = await this.kpiAssignmentRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.kpi', 'kpi')
      .where('assignment.id = :id', { id: rejectedValue.kpi_assigment_id })
      .getOne();
    if (!assignmentFound) {
      console.error(
        'No assignment found for ID:',
        rejectedValue.kpi_assigment_id,
      );
    }
    if (assignmentFound && assignmentFound.employee_id) {
      this.eventEmitter.emit('kpi_value.rejected_by_user', {
        kpiValue: rejectedValue,
        submitterId: assignmentFound.employee_id,
        kpiName: assignmentFound.kpi?.name || '',
        reason,
      });
    }
    return rejectedValue;
  }

  /**
   * Approve KPI value ở cấp Manager (approval cuối cùng)
   * Có thể approve từ bất kỳ pending status nào
   * Tự động lưu managerScore và managerComment vào KpiReview nếu được cung cấp
   * @param valueId - ID của KPI value cần approve
   * @param userId - ID của người approve
   * @param managerScore - Điểm đánh giá của manager (optional)
   * @param managerComment - Comment đánh giá của manager (optional)
   * @returns KPI value đã được approve với status APPROVED
   * @throws UnauthorizedException nếu user không có quyền
   * @throws BadRequestException nếu status không phù hợp
   */
  async approveValueByManager(
    valueId: number,
    userId: number,
    managerScore?: number,
    managerComment?: string,
  ): Promise<KpiValue> {
    const kpiValue = await this.findKpiValueForWorkflow(valueId);
    const statusBefore = kpiValue.status;
    const user = await this.employeeRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new UnauthorizedException('Approving user not found.');
    }
    const assignment =
      kpiValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOne({
        where: { id: kpiValue.kpi_assigment_id },
        relations: ['kpi', 'employee', 'section', 'department'],
      }));
    // Check basic permission first
    let canApprove = userHasPermission(user, 'approve', 'kpi-value', 'manager');

    // If no basic permission, check manager-specific logic
    if (!canApprove && user.departmentId && assignment) {
      canApprove =
        userHasPermission(user, 'approve', 'kpi-value', 'manager') &&
        (assignment.assigned_to_department === user.departmentId ||
          assignment.employee?.departmentId === user.departmentId ||
          assignment.section?.department?.id === user.departmentId);
    }
    if (!canApprove) {
      throw new UnauthorizedException(
        'User does not have permission for manager approval.',
      );
    }
    if (
      ![
        KpiValueStatus.PENDING_MANAGER_APPROVAL,
        KpiValueStatus.PENDING_DEPT_APPROVAL,
        KpiValueStatus.PENDING_SECTION_APPROVAL,
      ].includes(kpiValue.status)
    ) {
      throw new BadRequestException(
        `Cannot perform final Manager Approval on value with status '${kpiValue.status}'. Expected a pending status.`,
      );
    }
    kpiValue.status = KpiValueStatus.APPROVED;
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = userId;
    kpiValue.rejection_reason = null;
    const savedValue = await this.kpiValuesRepository.save(kpiValue);
    await this.logWorkflowHistory(
      savedValue,
      statusBefore,
      'APPROVE_MANAGER',
      userId,
    );

    // Update KpiReview with manager score/comment
    // If managerScore not provided, fallback to selfScore (or departmentScore/sectionScore if available)
    if (assignment && assignment.kpi) {
      try {
        await this.kpiReviewService.ensureYearEndReviewForAssignmentIfNeeded(
          assignment.id,
        );
        const cycle = await this.findOverlappingCycleId(
          assignment.kpi.start_date,
          assignment.kpi.end_date,
        );

        if (cycle) {
          const evaluationPhase = await this.resolveEvaluationPhaseWithRepo(
            this.kpiReviewRepository,
            assignment.id,
            cycle,
          );

          let existingReview = await this.kpiReviewRepository.findOne({
            where: {
              assignment: { id: assignment.id },
              cycle: cycle,
              employee: assignment.employee
                ? { id: assignment.employee.id }
                : undefined,
              evaluationPhase,
            },
          });

          if (existingReview) {
            if (existingReview.status === ReviewStatus.COMPLETED) {
              // locked
            } else {
            if (managerScore !== undefined && managerScore !== null) {
              existingReview.managerScore = managerScore;
            } else {
              if (
                existingReview.selfScore !== undefined &&
                existingReview.selfScore !== null
              ) {
                existingReview.managerScore = existingReview.selfScore;
              } else if (
                existingReview.departmentScore !== undefined &&
                existingReview.departmentScore !== null
              ) {
                existingReview.managerScore = existingReview.departmentScore;
              } else if (
                existingReview.sectionScore !== undefined &&
                existingReview.sectionScore !== null
              ) {
                existingReview.managerScore = existingReview.sectionScore;
              }
            }
            if (managerComment !== undefined) {
              existingReview.managerComment = managerComment;
            }
            existingReview.status = ReviewStatus.COMPLETED;
            existingReview.reviewedBy = user;
            await this.kpiReviewRepository.save(existingReview);

            if (existingReview.evaluationPhase === EvaluationPhase.MID_YEAR) {
              await this.kpiReviewService.ensureYearEndReviewAfterMidCompleted(
                existingReview,
              );
            }
            }
          } else {
            // Create new review if doesn't exist
            const employee = assignment.employee
              ? await this.employeeRepository.findOne({
                  where: { id: assignment.employee.id },
                })
              : null;

            if (employee) {
              let fallbackScore = managerScore;
              if (
                (fallbackScore === undefined || fallbackScore === null) &&
                assignment.id
              ) {
                const anyReview = await this.kpiReviewRepository.findOne({
                  where: {
                    assignment: { id: assignment.id },
                    evaluationPhase,
                  },
                  order: { updatedAt: 'DESC' },
                });
                if (anyReview) {
                  if (
                    anyReview.selfScore !== undefined &&
                    anyReview.selfScore !== null
                  ) {
                    fallbackScore = anyReview.selfScore;
                  } else if (
                    anyReview.departmentScore !== undefined &&
                    anyReview.departmentScore !== null
                  ) {
                    fallbackScore = anyReview.departmentScore;
                  } else if (
                    anyReview.sectionScore !== undefined &&
                    anyReview.sectionScore !== null
                  ) {
                    fallbackScore = anyReview.sectionScore;
                  }
                }
              }

              const newReview = this.kpiReviewRepository.create({
                kpi: assignment.kpi,
                assignment: assignment,
                employee: employee,
                cycle: cycle,
                evaluationPhase,
                targetValue:
                  assignment.targetValue ?? assignment.kpi.target ?? 0,
                actualValue: savedValue.value ?? 0,
                managerScore: fallbackScore,
                managerComment: managerComment,
                status: ReviewStatus.COMPLETED,
                reviewedBy: user,
              });
              const savedNew = await this.kpiReviewRepository.save(newReview);
              if (savedNew.evaluationPhase === EvaluationPhase.MID_YEAR) {
                await this.kpiReviewService.ensureYearEndReviewAfterMidCompleted(
                  savedNew,
                );
              }
            }
          }
        }
      } catch (error) {
        this.logger.error(
          `Could not update KpiReview during manager approval: ${error.message}`,
          error.stack,
        );
        // Don't throw error, approval is still successful
      }
    }

    const assignmentFound =
      savedValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOne({
        where: { id: savedValue.kpi_assigment_id },
        relations: ['kpi'],
      }));
    if (assignmentFound && typeof assignmentFound.kpi_id === 'number') {
      this.eventEmitter.emit('kpi_value.approved', {
        kpiId: assignmentFound.kpi_id,
      });
    }
    if (
      assignmentFound &&
      assignmentFound.employee_id &&
      assignmentFound.employee_id !== userId
    ) {
      this.eventEmitter.emit('kpi_value.approved_by_user', {
        kpiValue: savedValue,
        submitterId: assignmentFound.employee_id,
        kpiName: assignmentFound.kpi?.name || '',
      });
    }
    return savedValue;
  }

  /**
   * Reject KPI value ở cấp Manager
   * Có thể reject từ bất kỳ pending status nào
   * @param valueId - ID của KPI value cần reject
   * @param reason - Lý do reject (bắt buộc)
   * @param userId - ID của người reject
   * @returns KPI value đã được reject
   * @throws UnauthorizedException nếu user không có quyền
   * @throws BadRequestException nếu status không phù hợp hoặc thiếu lý do
   */
  async rejectValueByManager(
    valueId: number,
    reason: string,
    userId: number,
  ): Promise<KpiValue> {
    const kpiValue = await this.findKpiValueForWorkflow(valueId);
    const statusBefore = kpiValue.status;
    const user = await this.employeeRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) throw new UnauthorizedException('Rejecting user not found.');
    const assignment =
      kpiValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: kpiValue.kpi_assigment_id,
      }));
    // Check basic permission first
    let canReject = userHasPermission(user, 'reject', 'kpi-value', 'manager');

    // If no basic permission, check manager-specific logic
    if (!canReject && user.departmentId && assignment) {
      canReject =
        userHasPermission(user, 'reject', 'kpi-value', 'manager') &&
        (assignment.assigned_to_department === user.departmentId ||
          assignment.employee?.departmentId === user.departmentId ||
          assignment.section?.department?.id === user.departmentId);
    }
    if (!canReject) {
      throw new UnauthorizedException(
        'User does not have permission to reject at Manager level.',
      );
    }
    if (
      ![
        KpiValueStatus.PENDING_MANAGER_APPROVAL,
        KpiValueStatus.PENDING_DEPT_APPROVAL,
        KpiValueStatus.PENDING_SECTION_APPROVAL,
      ].includes(kpiValue.status)
    ) {
      throw new BadRequestException(
        `Cannot reject value from status '${kpiValue.status}'. Expected a pending status.`,
      );
    }
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Rejection reason is required.');
    }

    let newStatus: KpiValueStatus;
    let logAction: string;
    if (userHasPermission(user, 'reject', 'kpi-value', 'manager')) {
      newStatus = KpiValueStatus.REJECTED_BY_MANAGER;
      logAction = 'REJECT_MANAGER';
    } else {
      newStatus = KpiValueStatus.REJECTED_BY_DEPT;
      logAction = 'REJECT_DEPT';
    }
    kpiValue.status = newStatus;
    kpiValue.rejection_reason = reason;
    kpiValue.updated_at = new Date();
    kpiValue.updated_by = userId;
    await this.logWorkflowHistory(
      kpiValue,
      statusBefore,
      logAction,
      userId,
      reason,
    );
    const rejectedValue = await this.kpiValuesRepository.save(kpiValue);

    const assignmentFound =
      rejectedValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOne({
        where: { id: rejectedValue.kpi_assigment_id },
        relations: ['kpi'],
      }));
    if (assignmentFound?.employee_id) {
      this.eventEmitter.emit('kpi_value.rejected_by_user', {
        kpiValue: rejectedValue,
        submitterId: assignmentFound.employee_id,
        kpiName: assignmentFound.kpi?.name || '',
        reason,
      });
    }

    return rejectedValue;
  }

  /**
   * Approve KPI review (legacy method)
   * Xác định status dựa trên quyền của approver
   * @param id - ID của KPI value
   * @param approver - Employee object của người approve
   * @returns KPI value đã được approve
   * @throws NotFoundException nếu không tìm thấy KPI value
   * @throws BadRequestException nếu KPI đã hết hạn hoặc quyền không hợp lệ
   */
  async approveKpiReview(id: number, approver: Employee): Promise<KpiValue> {
    const kpiValue = await this.kpiValuesRepository.findOne({
      where: { id },
      relations: ['kpiAssignment', 'kpiAssignment.kpi'],
    });
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found.`);
    }

    // Check if KPI has expired
    if (kpiValue.kpiAssignment?.kpi) {
      const kpiValidityStatus = getKpiStatus(
        kpiValue.kpiAssignment.kpi.start_date,
        kpiValue.kpiAssignment.kpi.end_date,
      );
      if (kpiValidityStatus === 'expired') {
        throw new BadRequestException(
          'Cannot change approval status for expired KPI. This KPI is no longer valid.',
        );
      }
    }

    if (userHasPermission(approver, 'approve', 'kpi-value', 'manager')) {
      kpiValue.status = KpiValueStatus.APPROVED;
    } else if (
      userHasPermission(approver, 'approve', 'kpi-value', 'department')
    ) {
      kpiValue.status = KpiValueStatus.PENDING_MANAGER_APPROVAL;
    } else if (userHasPermission(approver, 'approve', 'kpi-value', 'section')) {
      kpiValue.status = KpiValueStatus.PENDING_DEPT_APPROVAL;
    } else {
      throw new BadRequestException('Invalid approver permission.');
    }
    return await this.kpiValuesRepository.save(kpiValue);
  }

  /**
   * Reject KPI review (legacy method)
   * Xác định status reject dựa trên quyền của approver
   * @param id - ID của KPI value
   * @param approver - Employee object của người reject
   * @returns KPI value đã được reject
   * @throws NotFoundException nếu không tìm thấy KPI value
   * @throws BadRequestException nếu KPI đã hết hạn hoặc quyền không hợp lệ
   */
  async rejectKpiReview(id: number, approver: Employee): Promise<KpiValue> {
    const kpiValue = await this.kpiValuesRepository.findOne({
      where: { id },
      relations: ['kpiAssignment', 'kpiAssignment.kpi'],
    });
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found.`);
    }

    // Check if KPI has expired
    if (kpiValue.kpiAssignment?.kpi) {
      const kpiValidityStatus = getKpiStatus(
        kpiValue.kpiAssignment.kpi.start_date,
        kpiValue.kpiAssignment.kpi.end_date,
      );
      if (kpiValidityStatus === 'expired') {
        throw new BadRequestException(
          'Cannot change approval status for expired KPI. This KPI is no longer valid.',
        );
      }
    }

    if (userHasPermission(approver, 'reject', 'kpi-value', 'manager')) {
      kpiValue.status = KpiValueStatus.REJECTED_BY_MANAGER;
    } else if (
      userHasPermission(approver, 'reject', 'kpi-value', 'department')
    ) {
      kpiValue.status = KpiValueStatus.REJECTED_BY_DEPT;
    } else if (userHasPermission(approver, 'reject', 'kpi-value', 'section')) {
      kpiValue.status = KpiValueStatus.REJECTED_BY_SECTION;
    } else {
      throw new BadRequestException('Invalid approver permission.');
    }
    return await this.kpiValuesRepository.save(kpiValue);
  }

  /**
   * Resubmit một KPI review đã bị reject
   * Chỉ có thể resubmit các value có status REJECTED_BY_SECTION, REJECTED_BY_DEPT, hoặc REJECTED_BY_MANAGER
   * @param id - ID của KPI value cần resubmit
   * @returns KPI value với status RESUBMITTED
   * @throws NotFoundException nếu không tìm thấy KPI value
   * @throws BadRequestException nếu KPI đã hết hạn hoặc status không phù hợp
   */
  async resubmitKpiReview(id: number): Promise<KpiValue> {
    const kpiValue = await this.kpiValuesRepository.findOne({
      where: { id },
      relations: ['kpiAssignment', 'kpiAssignment.kpi'],
    });
    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${id} not found.`);
    }

    // Check if KPI has expired
    if (kpiValue.kpiAssignment?.kpi) {
      const kpiValidityStatus = getKpiStatus(
        kpiValue.kpiAssignment.kpi.start_date,
        kpiValue.kpiAssignment.kpi.end_date,
      );
      if (kpiValidityStatus === 'expired') {
        throw new BadRequestException(
          'Cannot update values for expired KPI. This KPI is no longer valid.',
        );
      }
    }

    if (
      kpiValue.status !== KpiValueStatus.REJECTED_BY_SECTION &&
      kpiValue.status !== KpiValueStatus.REJECTED_BY_DEPT &&
      kpiValue.status !== KpiValueStatus.REJECTED_BY_MANAGER
    ) {
      throw new BadRequestException(
        'Only rejected KPI reviews can be resubmitted.',
      );
    }

    kpiValue.status = KpiValueStatus.RESUBMITTED;
    return await this.kpiValuesRepository.save(kpiValue);
  }

  /**
   * Helper method để tìm KPI value với đầy đủ relations cho workflow
   * @param valueId - ID của KPI value
   * @returns KPI value với relations đầy đủ
   * @throws NotFoundException nếu không tìm thấy
   * @throws InternalServerErrorException nếu assignment không tồn tại
   */
  private async findKpiValueForWorkflow(valueId: number): Promise<KpiValue> {
    const kpiValue = await this.kpiValuesRepository.findOne({
      where: { id: valueId },
      relations: [
        'kpiAssignment',
        'kpiAssignment.kpi',
        'kpiAssignment.section',
        'kpiAssignment.department',
        'kpiAssignment.section.department',
        'kpiAssignment.employee',
      ],
    });

    if (!kpiValue) {
      throw new NotFoundException(`KPI Value with ID ${valueId} not found.`);
    }

    if (!kpiValue.kpiAssignment) {
      throw new InternalServerErrorException(
        `Assignment not found for KPI Value ID ${valueId}. Data might be inconsistent.`,
      );
    }

    return kpiValue;
  }

  /**
   * Helper method để ghi lại lịch sử workflow
   * @param kpiValue - KPI value đã thay đổi
   * @param statusBefore - Status trước khi thay đổi
   * @param action - Hành động được thực hiện (APPROVE_SECTION, REJECT_DEPT, etc.)
   * @param changedById - ID của người thực hiện thay đổi
   * @param reason - Lý do (nếu có, thường dùng cho reject)
   */
  private async logWorkflowHistory(
    kpiValue: KpiValue,
    statusBefore: KpiValueStatus | null | undefined,
    action: string,
    changedById: number,
    reason?: string,
  ): Promise<void> {
    const assignment =
      kpiValue.kpiAssignment ??
      (await this.kpiAssignmentRepository.findOneBy({
        id: kpiValue.kpi_assigment_id,
      }));

    const historyEntryData = {
      kpi_value_id: kpiValue.id,
      kpi_assigment_id: kpiValue.kpi_assigment_id,
      kpi_id: assignment?.kpi_id,
      value: kpiValue.value,
      timestamp: kpiValue.timestamp,
      notes: reason
        ? `Action: ${action}. Reason: ${reason}`
        : `Action: ${action}.`,
      reason: reason ?? null,
      status_before: statusBefore ?? null,
      status_after: kpiValue.status,
      action: action,
      changed_by: changedById,
      changed_at: new Date(),
    };
    const historyEntry = this.kpiValueHistoryRepository.create(
      historyEntryData as DeepPartial<KpiValueHistory>,
    );
    try {
      await this.kpiValueHistoryRepository.save(historyEntry);
    } catch (historyError) {
      // Log error but don't fail the main operation
      console.error('Failed to save KPI value history:', {
        kpiValueId: kpiValue.id,
        error: historyError.message,
        stack: historyError.stack
      });
      // Optionally, you could also emit an event or send to monitoring service
      // this.eventEmitter.emit('kpi.history.save.failed', { kpiValueId: kpiValue.id, error: historyError });
    }
  }

  /**
   * Lấy danh sách các KPI values đang chờ approval dựa trên quyền của user
   * Hỗ trợ filter theo section/department và group theo employee
   * @param user - Employee object của user cần lấy danh sách
   * @param groupByEmployee - Nếu true, nhóm kết quả theo employee
   * @returns Danh sách KPI values hoặc danh sách đã nhóm theo employee
   * @throws UnauthorizedException nếu user không hợp lệ
   */
  async getPendingApprovals(
    user: Employee,
    groupByEmployee: boolean = false,
  ): Promise<KpiValue[] | any[]> {
    if (
      !user ||
      !user.roles ||
      !Array.isArray(user.roles) ||
      user.roles.length === 0
    ) {
      throw new UnauthorizedException(
        'Invalid user data for fetching pending approvals.',
      );
    }

    const canApproveSection = userHasPermission(
      user,
      'approve',
      'kpi-value',
      'section',
    );
    const canApproveDepartment = userHasPermission(
      user,
      'approve',
      'kpi-value',
      'department',
    );
    const canApproveManager = userHasPermission(
      user,
      'approve',
      'kpi-value',
      'manager',
    );
    // Add view permission checks
    const canViewSection = userHasPermission(
      user,
      'view',
      'kpi-value',
      'section',
    );
    const canViewDepartment = userHasPermission(
      user,
      'view',
      'kpi-value',
      'department',
    );
    const canViewManager = userHasPermission(
      user,
      'view',
      'kpi-value',
      'manager',
    );

    const query = this.kpiValuesRepository
      .createQueryBuilder('kpiValue')
      .innerJoinAndSelect('kpiValue.kpiAssignment', 'assignment')
      .leftJoinAndSelect('assignment.kpi', 'kpi')
      .leftJoinAndSelect('assignment.employee', 'assignedEmployee')
      .leftJoinAndSelect('assignment.section', 'assignedSection')
      .leftJoinAndSelect('assignment.department', 'assignedDepartment')
      .leftJoinAndSelect(
        'assignedSection.department',
        'departmentOfAssignedSection',
      )
      .leftJoinAndSelect('assignedEmployee.section', 'employeeSection')
      .leftJoinAndSelect('assignedEmployee.department', 'employeeDepartment')
      .leftJoinAndSelect('kpi.perspective', 'perspective');
    const canSection = canApproveSection || canViewSection;
    const canDepartment = canApproveDepartment || canViewDepartment;
    const canManager = canApproveManager || canViewManager;

    // Debug logging
    this.logger.debug(
      `[getPendingApprovals] User ID: ${user.id}, Section ID: ${user.sectionId}, Department ID: ${user.departmentId}`,
    );
    this.logger.debug(
      `[getPendingApprovals] Permissions - canSection: ${canSection}, canDepartment: ${canDepartment}, canManager: ${canManager}`,
    );

    let hasAnyCondition = false;
    const isPrimarySectionScope = user.sectionId != null;
    const isPrimaryDepartmentScope =
      user.departmentId != null && !isPrimarySectionScope;

    this.logger.debug(
      `[getPendingApprovals] Primary Scope - Section: ${isPrimarySectionScope}, Department: ${isPrimaryDepartmentScope}`,
    );

    query.where(
      new Brackets((qb) => {
        if (canSection && user.sectionId && isPrimarySectionScope) {
          hasAnyCondition = true;
          this.logger.debug(
            `[getPendingApprovals] Filtering by SECTION scope - sectionId: ${user.sectionId}`,
          );
          qb.where(
            new Brackets((sqb) => {
              sqb
                .where('kpiValue.status = :sectionStatus', {
                  sectionStatus: KpiValueStatus.PENDING_SECTION_APPROVAL,
                })
                .andWhere(
                  new Brackets((secFilter) => {
                    secFilter
                      .where('assignment.assigned_to_section = :sectionId', {
                        sectionId: user.sectionId,
                      })
                      .orWhere('assignedEmployee.sectionId = :sectionId', {
                        sectionId: user.sectionId,
                      });
                  }),
                );
            }),
          );
        } else if (
          canDepartment &&
          user.departmentId &&
          isPrimaryDepartmentScope
        ) {
          hasAnyCondition = true;
          this.logger.debug(
            `[getPendingApprovals] Filtering by DEPARTMENT scope - deptId: ${user.departmentId}`,
          );
          qb.where(
            new Brackets((dqb) => {
              dqb
                .where('kpiValue.status IN (:...deptStatuses)', {
                  deptStatuses: [
                    KpiValueStatus.PENDING_SECTION_APPROVAL,
                    KpiValueStatus.PENDING_DEPT_APPROVAL,
                  ],
                })
                .andWhere(
                  new Brackets((deptFilter) => {
                    deptFilter
                      .where('assignment.assigned_to_department = :deptId', {
                        deptId: user.departmentId,
                      })
                      .orWhere('departmentOfAssignedSection.id = :deptId', {
                        deptId: user.departmentId,
                      })
                      .orWhere('assignedEmployee.departmentId = :deptId', {
                        deptId: user.departmentId,
                      });
                  }),
                );
            }),
          );
        } else if (
          canManager &&
          !isPrimarySectionScope &&
          !isPrimaryDepartmentScope
        ) {
          hasAnyCondition = true;
          this.logger.debug(
            `[getPendingApprovals] Filtering by MANAGER scope (all pending)`,
          );
          qb.where('kpiValue.status IN (:...managerStatuses)', {
            managerStatuses: [
              KpiValueStatus.PENDING_SECTION_APPROVAL,
              KpiValueStatus.PENDING_DEPT_APPROVAL,
              KpiValueStatus.PENDING_MANAGER_APPROVAL,
            ],
          });
        }
      }),
    );

    if (!hasAnyCondition) {
      return [];
    }

    query.orderBy('kpiValue.timestamp', 'ASC');
    try {
      const results = await query.getMany();

      // Debug logging results
      this.logger.debug(
        `[getPendingApprovals] Found ${results.length} KPI values`,
      );
      results.forEach((kv, idx) => {
        const assignedSection =
          kv.kpiAssignment?.assigned_to_section ||
          kv.kpiAssignment?.employee?.sectionId;
        const assignedDept =
          kv.kpiAssignment?.assigned_to_department ||
          kv.kpiAssignment?.employee?.departmentId;
        this.logger.debug(
          `[getPendingApprovals] ${idx + 1}. KPI Value ID: ${kv.id}, Status: ${kv.status}, ` +
            `Assigned Section: ${assignedSection}, Assigned Dept: ${assignedDept}, `,
        );
      });

      // If groupByEmployee is true, group results by employee
      if (groupByEmployee) {
        const groupedMap = new Map<number, any>();

        for (const kpiValue of results) {
          const employee = kpiValue.kpiAssignment?.employee;
          if (!employee) continue;

          const employeeId = employee.id;
          if (!groupedMap.has(employeeId)) {
            groupedMap.set(employeeId, {
              employee: employee,
              kpiValues: [],
              totalKpis: 0,
            });
          }

          const group = groupedMap.get(employeeId);
          group.kpiValues.push(kpiValue);
          group.totalKpis = group.kpiValues.length;
        }

        return Array.from(groupedMap.values());
      }

      return results;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy combined data (KpiValue + KpiReview) cho manager unified view
   * Trả về danh sách KpiValue kèm thông tin review (selfScore, selfComment) nếu có
   * @param user - Employee object của manager
   * @param groupByEmployee - Nếu true, nhóm kết quả theo employee
   * @returns Danh sách KpiValue với thông tin review kèm theo
   */
  async getPendingApprovalsWithReview(
    user: Employee,
    groupByEmployee: boolean = false,
  ): Promise<any[]> {
    // Lấy pending approvals như bình thường
    const pendingValues = await this.getPendingApprovals(user, false);

    if (!pendingValues || pendingValues.length === 0) {
      return groupByEmployee ? [] : [];
    }

    // Lấy tất cả assignment IDs
    const assignmentIds = pendingValues
      .map((v) => v.kpi_assigment_id)
      .filter((id) => id !== null && id !== undefined);

    if (assignmentIds.length === 0) {
      return groupByEmployee ? [] : [];
    }

    // Lấy tất cả review cycles để map cycle
    const allCycles = await this.reviewCycleRepository.find({
      order: { startDate: 'DESC' },
    });

    // Lấy KpiReview cho các assignments này
    // Tìm cycle cho mỗi KPI và query review
    const valuesWithReview = await Promise.all(
      pendingValues.map(async (kpiValue) => {
        const assignment = kpiValue.kpiAssignment;
        if (!assignment || !assignment.kpi) {
          return {
            ...kpiValue,
            review: null,
          };
        }

        // Tìm cycle cho KPI này
        const cycle = await this.findOverlappingCycleId(
          assignment.kpi.start_date,
          assignment.kpi.end_date,
        );

        if (!cycle) {
          return {
            ...kpiValue,
            review: null,
          };
        }

        await this.kpiReviewService.ensureYearEndReviewForAssignmentIfNeeded(
          assignment.id,
        );

        const evaluationPhase = await this.resolveEvaluationPhaseWithRepo(
          this.kpiReviewRepository,
          assignment.id,
          cycle,
        );

        const review = await this.kpiReviewRepository.findOne({
          where: {
            assignment: { id: assignment.id },
            cycle: cycle,
            employee: assignment.employee
              ? { id: assignment.employee.id }
              : undefined,
            evaluationPhase,
          },
          relations: ['kpi', 'employee', 'assignment'],
        });

        return {
          ...kpiValue,
          review: review
            ? {
                id: review.id,
                evaluationPhase: review.evaluationPhase,
                selfScore: review.selfScore,
                selfComment: review.selfComment,
                sectionScore: review.sectionScore,
                sectionComment: review.sectionComment,
                departmentScore: review.departmentScore,
                departmentComment: review.departmentComment,
                managerScore: review.managerScore,
                managerComment: review.managerComment,
                status: review.status,
                cycle: review.cycle,
              }
            : null,
        };
      }),
    );

    // Nếu groupByEmployee, nhóm lại
    if (groupByEmployee) {
      const groupedMap = new Map<number, any>();

      for (const item of valuesWithReview) {
        const employee = item.kpiAssignment?.employee;
        if (!employee) continue;

        const employeeId = employee.id;
        if (!groupedMap.has(employeeId)) {
          groupedMap.set(employeeId, {
            employee: employee,
            kpiValues: [],
            totalKpis: 0,
          });
        }

        const group = groupedMap.get(employeeId);
        group.kpiValues.push(item);
        group.totalKpis = group.kpiValues.length;
      }

      return Array.from(groupedMap.values());
    }

    return valuesWithReview;
  }
}
