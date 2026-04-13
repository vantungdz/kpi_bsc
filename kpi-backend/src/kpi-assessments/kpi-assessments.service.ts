import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  KpiValue,
  KpiValueStatus,
} from '../kpi-values/entities/kpi-value.entity';
import { KPIAssignment } from 'src/kpi-assessments/entities/kpi-assignment.entity';
import { getKpiStatus } from '../kpis/kpis.service';
import {
  EvaluationPhase,
  KpiReview,
  ReviewStatus,
} from '../evaluation/entities/kpi-review.entity';
import {
  partitionReviewsByPhase,
  pickActiveReview,
  resolveActiveEvaluationPhase,
} from '../evaluation/annual-review-score.util';
import { KpiReviewService } from '../evaluation/kpi-review.service';
import { Employee } from '../employees/entities/employee.entity';

interface WorkflowActor {
  id: number | null;
  name: string;
}

interface WorkflowI18nPayload {
  key: string;
  params?: Record<string, string>;
}

interface WorkflowStep {
  key: string;
  title: string;
  status: 'completed' | 'current' | 'pending' | 'rejected';
  description: string;
  at?: string | null;
  /** Bản dịch phía client: `workflow.detail.descriptions.<key>` */
  descriptionI18n?: WorkflowI18nPayload;
}

interface AssignmentWorkflow {
  assignmentId: number;
  currentStepKey: string;
  currentStepTitle: string;
  overallStatus: string;
  nextAction: string;
  /** Bản dịch phía client: `workflow.detail.nextAction.<key>` */
  nextActionI18n?: WorkflowI18nPayload;
  owner: WorkflowActor | null;
  subject: WorkflowActor | null;
  scopeLabel: string;
  /** employee | section | department | assigned — map `workflow.detail.scope.<key>` */
  scopeKey: string;
  latestValueId: number | null;
  latestReviewId: number | null;
  /** Same as latestReviewId: the review row driving workflow (active phase). */
  activeReviewId: number | null;
  activePhase: EvaluationPhase | null;
  reviewsByPhase: {
    midYear: KpiReview | null;
    yearEnd: KpiReview | null;
  };
  steps: WorkflowStep[];
}

@Injectable()
export class KpiAssignmentsService {
  constructor(
    @InjectRepository(KPIAssignment)
    private kpiAssignmentRepository: Repository<KPIAssignment>,
    @InjectRepository(KpiValue)
    private kpiValueRepository: Repository<KpiValue>,
    @InjectRepository(KpiReview)
    private kpiReviewRepository: Repository<KpiReview>,
    private readonly kpiReviewService: KpiReviewService,
  ) {}

  async getUserAssignedKpis(employeeId: number): Promise<KPIAssignment[]> {
    return this.kpiAssignmentRepository.find({
      where: { employee_id: employeeId },
      relations: ['kpi', 'kpi.assignments'],
    });
  }

  async submitTarget(
    assignmentId: number,
    target: number,
    employeeId: number,
  ): Promise<KPIAssignment> {
    const assignment = await this.kpiAssignmentRepository.findOne({
      where: { id: assignmentId, employee_id: employeeId },
      relations: ['kpi'],
    });
    if (!assignment) {
      throw new NotFoundException(
        `KPI Assignment with ID ${assignmentId} not found`,
      );
    }

    // Check if KPI has expired
    if (assignment.kpi) {
      const kpiValidityStatus = getKpiStatus(
        assignment.kpi.start_date,
        assignment.kpi.end_date,
      );
      if (kpiValidityStatus === 'expired') {
        throw new BadRequestException(
          'Cannot update target value for expired KPI. This KPI is no longer valid.',
        );
      }
    }

    assignment.targetValue = target;
    assignment.status = KpiValueStatus.SUBMITTED;
    assignment.submitted_at = new Date();
    return this.kpiAssignmentRepository.save(assignment);
  }

  async getApprovedKpiValues(): Promise<KpiValue[]> {
    return this.kpiValueRepository.find({
      where: { status: KpiValueStatus.APPROVED },
      relations: ['kpi', 'user', 'kpiAssignment'],
    });
  }

  async softDelete(id: number): Promise<void> {
    await this.kpiAssignmentRepository.softDelete(id);
  }

