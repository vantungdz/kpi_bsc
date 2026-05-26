/**
 * Mã loại KPI (KPI_TYPE)
 * Trích xuất từ bảng sys_status_codes
 */
export const KPI_TYPE = {
  INDIVIDUAL: 101, // Mục tiêu cá nhân
  TEAM: 102,       // Mục tiêu phòng ban/nhóm (Cascading)
  PROMOTION: 103   // Mục tiêu thăng tiến
} as const;

/**
 * Mã quy tắc tính toán (CALC_RULE)
 */
export const CALC_RULE = {
  SUM: 801,
  AVERAGE: 802,
  COMMENT: 803,
  WEIGHTED_AVG: 804
} as const;

/**
 * Mã trạng thái chu kỳ (CYCLE_STATUS)
 */
export const CYCLE_STATUS = {
  OPEN: 201,
  CLOSED: 202
} as const;

/**
 * Mã chiều hướng tính toán (CALC_TYPE)
 */
export const CALC_TYPE = {
  ACTUAL_OVER_PLAN: 701, // Actual / Plan
  PLAN_OVER_ACTUAL: 702  // Plan / Actual
} as const;

// Status code KPI
export const KPI_STATUS = {
  // Phase 1
  INACTIVE: 401,
  WAITING_PM_APPROVAL: 402,
  WAITING_GM_APPROVAL: 403,
  PENDING_ACCEPTANCE: 404,
  ACCEPTED: 405,
  REJECTED: 406,
  FEEDBACK_IN_PROGRESS: 407,

  // Phase 2 - 1st Half
  FIRST_WAITING_PM_APPROVAL: 501,
  FIRST_WAITING_GM_APPROVAL: 502,
  FIRST_COMPLETED: 503,
  FIRST_REJECTED: 504,

  // Phase 3 - Final
  SECOND_WAITING_PM_APPROVAL: 601,
  SECOND_WAITING_GM_APPROVAL: 602,
  COMPLETED: 603,
  SECOND_REJECTED: 604,
} as const;

/** ASM codes PM/GM may reject from evaluation drawer (per-row or reject all). */
export const EVALUATION_REJECTABLE_STATUSES = [
  KPI_STATUS.FIRST_WAITING_PM_APPROVAL,
  KPI_STATUS.FIRST_WAITING_GM_APPROVAL,
  KPI_STATUS.SECOND_WAITING_PM_APPROVAL,
  KPI_STATUS.SECOND_WAITING_GM_APPROVAL,
] as const;