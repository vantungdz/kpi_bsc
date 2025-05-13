export class ReviewableTargetDto {
  id: number;
  name: string;
  type: 'employee' | 'section' | 'department';
}

export class ReviewCycleDto {
  id: string;
  name: string;
}

export class KpiToReviewDto {
  assignmentId: number;
  kpiId: number;
  kpiName: string;
  kpiDescription?: string | null;
  targetValue: number | null;
  actualValue: number | null;
  unit: string | null;

  existingManagerComment?: string | null;
  existingManagerScore?: number | null;
}

export class ExistingOverallReviewDto {
  overallComment?: string | null;
  overallScore?: number | null;
  status?: string;
  employeeComment?: string | null;
  employeeFeedbackDate?: Date | null;
}

export class SubmitKpiReviewDto {
  targetId: number;
  targetType: 'employee' | 'section' | 'department';
  cycleId: string;
  overallComment?: string | null;
  overallScore?: number | null;
  kpiReviews: {
    assignmentId: number;
    managerComment?: string | null;
    managerScore?: number | null;
  }[];
}

export class KpisForReviewResponseDto {
  kpisToReview: KpiToReviewDto[];
  existingOverallReview?: ExistingOverallReviewDto | null;
}

export class CompleteReviewDto {
  targetId: number;
  targetType: 'employee' | 'section' | 'department';
  cycleId: string;
}

export class EmployeeReviewResponseDto {
  kpisReviewedByManager: KpiToReviewDto[];
  overallReviewByManager: ExistingOverallReviewDto | null;
}

export class SubmitEmployeeFeedbackDto {
  cycleId: string;
  employeeComment: string;
}

export class ReviewHistoryItemDto {
  overallReviewId: number;
  cycleId: string;
  overallComment?: string | null;
  overallScore?: number | null;
  status: string; // OverallReviewStatus
  reviewedByUsername: string; // Username of the manager
  reviewedAt: Date; // Date of the overall review
  employeeComment?: string | null;
  employeeFeedbackDate?: Date | null;
  // Optionally, include detailed KPI reviews for this cycle
  // kpiReviews?: KpiToReviewDto[]; // This might make the payload large, consider a separate API if needed
}

// DTO for the response of review history API
export type ReviewHistoryResponseDto = ReviewHistoryItemDto[];

export class PerformanceObjectiveItemDto {
  id: number; // Corresponds to KPIAssignment ID
  name: string; // KPI Name
  kpiDescription?: string | null;
  target: number | string | null; // Target value from KPIAssignment, can be number or string
  actualResult: number | string | null; // Actual result, can be number or string
  unit?: string | null;
  weight?: number | null;
  bscAspect: string; // Name of the BSC Perspective
  supervisorEvalScore?: number | null; // Supervisor's score for this objective
  note?: string | null; // Supervisor's note for this objective
}
