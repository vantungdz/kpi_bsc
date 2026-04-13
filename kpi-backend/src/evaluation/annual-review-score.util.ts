import {
  EvaluationPhase,
  KpiReview,
  ReviewStatus,
} from './entities/kpi-review.entity';

export const ANNUAL_SCORE_WEIGHTS = [0.4, 0.6] as const;

export type AnnualFinalScoreResult =
  | {
      score: number;
      h1: number;
      h2: number;
      weights: readonly [number, number];
    }
  | {
      score: null;
      incompleteReason: string;
      h1: number | null;
      h2: number | null;
      weights: readonly [number, number];
    };

export function getFinalScoreFromReview(
  review: KpiReview | null | undefined,
): number | null {
  if (!review) return null;

  if (
    review.managerScore != null &&
    [
      ReviewStatus.MANAGER_REVIEWED,
      ReviewStatus.EMPLOYEE_FEEDBACK,
      ReviewStatus.COMPLETED,
    ].includes(review.status)
  ) {
    return review.managerScore;
  }
  if (
    review.departmentScore != null &&
    review.status === ReviewStatus.DEPARTMENT_REVIEWED
  ) {
    return review.departmentScore;
  }
  if (
    review.sectionScore != null &&
    review.status === ReviewStatus.SECTION_REVIEWED
  ) {
    return review.sectionScore;
  }
  if (
    review.selfScore != null &&
    review.status === ReviewStatus.SELF_REVIEWED
  ) {
    return review.selfScore;
  }
  return null;
}

export function partitionReviewsByPhase(reviews: KpiReview[]): {
  midYear: KpiReview | null;
  yearEnd: KpiReview | null;
} {
  let midYear: KpiReview | null = null;
  let yearEnd: KpiReview | null = null;
  for (const r of reviews) {
    if (r.evaluationPhase === EvaluationPhase.MID_YEAR) midYear = r;
    else if (r.evaluationPhase === EvaluationPhase.YEAR_END) yearEnd = r;
  }
  return { midYear, yearEnd };
}

/**
 * Active phase for writes: H1 until MID_YEAR is COMPLETED, then YEAR_END.
 */
export function resolveActiveEvaluationPhase(
  midYear: KpiReview | null,
  yearEnd: KpiReview | null,
): EvaluationPhase | null {
  if (!midYear && !yearEnd) return null;
  if (!midYear) return EvaluationPhase.YEAR_END;
  if (midYear.status !== ReviewStatus.COMPLETED) {
    return EvaluationPhase.MID_YEAR;
  }
  return EvaluationPhase.YEAR_END;
}

export function pickActiveReview(
  midYear: KpiReview | null,
  yearEnd: KpiReview | null,
): KpiReview | null {
  const phase = resolveActiveEvaluationPhase(midYear, yearEnd);
  if (phase === null) return null;
  if (phase === EvaluationPhase.MID_YEAR) return midYear;
  return yearEnd ?? midYear;
}

export function calculateAnnualFinalScoreFromReviews(
  midYear: KpiReview | null | undefined,
  yearEnd: KpiReview | null | undefined,
): AnnualFinalScoreResult {
  const h1 =
    midYear?.status === ReviewStatus.COMPLETED &&
    midYear.managerScore != null &&
    midYear.managerScore !== undefined
      ? Number(midYear.managerScore)
      : null;
  const h2 =
    yearEnd?.status === ReviewStatus.COMPLETED &&
    yearEnd.managerScore != null &&
    yearEnd.managerScore !== undefined
      ? Number(yearEnd.managerScore)
      : null;

  if (h1 != null && h2 != null) {
    const score = h1 * ANNUAL_SCORE_WEIGHTS[0] + h2 * ANNUAL_SCORE_WEIGHTS[1];
    return {
      score,
      h1,
      h2,
      weights: ANNUAL_SCORE_WEIGHTS,
    };
  }

  let incompleteReason = 'Missing completed mid-year or year-end review scores.';
  if (h1 == null && h2 == null) {
    incompleteReason =
      'Mid-year and year-end reviews are not both completed with manager scores.';
  } else if (h1 == null) {
    incompleteReason =
      'Mid-year review is not completed with a manager score.';
  } else {
    incompleteReason =
      'Year-end review is not completed with a manager score.';
  }

  return {
    score: null,
    incompleteReason,
    h1,
    h2,
    weights: ANNUAL_SCORE_WEIGHTS,
  };
}

/**
 * For dashboards before both phases are final: prefer blended annual score;
 * otherwise fall back to the pipeline score of the active review only (single weight).
 */
export function effectiveManagerScoreForReporting(
  midYear: KpiReview | null,
  yearEnd: KpiReview | null,
): number | null {
  const annual = calculateAnnualFinalScoreFromReviews(midYear, yearEnd);
  if ('score' in annual && annual.score !== null) return annual.score;
  const active = pickActiveReview(midYear, yearEnd);
  return getFinalScoreFromReview(active);
}
