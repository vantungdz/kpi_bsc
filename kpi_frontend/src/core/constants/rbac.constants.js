// RBAC action/resource constants. Import and use everywhere instead of hardcode.

export const RBAC_ACTIONS = {
  VIEW: "view",
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  TOGGLE_STATUS: "toggle-status",
  ASSIGN: "assign",
  APPROVE: "approve",
  REJECT: "reject",
  EXPORT: "export",
  // Additional dynamic action for KPI management
  COPY_TEMPLATE: "copy-template",
};

export const RBAC_RESOURCES = {
  KPI: "kpi",
  KPI_VALUE: "kpi-value",
  KPI_REVIEW: "kpi-review",
  EMPLOYEE_COMPANY: "employee:company",
  REPORT: "report",
  DASHBOARD: "dashboard",
  ADMIN: "admin",
  EMPLOYEE: "employee",
};

export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  DEPARTMENT: "department",
  SECTION: "section",
  EMPLOYEE: "employee",
};
