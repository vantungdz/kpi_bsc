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
export const getKpiValueStatusText = (i18n) => ({
  [KpiValueStatus.DRAFT]: i18n.t('draft'),
  [KpiValueStatus.SUBMITTED]: i18n.t('submitted'),
  [KpiValueStatus.PENDING_SECTION_APPROVAL]: i18n.t('pendingSectionApproval'),
  [KpiValueStatus.PENDING_DEPT_APPROVAL]: i18n.t('pendingDeptApproval'),
  [KpiValueStatus.PENDING_MANAGER_APPROVAL]: i18n.t('pendingManagerApproval'),
  [KpiValueStatus.APPROVED]: i18n.t('approved'),
  [KpiValueStatus.REJECTED_BY_SECTION]: i18n.t('rejectedBySection'),
  [KpiValueStatus.REJECTED_BY_DEPT]: i18n.t('rejectedByDept'),
  [KpiValueStatus.REJECTED_BY_MANAGER]: i18n.t('rejectedByManager'),
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

export const KpiDefinitionStatusText = (i18n) => ({
  [KpiDefinitionStatus.DRAFT]: i18n.t('draft'),
  [KpiDefinitionStatus.APPROVED]: i18n.t('approved'),
});

export const KpiDefinitionStatusColor = {
  [KpiDefinitionStatus.DRAFT]: "default", // Màu xám hoặc vàng
  [KpiDefinitionStatus.APPROVED]: "success", // Màu xanh lá
};
