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
export const KpiValueStatusText = {
  [KpiValueStatus.DRAFT]: "Bản nháp",
  [KpiValueStatus.SUBMITTED]: "Đã gửi",
  [KpiValueStatus.PENDING_SECTION_APPROVAL]: "Chờ Section duyệt",
  [KpiValueStatus.PENDING_DEPT_APPROVAL]: "Chờ Department duyệt",
  [KpiValueStatus.PENDING_MANAGER_APPROVAL]: "Chờ Manager duyệt",
  [KpiValueStatus.APPROVED]: "Đã duyệt",
  [KpiValueStatus.REJECTED_BY_SECTION]: "Bị Section từ chối",
  [KpiValueStatus.REJECTED_BY_DEPT]: "Bị Department từ chối",
  [KpiValueStatus.REJECTED_BY_MANAGER]: "Bị Manager từ chối",
};

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

export const KpiDefinitionStatusText = {
  [KpiDefinitionStatus.DRAFT]: "Bản nháp",
  [KpiDefinitionStatus.APPROVED]: "Đã duyệt",
};

export const KpiDefinitionStatusColor = {
  [KpiDefinitionStatus.DRAFT]: "default", // Màu xám hoặc vàng
  [KpiDefinitionStatus.APPROVED]: "success", // Màu xanh lá
};
