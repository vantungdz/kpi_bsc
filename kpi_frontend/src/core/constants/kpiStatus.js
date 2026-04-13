export const KpiValueStatus = Object.freeze({
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  NOT_SUBMIT: "NOT_SUBMIT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  PENDING_SECTION_APPROVAL: "PENDING_SECTION_APPROVAL",
  PENDING_DEPT_APPROVAL: "PENDING_DEPT_APPROVAL",
  PENDING_MANAGER_APPROVAL: "PENDING_MANAGER_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED_BY_SECTION: "REJECTED_BY_SECTION",
  REJECTED_BY_DEPT: "REJECTED_BY_DEPT",
  REJECTED_BY_MANAGER: "REJECTED_BY_MANAGER",
});

export const getKpiValueStatusText = (t) => ({
  [KpiValueStatus.PENDING_APPROVAL]: t("pendingApproval"),
  [KpiValueStatus.DRAFT]: t("draft"),
  [KpiValueStatus.NOT_SUBMIT]: t("notSubmitted"),
  [KpiValueStatus.SUBMITTED]: t("submitted"),
  [KpiValueStatus.PENDING_SECTION_APPROVAL]: t("pendingSectionApproval"),
  [KpiValueStatus.PENDING_DEPT_APPROVAL]: t("pendingDeptApproval"),
  [KpiValueStatus.PENDING_MANAGER_APPROVAL]: t("pendingManagerApproval"),
  [KpiValueStatus.APPROVED]: t("approved"),
  [KpiValueStatus.REJECTED_BY_SECTION]: t("rejectedBySection"),
  [KpiValueStatus.REJECTED_BY_DEPT]: t("rejectedByDept"),
  [KpiValueStatus.REJECTED_BY_MANAGER]: t("rejectedByManager"),
});

export const KpiValueStatusColor = {
  [KpiValueStatus.PENDING_APPROVAL]: "processing",
  [KpiValueStatus.DRAFT]: "default",
  [KpiValueStatus.NOT_SUBMIT]: "default",
  [KpiValueStatus.SUBMITTED]: "processing",
  [KpiValueStatus.PENDING_SECTION_APPROVAL]: "processing",
  [KpiValueStatus.PENDING_DEPT_APPROVAL]: "processing",
  [KpiValueStatus.PENDING_MANAGER_APPROVAL]: "processing",
  [KpiValueStatus.APPROVED]: "success",
  [KpiValueStatus.REJECTED_BY_SECTION]: "error",
  [KpiValueStatus.REJECTED_BY_DEPT]: "error",
  [KpiValueStatus.REJECTED_BY_MANAGER]: "error",
};

export const KpiDefinitionStatus = Object.freeze({
  DRAFT: "DRAFT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
});

export const KpiDefinitionStatusText = (t) => ({
  [KpiDefinitionStatus.DRAFT]: t("draft"),
  [KpiDefinitionStatus.PENDING_APPROVAL]: t("pendingApproval"),
  [KpiDefinitionStatus.APPROVED]: t("approved"),
  [KpiDefinitionStatus.REJECTED]: t("rejected"),
});

export const KpiDefinitionStatusColor = {
  [KpiDefinitionStatus.DRAFT]: "default",
  [KpiDefinitionStatus.PENDING_APPROVAL]: "processing",
  [KpiDefinitionStatus.APPROVED]: "success",
  [KpiDefinitionStatus.REJECTED]: "error",
};
