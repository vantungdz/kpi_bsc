/**
 * Enum for Performance Objective Evaluation Statuses.
 * Mirrors the enum in the backend.
 */
export const ObjectiveEvaluationStatus = Object.freeze({
  PENDING_SECTION_APPROVAL: "PENDING_SECTION_APPROVAL",
  PENDING_DEPT_APPROVAL: "PENDING_DEPT_APPROVAL",
  PENDING_MANAGER_APPROVAL: "PENDING_MANAGER_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED_BY_SECTION: "REJECTED_BY_SECTION",
  REJECTED_BY_DEPT: "REJECTED_BY_DEPT",
  REJECTED_BY_MANAGER: "REJECTED_BY_MANAGER",
});

/**
 * Color mapping for ObjectiveEvaluationStatus for UI display (e.g., Ant Design Tags).
 */
export const ObjectiveEvaluationStatusColor = Object.freeze({
  [ObjectiveEvaluationStatus.PENDING_SECTION_APPROVAL]: "processing", // or 'blue'
  [ObjectiveEvaluationStatus.PENDING_DEPT_APPROVAL]: "processing", // or 'geekblue'
  [ObjectiveEvaluationStatus.PENDING_MANAGER_APPROVAL]: "processing", // or 'purple'
  [ObjectiveEvaluationStatus.APPROVED]: "success", // or 'green'
  [ObjectiveEvaluationStatus.REJECTED_BY_SECTION]: "error", // or 'red'
  [ObjectiveEvaluationStatus.REJECTED_BY_DEPT]: "error", // or 'volcano'
  [ObjectiveEvaluationStatus.REJECTED_BY_MANAGER]: "error", // or 'magenta'
  default: "default",
});

/**
 * Returns a human-readable text for a given ObjectiveEvaluationStatus.
 * Uses a tFunction (from vue-i18n useI18n) for internationalization.
 * @param {function} tFunction - The translation function.
 * @returns {object} - An object mapping status keys to their translated text.
 */
export const getObjectiveEvaluationStatusText = (tFunction) =>
  Object.freeze({
    [ObjectiveEvaluationStatus.PENDING_SECTION_APPROVAL]: tFunction("status.pendingSectionApproval"),
    [ObjectiveEvaluationStatus.PENDING_DEPT_APPROVAL]: tFunction("status.pendingDeptApproval"),
    [ObjectiveEvaluationStatus.PENDING_MANAGER_APPROVAL]: tFunction("status.pendingManagerApproval"),
    [ObjectiveEvaluationStatus.APPROVED]: tFunction("status.approved"),
    [ObjectiveEvaluationStatus.REJECTED_BY_SECTION]: tFunction("status.rejectedBySection"),
    [ObjectiveEvaluationStatus.REJECTED_BY_DEPT]: tFunction("status.rejectedByDept"),
    [ObjectiveEvaluationStatus.REJECTED_BY_MANAGER]: tFunction("status.rejectedByManager"),
    unknown: tFunction("status.unknown"),
  });

// You might need to add these keys to your i18n translation files (e.g., en.json, vi.json)
// Example for en.json:
// "status": {
//   "pendingSectionApproval": "Pending Section Approval",
//   "pendingDeptApproval": "Pending Department Approval",
//   "pendingManagerApproval": "Pending Manager Approval",
//   "approved": "Approved",
//   "rejectedBySection": "Rejected by Section",
//   "rejectedByDept": "Rejected by Department",
//   "rejectedByManager": "Rejected by Manager",
//   "unknown": "Unknown Status"
// }