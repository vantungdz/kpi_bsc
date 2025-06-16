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
  // Bổ sung action động cho quản trị KPI
  COPY_TEMPLATE: "copy-template",
};

export const RBAC_RESOURCES = {
  KPI: "kpi",
  KPI_VALUE: "kpi-value",
  EMPLOYEE_COMPANY: "employee:company",
  REPORT: "report",
  DASHBOARD: "dashboard",
  ADMIN: "admin",
};

export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  DEPARTMENT: "department",
  SECTION: "section",
  EMPLOYEE: "employee",
};