  async getAssignmentWorkflow(assignmentId: number): Promise<AssignmentWorkflow> {
    const assignment = await this.kpiAssignmentRepository.findOne({
      where: { id: assignmentId },
      relations: [
        'kpi',
        'employee',
        'department',
        'section',
        'kpiValues',
        'reviews',
        'reviews.reviewedBy',
        'reviews.employee',
      ],
      withDeleted: false,
    });

    if (!assignment) {
      throw new NotFoundException(
        `KPI Assignment with ID ${assignmentId} not found`,
      );
    }

    await this.kpiReviewService.ensureYearEndReviewForAssignmentIfNeeded(
      assignmentId,
    );

    const assignmentReloaded = await this.kpiAssignmentRepository.findOne({
      where: { id: assignmentId },
      relations: [
        'kpi',
        'employee',
        'department',
        'section',
        'kpiValues',
        'reviews',
        'reviews.reviewedBy',
        'reviews.employee',
      ],
      withDeleted: false,
    });
    if (!assignmentReloaded) {
      throw new NotFoundException(
        `KPI Assignment with ID ${assignmentId} not found`,
      );
    }

    const latestValue = this.getLatestValue(assignmentReloaded.kpiValues || []);
    const { midYear, yearEnd } = partitionReviewsByPhase(
      assignmentReloaded.reviews || [],
    );
    const activePhase = resolveActiveEvaluationPhase(midYear, yearEnd);
    const latestReview = pickActiveReview(midYear, yearEnd);
    const subject = this.getSubjectActor(assignmentReloaded);
    const scopeLabel = this.getScopeLabel(assignmentReloaded);

    const valueStage = this.resolveValueStage(latestValue);
    const reviewStage = this.resolveReviewStage(latestReview);

    const owner = this.resolveOwner(
      assignmentReloaded,
      latestValue,
      latestReview,
    );

    const scopeKey = this.getScopeKey(assignmentReloaded);

    const steps: WorkflowStep[] = [
      {
        key: 'definition',
        title: 'KPI created',
        status: 'completed',
        description:
          assignmentReloaded.kpi?.status === 'APPROVED'
            ? 'KPI definition approved and active.'
            : `KPI definition is ${assignmentReloaded.kpi?.status || 'available'}.`,
        at: this.toIsoString(assignmentReloaded.kpi?.created_at),
        descriptionI18n: this.getDefinitionDescriptionI18n(
          assignmentReloaded.kpi,
        ),
      },
      {
        key: 'assignment',
        title: 'Assigned',
        status: 'completed',
        description: `${scopeLabel} assigned${subject?.name ? ` to ${subject.name}` : ''}.`,
        at: this.toIsoString(
          assignmentReloaded.assignedAt || assignmentReloaded.created_at,
        ),
        descriptionI18n: {
          key: 'assignmentAssigned',
          params: {
            scopeKey,
            subjectName: subject?.name || '',
          },
        },
      },
      {
        key: 'progress',
        title: 'Progress update',
        status: valueStage.progress,
        description: this.getProgressDescription(latestValue),
        at: this.toIsoString(latestValue?.updated_at || latestValue?.created_at),
        descriptionI18n: this.getProgressDescriptionI18n(latestValue),
      },
      {
        key: 'section_approval',
        title: 'Section approval',
        status: valueStage.section,
        description: this.getSectionDescription(latestValue),
        at: this.toIsoString(latestValue?.updated_at),
        descriptionI18n: this.getSectionDescriptionI18n(latestValue),
      },
      {
        key: 'department_approval',
        title: 'Department approval',
        status: valueStage.department,
        description: this.getDepartmentDescription(latestValue),
        at: this.toIsoString(latestValue?.updated_at),
        descriptionI18n: this.getDepartmentDescriptionI18n(latestValue),
      },
      {
        key: 'manager_approval',
        title: 'Manager approval',
        status: valueStage.manager,
        description: this.getManagerDescription(latestValue),
        at: this.toIsoString(latestValue?.updated_at),
        descriptionI18n: this.getManagerDescriptionI18n(latestValue),
      },
      {
        key: 'review',
        title: 'Performance review',
        status: reviewStage.review,
        description: this.getReviewDescription(latestReview),
        at: this.toIsoString(latestReview?.updatedAt || latestReview?.createdAt),
        descriptionI18n: this.getReviewDescriptionI18n(latestReview),
      },
    ];

    const currentStep =
      steps.find((step) => step.status === 'current' || step.status === 'rejected') ||
      steps[steps.length - 1];

    return {
      assignmentId: assignmentReloaded.id,
      currentStepKey: currentStep.key,
      currentStepTitle: currentStep.title,
      overallStatus:
        latestReview?.status ||
        latestValue?.status ||
        assignmentReloaded.status,
      nextAction: this.getNextAction(latestValue, latestReview),
      nextActionI18n: this.getNextActionI18n(latestValue, latestReview),
      owner,
      subject,
      scopeLabel,
      scopeKey,
      latestValueId: latestValue?.id ?? null,
      latestReviewId: latestReview?.id ?? null,
      activeReviewId: latestReview?.id ?? null,
      activePhase,
      reviewsByPhase: { midYear, yearEnd },
      steps,
    };
  }

