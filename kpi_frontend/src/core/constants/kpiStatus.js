// Ví dụ: src/constants/kpiStatus.js

export const KpiValueStatus = Object.freeze({
  DRAFT: "DRAFT", // Nếu có dùng
  SUBMITTED: "SUBMITTED", // Có thể đây là trạng thái đầu tiên sau submit?
  PENDING_SECTION_APPROVAL: "PENDING_SECTION_APPROVAL",
  PENDING_DEPT_APPROVAL: "PENDING_DEPT_APPROVAL",
  PENDING_MANAGER_APPROVAL: "PENDING_MANAGER_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED_BY_SECTION: "REJECTED_BY_SECTION",
  REJECTED_BY_DEPT: "REJECTED_BY_DEPT",
  REJECTED_BY_MANAGER: "REJECTED_BY_MANAGER",
});

// Bạn cũng có thể định nghĩa thêm text hoặc màu sắc tương ứng ở đây nếu muốn
export const getKpiValueStatusText = (t) => ({
  [KpiValueStatus.DRAFT]: t("draft"),
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
  [KpiValueStatus.DRAFT]: "default",
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
  APPROVED: "APPROVED",
});

export const KpiDefinitionStatusText = (t) => ({
  [KpiDefinitionStatus.DRAFT]: t("draft"),
  [KpiDefinitionStatus.APPROVED]: t("approved"),
});

export const KpiDefinitionStatusColor = {
  [KpiDefinitionStatus.DRAFT]: "default", // Màu xám hoặc vàng
  [KpiDefinitionStatus.APPROVED]: "success", // Màu xanh lá
};
