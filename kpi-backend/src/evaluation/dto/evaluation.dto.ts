// DTOs for Evaluation/Review Module

// DTO for a reviewable target (Employee, Section, or Department)
export class ReviewableTargetDto {
  id: number;
  name: string;
  type: 'employee' | 'section' | 'department';
}

// DTO for a review cycle
export class ReviewCycleDto {
  id: string; // Or number, depending on how you identify cycles (e.g., '2024-Q2', '2023-Year')
  name: string; // Friendly name (e.g., 'Quý 2 - 2024', 'Năm 2023')
}

// DTO for a KPI item to be reviewed (fetched from backend)
export class KpiToReviewDto {
  assignmentId: number;
  kpiId: number;
  kpiName: string;
  targetValue: number | null;
  actualValue: number | null; // The latest approved/final value
  unit: string | null;
  // Existing review data (if any)
  existingManagerComment?: string | null;
  existingManagerScore?: number | null; // If using scores
  // Add other relevant fields like assignment period, etc.
}

// DTO for submitting the review results
export class SubmitKpiReviewDto {
  targetId: number;
  targetType: 'employee' | 'section' | 'department';
  cycleId: string; // Or number
  overallComment?: string | null;
  overallScore?: number | null; // If using overall score
  kpiReviews: {
    assignmentId: number;
    managerComment?: string | null;
    managerScore?: number | null; // If using scores per KPI
  }[];
}