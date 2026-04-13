export const RBAC_ACTIONS = {
  VIEW: "view",
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  ASSIGN: "assign",
  TOGGLE_STATUS: "toggle-status",
  COPY_TEMPLATE: "copy-template",
  APPROVE: "approve",
  REJECT: "reject",
  EXPORT: "export",
};

export const RBAC_RESOURCES = {
  DASHBOARD: "dashboard",
  KPI: "kpi",
  KPI_VALUE: "kpi-value",
  KPI_REVIEW: "kpi-review",
  REPORT: "report",
  ADMIN: "admin",
  EMPLOYEE: "employee",
};

export const SCOPES = {
  GLOBAL: "global",
  COMPANY: "company",
  DEPARTMENT: "department",
  SECTION: "section",
  EMPLOYEE: "employee",
  MANAGER: "manager",
};
