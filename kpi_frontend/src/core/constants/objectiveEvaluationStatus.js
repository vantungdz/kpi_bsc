export const ObjectiveEvaluationStatus = {
  PENDING_SECTION_APPROVAL: "PENDING_SECTION_APPROVAL",
  PENDING_DEPT_APPROVAL: "PENDING_DEPT_APPROVAL",
  PENDING_MANAGER_APPROVAL: "PENDING_MANAGER_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED_BY_SECTION: "REJECTED_BY_SECTION",
  REJECTED_BY_DEPT: "REJECTED_BY_DEPT",
  REJECTED_BY_MANAGER: "REJECTED_BY_MANAGER",
};

export const ObjectiveEvaluationStatusColor = {
  [ObjectiveEvaluationStatus.PENDING_SECTION_APPROVAL]: "orange",
  [ObjectiveEvaluationStatus.PENDING_DEPT_APPROVAL]: "gold",
  [ObjectiveEvaluationStatus.PENDING_MANAGER_APPROVAL]: "blue",
  [ObjectiveEvaluationStatus.APPROVED]: "green",
  [ObjectiveEvaluationStatus.REJECTED_BY_SECTION]: "red",
  [ObjectiveEvaluationStatus.REJECTED_BY_DEPT]: "red",
  [ObjectiveEvaluationStatus.REJECTED_BY_MANAGER]: "red",
  default: "gray",
};

export const getObjectiveEvaluationStatusText = (t) => ({
  [ObjectiveEvaluationStatus.PENDING_SECTION_APPROVAL]: t(
    "status_array.pendingSectionApproval"
  ),
  [ObjectiveEvaluationStatus.PENDING_DEPT_APPROVAL]: t(
    "status_array.pendingDeptApproval"
  ),
  [ObjectiveEvaluationStatus.PENDING_MANAGER_APPROVAL]: t(
    "status_array.pendingManagerApproval"
  ),
  [ObjectiveEvaluationStatus.APPROVED]: t("status_array.approved"),
  [ObjectiveEvaluationStatus.REJECTED_BY_SECTION]: t(
    "status_array.rejectedBySection"
  ),
  [ObjectiveEvaluationStatus.REJECTED_BY_DEPT]: t(
    "status_array.rejectedByDept"
  ),
  [ObjectiveEvaluationStatus.REJECTED_BY_MANAGER]: t(
    "status_array.rejectedByManager"
  ),
  unknown: t("status_array.unknown"),
});