  private getLatestValue(values: KpiValue[]): KpiValue | null {
    if (!values.length) return null;
    return [...values].sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at || b.timestamp).getTime() -
        new Date(a.updated_at || a.created_at || a.timestamp).getTime(),
    )[0];
  }

  private getLatestReview(reviews: KpiReview[]): KpiReview | null {
    if (!reviews.length) return null;
    return [...reviews].sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime(),
    )[0];
  }

  private resolveValueStage(latestValue: KpiValue | null) {
    if (!latestValue) {
      return {
        progress: 'current' as const,
        section: 'pending' as const,
        department: 'pending' as const,
        manager: 'pending' as const,
      };
    }

    switch (latestValue.status) {
      case KpiValueStatus.DRAFT:
        return {
          progress: 'current' as const,
          section: 'pending' as const,
          department: 'pending' as const,
          manager: 'pending' as const,
        };
      case KpiValueStatus.SUBMITTED:
      case KpiValueStatus.PENDING_SECTION_APPROVAL:
      case KpiValueStatus.RESUBMITTED:
        return {
          progress: 'completed' as const,
          section: 'current' as const,
          department: 'pending' as const,
          manager: 'pending' as const,
        };
      case KpiValueStatus.REJECTED_BY_SECTION:
        return {
          progress: 'rejected' as const,
          section: 'rejected' as const,
          department: 'pending' as const,
          manager: 'pending' as const,
        };
      case KpiValueStatus.PENDING_DEPT_APPROVAL:
        return {
          progress: 'completed' as const,
          section: 'completed' as const,
          department: 'current' as const,
          manager: 'pending' as const,
        };
      case KpiValueStatus.REJECTED_BY_DEPT:
        return {
          progress: 'rejected' as const,
          section: 'completed' as const,
          department: 'rejected' as const,
          manager: 'pending' as const,
        };
      case KpiValueStatus.PENDING_MANAGER_APPROVAL:
        return {
          progress: 'completed' as const,
          section: 'completed' as const,
          department: 'completed' as const,
          manager: 'current' as const,
        };
      case KpiValueStatus.REJECTED_BY_MANAGER:
        return {
          progress: 'rejected' as const,
          section: 'completed' as const,
          department: 'completed' as const,
          manager: 'rejected' as const,
        };
      case KpiValueStatus.APPROVED:
        return {
          progress: 'completed' as const,
          section: 'completed' as const,
          department: 'completed' as const,
          manager: 'completed' as const,
        };
      default:
        return {
          progress: 'current' as const,
          section: 'pending' as const,
          department: 'pending' as const,
          manager: 'pending' as const,
        };
    }
  }

  private resolveReviewStage(latestReview: KpiReview | null) {
    if (!latestReview) {
      return { review: 'pending' as const };
    }

    switch (latestReview.status) {
      case ReviewStatus.PENDING:
        return { review: 'current' as const };
      case ReviewStatus.COMPLETED:
        return { review: 'completed' as const };
      case ReviewStatus.SECTION_REJECTED:
      case ReviewStatus.DEPARTMENT_REJECTED:
      case ReviewStatus.MANAGER_REJECTED:
        return { review: 'rejected' as const };
      default:
        return { review: 'current' as const };
    }
  }

  private getScopeLabel(assignment: KPIAssignment): string {
    if (assignment.employee) return 'Employee KPI';
    if (assignment.section) return 'Section KPI';
    if (assignment.department) return 'Department KPI';
    return 'Assigned KPI';
  }

  private getSubjectActor(assignment: KPIAssignment): WorkflowActor | null {
    if (assignment.employee) {
      return this.toActor(assignment.employee);
    }
    if (assignment.section) {
      return {
        id: assignment.section.id ?? null,
        name: assignment.section.name || 'Section',
      };
    }
    if (assignment.department) {
      return {
        id: assignment.department.id ?? null,
        name: assignment.department.name || 'Department',
      };
    }
    return null;
  }

  private resolveOwner(
    assignment: KPIAssignment,
    latestValue: KpiValue | null,
    latestReview: KpiReview | null,
  ): WorkflowActor | null {
    if (latestReview) {
      switch (latestReview.status) {
        case ReviewStatus.PENDING:
        case ReviewStatus.SECTION_REJECTED:
        case ReviewStatus.DEPARTMENT_REJECTED:
        case ReviewStatus.MANAGER_REJECTED:
          return latestReview.employee ? this.toActor(latestReview.employee) : this.getSubjectActor(assignment);
        case ReviewStatus.SELF_REVIEWED:
          return {
            id: assignment.section?.id ?? null,
            name: assignment.section?.name || 'Section reviewer',
          };
        case ReviewStatus.SECTION_REVIEWED:
          return {
            id: assignment.department?.id ?? null,
            name: assignment.department?.name || 'Department reviewer',
          };
        case ReviewStatus.DEPARTMENT_REVIEWED:
        case ReviewStatus.EMPLOYEE_FEEDBACK:
        case ReviewStatus.PENDING_MANAGER_APPROVAL:
          return latestReview.reviewedBy
            ? this.toActor(latestReview.reviewedBy)
            : { id: null, name: 'Manager reviewer' };
        case ReviewStatus.COMPLETED:
        case ReviewStatus.MANAGER_REVIEWED:
          return null;
        default:
          break;
      }
    }

    if (!latestValue || latestValue.status === KpiValueStatus.DRAFT) {
      return this.getSubjectActor(assignment);
    }

    switch (latestValue.status) {
      case KpiValueStatus.PENDING_SECTION_APPROVAL:
      case KpiValueStatus.SUBMITTED:
      case KpiValueStatus.RESUBMITTED:
        return {
          id: assignment.section?.id ?? null,
          name: assignment.section?.name || 'Section approver',
        };
      case KpiValueStatus.PENDING_DEPT_APPROVAL:
        return {
          id: assignment.department?.id ?? null,
          name: assignment.department?.name || 'Department approver',
        };
      case KpiValueStatus.PENDING_MANAGER_APPROVAL:
        return { id: null, name: 'Manager approver' };
      case KpiValueStatus.REJECTED_BY_SECTION:
      case KpiValueStatus.REJECTED_BY_DEPT:
      case KpiValueStatus.REJECTED_BY_MANAGER:
        return this.getSubjectActor(assignment);
      default:
        return null;
    }
  }

  private getNextAction(
    latestValue: KpiValue | null,
    latestReview: KpiReview | null,
  ): string {
    if (!latestValue) return 'Submit first progress update';
    switch (latestValue.status) {
      case KpiValueStatus.DRAFT:
        return 'Complete draft and submit progress';
      case KpiValueStatus.SUBMITTED:
      case KpiValueStatus.PENDING_SECTION_APPROVAL:
        return 'Wait for section approval';
      case KpiValueStatus.PENDING_DEPT_APPROVAL:
        return 'Wait for department approval';
      case KpiValueStatus.PENDING_MANAGER_APPROVAL:
        return 'Wait for manager approval';
      case KpiValueStatus.REJECTED_BY_SECTION:
      case KpiValueStatus.REJECTED_BY_DEPT:
      case KpiValueStatus.REJECTED_BY_MANAGER:
        return 'Revise progress and resubmit';
      case KpiValueStatus.APPROVED:
        if (!latestReview) return 'Start performance review when cycle opens';
        switch (latestReview.status) {
          case ReviewStatus.PENDING:
            return 'Submit self review';
          case ReviewStatus.SELF_REVIEWED:
            return 'Wait for section review';
          case ReviewStatus.SECTION_REVIEWED:
            return 'Wait for department review';
          case ReviewStatus.DEPARTMENT_REVIEWED:
            return 'Wait for manager review';
          case ReviewStatus.MANAGER_REVIEWED:
            return 'Workflow completed';
          case ReviewStatus.EMPLOYEE_FEEDBACK:
            return 'Employee needs to provide feedback';
          case ReviewStatus.PENDING_MANAGER_APPROVAL:
            return 'Manager confirms final review';
          case ReviewStatus.SECTION_REJECTED:
          case ReviewStatus.DEPARTMENT_REJECTED:
          case ReviewStatus.MANAGER_REJECTED:
            return 'Update self review and resubmit';
          case ReviewStatus.COMPLETED:
            return 'Workflow completed';
          default:
            return 'Review in progress';
        }
      default:
        return 'Workflow in progress';
    }
  }

  private getProgressDescription(latestValue: KpiValue | null): string {
    if (!latestValue) return 'No progress has been submitted yet.';
    if (latestValue.status === KpiValueStatus.DRAFT) return 'Draft progress is saved but not submitted.';
    return `Latest submitted value is ${Number(latestValue.value || 0).toLocaleString()}.`;
  }

  private getSectionDescription(latestValue: KpiValue | null): string {
    if (!latestValue) return 'Waiting for first progress submission.';
    switch (latestValue.status) {
      case KpiValueStatus.PENDING_SECTION_APPROVAL:
      case KpiValueStatus.SUBMITTED:
      case KpiValueStatus.RESUBMITTED:
        return 'Waiting for section approval.';
      case KpiValueStatus.REJECTED_BY_SECTION:
        return latestValue.rejection_reason || 'Rejected at section level.';
      case KpiValueStatus.PENDING_DEPT_APPROVAL:
      case KpiValueStatus.PENDING_MANAGER_APPROVAL:
      case KpiValueStatus.APPROVED:
      case KpiValueStatus.REJECTED_BY_DEPT:
      case KpiValueStatus.REJECTED_BY_MANAGER:
        return 'Section approval completed.';
      default:
        return 'Section approval has not started.';
    }
  }

  private getDepartmentDescription(latestValue: KpiValue | null): string {
    if (!latestValue) return 'Waiting for previous step.';
    switch (latestValue.status) {
      case KpiValueStatus.PENDING_DEPT_APPROVAL:
        return 'Waiting for department approval.';
      case KpiValueStatus.REJECTED_BY_DEPT:
        return latestValue.rejection_reason || 'Rejected at department level.';
      case KpiValueStatus.PENDING_MANAGER_APPROVAL:
      case KpiValueStatus.APPROVED:
      case KpiValueStatus.REJECTED_BY_MANAGER:
        return 'Department approval completed.';
      default:
        return 'Department approval has not started.';
    }
  }

  private getManagerDescription(latestValue: KpiValue | null): string {
    if (!latestValue) return 'Waiting for previous step.';
    switch (latestValue.status) {
      case KpiValueStatus.PENDING_MANAGER_APPROVAL:
        return 'Waiting for manager approval.';
      case KpiValueStatus.REJECTED_BY_MANAGER:
        return latestValue.rejection_reason || 'Rejected at manager level.';
      case KpiValueStatus.APPROVED:
        return 'Manager approval completed.';
      default:
        return 'Manager approval has not started.';
    }
  }

  private getReviewDescription(latestReview: KpiReview | null): string {
    if (!latestReview) return 'Review has not started yet.';
    switch (latestReview.status) {
      case ReviewStatus.PENDING:
        return 'Waiting for self review.';
      case ReviewStatus.SELF_REVIEWED:
        return 'Self review completed, waiting for section review.';
      case ReviewStatus.SECTION_REVIEWED:
        return 'Section review completed, waiting for department review.';
      case ReviewStatus.DEPARTMENT_REVIEWED:
        return 'Department review completed, waiting for manager review.';
      case ReviewStatus.MANAGER_REVIEWED:
        return 'Performance review completed.';
      case ReviewStatus.EMPLOYEE_FEEDBACK:
        return 'Manager reviewed, waiting for employee feedback.';
      case ReviewStatus.PENDING_MANAGER_APPROVAL:
        return 'Employee feedback submitted, waiting for final confirmation.';
      case ReviewStatus.SECTION_REJECTED:
      case ReviewStatus.DEPARTMENT_REJECTED:
      case ReviewStatus.MANAGER_REJECTED:
        return latestReview.rejectionReason || 'Review was rejected and needs revision.';
      case ReviewStatus.COMPLETED:
        return 'Performance review completed.';
      default:
        return 'Review in progress.';
    }
  }

  private getScopeKey(assignment: KPIAssignment): string {
    if (assignment.employee) return 'employee';
    if (assignment.section) return 'section';
    if (assignment.department) return 'department';
    return 'assigned';
  }

  private getDefinitionDescriptionI18n(
    kpi: KPIAssignment['kpi'],
  ): WorkflowI18nPayload {
    if (kpi?.status === 'APPROVED') {
      return { key: 'definitionApproved' };
    }
    return {
      key: 'definitionStatus',
      params: { status: String(kpi?.status || '—') },
    };
  }

  private getProgressDescriptionI18n(
    latestValue: KpiValue | null,
  ): WorkflowI18nPayload {
    if (!latestValue) return { key: 'progressNone' };
    if (latestValue.status === KpiValueStatus.DRAFT) {
      return { key: 'progressDraft' };
    }
    return {
      key: 'progressSubmitted',
      params: { value: String(Number(latestValue.value || 0)) },
    };
  }

  private getSectionDescriptionI18n(
    latestValue: KpiValue | null,
  ): WorkflowI18nPayload {
    if (!latestValue) return { key: 'sectionWaitFirst' };
    switch (latestValue.status) {
      case KpiValueStatus.PENDING_SECTION_APPROVAL:
      case KpiValueStatus.SUBMITTED:
      case KpiValueStatus.RESUBMITTED:
        return { key: 'sectionWaitApproval' };
      case KpiValueStatus.REJECTED_BY_SECTION:
        return {
          key: 'sectionRejected',
          params: {
            reason: latestValue.rejection_reason || '',
          },
        };
      case KpiValueStatus.PENDING_DEPT_APPROVAL:
      case KpiValueStatus.PENDING_MANAGER_APPROVAL:
      case KpiValueStatus.APPROVED:
      case KpiValueStatus.REJECTED_BY_DEPT:
      case KpiValueStatus.REJECTED_BY_MANAGER:
        return { key: 'sectionCompleted' };
      default:
        return { key: 'sectionNotStarted' };
    }
  }

  private getDepartmentDescriptionI18n(
    latestValue: KpiValue | null,
  ): WorkflowI18nPayload {
    if (!latestValue) return { key: 'deptWaitPrev' };
    switch (latestValue.status) {
      case KpiValueStatus.PENDING_DEPT_APPROVAL:
        return { key: 'deptWaitApproval' };
      case KpiValueStatus.REJECTED_BY_DEPT:
        return {
          key: 'deptRejected',
          params: { reason: latestValue.rejection_reason || '' },
        };
      case KpiValueStatus.PENDING_MANAGER_APPROVAL:
      case KpiValueStatus.APPROVED:
      case KpiValueStatus.REJECTED_BY_MANAGER:
        return { key: 'deptCompleted' };
      default:
        return { key: 'deptNotStarted' };
    }
  }

  private getManagerDescriptionI18n(
    latestValue: KpiValue | null,
  ): WorkflowI18nPayload {
    if (!latestValue) return { key: 'managerWaitPrev' };
    switch (latestValue.status) {
      case KpiValueStatus.PENDING_MANAGER_APPROVAL:
        return { key: 'managerWaitApproval' };
      case KpiValueStatus.REJECTED_BY_MANAGER:
        return {
          key: 'managerRejected',
          params: { reason: latestValue.rejection_reason || '' },
        };
      case KpiValueStatus.APPROVED:
        return { key: 'managerCompleted' };
      default:
        return { key: 'managerNotStarted' };
    }
  }

  private getReviewDescriptionI18n(
    latestReview: KpiReview | null,
  ): WorkflowI18nPayload {
    if (!latestReview) return { key: 'reviewNotStarted' };
    switch (latestReview.status) {
      case ReviewStatus.PENDING:
        return { key: 'reviewWaitSelf' };
      case ReviewStatus.SELF_REVIEWED:
        return { key: 'reviewSelfDone' };
      case ReviewStatus.SECTION_REVIEWED:
        return { key: 'reviewSectionDone' };
      case ReviewStatus.DEPARTMENT_REVIEWED:
        return { key: 'reviewDeptDone' };
      case ReviewStatus.EMPLOYEE_FEEDBACK:
        return { key: 'reviewEmployeeFeedback' };
      case ReviewStatus.PENDING_MANAGER_APPROVAL:
        return { key: 'reviewPendingManager' };
      case ReviewStatus.SECTION_REJECTED:
      case ReviewStatus.DEPARTMENT_REJECTED:
      case ReviewStatus.MANAGER_REJECTED:
        return {
          key: 'reviewRejected',
          params: { reason: latestReview.rejectionReason || '' },
        };
      case ReviewStatus.COMPLETED:
        return { key: 'reviewCompleted' };
      default:
        return { key: 'reviewInProgress' };
    }
  }

  private getNextActionI18n(
    latestValue: KpiValue | null,
    latestReview: KpiReview | null,
  ): WorkflowI18nPayload {
    if (!latestValue) return { key: 'submitFirstProgress' };
    switch (latestValue.status) {
      case KpiValueStatus.DRAFT:
        return { key: 'completeDraftSubmit' };
      case KpiValueStatus.SUBMITTED:
      case KpiValueStatus.PENDING_SECTION_APPROVAL:
        return { key: 'waitSectionApproval' };
      case KpiValueStatus.PENDING_DEPT_APPROVAL:
        return { key: 'waitDeptApproval' };
      case KpiValueStatus.PENDING_MANAGER_APPROVAL:
        return { key: 'waitManagerApproval' };
      case KpiValueStatus.REJECTED_BY_SECTION:
      case KpiValueStatus.REJECTED_BY_DEPT:
      case KpiValueStatus.REJECTED_BY_MANAGER:
        return { key: 'reviseResubmit' };
      case KpiValueStatus.APPROVED:
        if (!latestReview) return { key: 'startReviewWhenCycleOpens' };
        switch (latestReview.status) {
          case ReviewStatus.PENDING:
            return { key: 'submitSelfReview' };
          case ReviewStatus.SELF_REVIEWED:
            return { key: 'waitSectionReview' };
          case ReviewStatus.SECTION_REVIEWED:
            return { key: 'waitDeptReview' };
          case ReviewStatus.DEPARTMENT_REVIEWED:
            return { key: 'waitManagerReview' };
          case ReviewStatus.EMPLOYEE_FEEDBACK:
            return { key: 'employeeFeedbackNeeded' };
          case ReviewStatus.PENDING_MANAGER_APPROVAL:
            return { key: 'managerFinalConfirm' };
          case ReviewStatus.SECTION_REJECTED:
          case ReviewStatus.DEPARTMENT_REJECTED:
          case ReviewStatus.MANAGER_REJECTED:
            return { key: 'updateSelfReviewResubmit' };
          case ReviewStatus.COMPLETED:
            return { key: 'workflowCompleted' };
          default:
            return { key: 'reviewCycleInProgress' };
        }
      default:
        return { key: 'workflowInProgress' };
    }
  }

  private toActor(employee?: Employee | null): WorkflowActor | null {
    if (!employee) return null;
    const fullName =
      `${employee.first_name || ''} ${employee.last_name || ''}`.trim() ||
      employee.username;
    return {
      id: employee.id ?? null,
      name: fullName || 'Unknown user',
    };
  }

  private toIsoString(value?: Date | null): string | null {
    if (!value) return null;
    return new Date(value).toISOString();
  }
}
