// RBAC action/resource constants. Import and use everywhere instead of hardcode.

export const RBAC_ACTIONS = {
  VIEW: 'view',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  TOGGLE_STATUS: 'toggle-status',
  ASSIGN: 'assign',
  APPROVE: 'approve',
  REJECT: 'reject',
  EXPORT: 'export',
};

export const RBAC_RESOURCES = {
  // KPI
  KPI_COMPANY: 'kpi:company',
  KPI_DEPARTMENT: 'kpi:department',
  KPI_SECTION: 'kpi:section',
  KPI_EMPLOYEE: 'kpi:employee',
  // KPI Value
  KPI_VALUE_COMPANY: 'kpi-value:company',
  KPI_VALUE_DEPARTMENT: 'kpi-value:department',
  KPI_VALUE_SECTION: 'kpi-value:section',
  KPI_VALUE_MANAGER: 'kpi-value:manager',
  KPI_VALUE_EMPLOYEE: 'kpi-value:employee',
  // Department
  DEPARTMENT_COMPANY: 'department:company',
  // Section
  SECTION_COMPANY: 'section:company',
  SECTION_DEPARTMENT: 'section:department',
  SECTION_EMPLOYEE: 'section:employee',
  // Employee
  EMPLOYEE_COMPANY: 'employee:company',
  // Role/Permission
  ROLE_COMPANY: 'role:company',
  PERMISSION_COMPANY: 'permission:company',
  // Report
  REPORT_COMPANY: 'report:company',
  REPORT_DEPARTMENT: 'report:department',
  // Dashboard
  DASHBOARD_COMPANY: 'dashboard:company',
  DASHBOARD_DEPARTMENT: 'dashboard:department',
  DASHBOARD_SECTION: 'dashboard:section',
  DASHBOARD_EMPLOYEE: 'dashboard:employee',
};

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  DEPARTMENT: 'department',
  SECTION: 'section',
  EMPLOYEE: 'employee',
};

// Danh sách đầy đủ các cặp action/resource sử dụng trong hệ thống
export const RBAC_PERMISSION_PAIRS = [
  // KPI
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.KPI_COMPANY },
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.KPI_DEPARTMENT },
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.KPI_SECTION },
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.KPI_EMPLOYEE },
  { action: RBAC_ACTIONS.CREATE, resource: RBAC_RESOURCES.KPI_COMPANY },
  { action: RBAC_ACTIONS.CREATE, resource: RBAC_RESOURCES.KPI_DEPARTMENT },
  { action: RBAC_ACTIONS.CREATE, resource: RBAC_RESOURCES.KPI_SECTION },
  { action: RBAC_ACTIONS.CREATE, resource: RBAC_RESOURCES.KPI_EMPLOYEE },
  { action: RBAC_ACTIONS.UPDATE, resource: RBAC_RESOURCES.KPI_COMPANY },
  { action: RBAC_ACTIONS.UPDATE, resource: RBAC_RESOURCES.KPI_DEPARTMENT },
  { action: RBAC_ACTIONS.UPDATE, resource: RBAC_RESOURCES.KPI_SECTION },
  { action: RBAC_ACTIONS.UPDATE, resource: RBAC_RESOURCES.KPI_EMPLOYEE },
  { action: RBAC_ACTIONS.DELETE, resource: RBAC_RESOURCES.KPI_COMPANY },
  { action: RBAC_ACTIONS.DELETE, resource: RBAC_RESOURCES.KPI_DEPARTMENT },
  { action: RBAC_ACTIONS.DELETE, resource: RBAC_RESOURCES.KPI_SECTION },
  { action: RBAC_ACTIONS.DELETE, resource: RBAC_RESOURCES.KPI_EMPLOYEE },
  { action: RBAC_ACTIONS.ASSIGN, resource: RBAC_RESOURCES.KPI_COMPANY },
  { action: RBAC_ACTIONS.ASSIGN, resource: RBAC_RESOURCES.KPI_DEPARTMENT },
  { action: RBAC_ACTIONS.ASSIGN, resource: RBAC_RESOURCES.KPI_SECTION },
  { action: RBAC_ACTIONS.ASSIGN, resource: RBAC_RESOURCES.KPI_EMPLOYEE },
  { action: RBAC_ACTIONS.TOGGLE_STATUS, resource: RBAC_RESOURCES.KPI_COMPANY },
  {
    action: RBAC_ACTIONS.TOGGLE_STATUS,
    resource: RBAC_RESOURCES.KPI_DEPARTMENT,
  },
  { action: RBAC_ACTIONS.TOGGLE_STATUS, resource: RBAC_RESOURCES.KPI_SECTION },
  { action: RBAC_ACTIONS.TOGGLE_STATUS, resource: RBAC_RESOURCES.KPI_EMPLOYEE },
  // KPI Value
  { action: RBAC_ACTIONS.APPROVE, resource: RBAC_RESOURCES.KPI_VALUE_SECTION },
  {
    action: RBAC_ACTIONS.APPROVE,
    resource: RBAC_RESOURCES.KPI_VALUE_DEPARTMENT,
  },
  { action: RBAC_ACTIONS.APPROVE, resource: RBAC_RESOURCES.KPI_VALUE_MANAGER },
  { action: RBAC_ACTIONS.REJECT, resource: RBAC_RESOURCES.KPI_VALUE_SECTION },
  {
    action: RBAC_ACTIONS.REJECT,
    resource: RBAC_RESOURCES.KPI_VALUE_DEPARTMENT,
  },
  { action: RBAC_ACTIONS.REJECT, resource: RBAC_RESOURCES.KPI_VALUE_MANAGER },
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.KPI_VALUE_COMPANY },
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.KPI_VALUE_DEPARTMENT },
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.KPI_VALUE_SECTION },
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.KPI_VALUE_EMPLOYEE },
  // Department
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.DEPARTMENT_COMPANY },
  { action: RBAC_ACTIONS.CREATE, resource: RBAC_RESOURCES.DEPARTMENT_COMPANY },
  { action: RBAC_ACTIONS.UPDATE, resource: RBAC_RESOURCES.DEPARTMENT_COMPANY },
  { action: RBAC_ACTIONS.DELETE, resource: RBAC_RESOURCES.DEPARTMENT_COMPANY },
  // Section
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.SECTION_COMPANY },
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.SECTION_DEPARTMENT },
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.SECTION_EMPLOYEE },
  { action: RBAC_ACTIONS.CREATE, resource: RBAC_RESOURCES.SECTION_COMPANY },
  { action: RBAC_ACTIONS.UPDATE, resource: RBAC_RESOURCES.SECTION_COMPANY },
  { action: RBAC_ACTIONS.DELETE, resource: RBAC_RESOURCES.SECTION_COMPANY },
  // Employee
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.EMPLOYEE_COMPANY },
  { action: RBAC_ACTIONS.CREATE, resource: RBAC_RESOURCES.EMPLOYEE_COMPANY },
  { action: RBAC_ACTIONS.UPDATE, resource: RBAC_RESOURCES.EMPLOYEE_COMPANY },
  { action: RBAC_ACTIONS.DELETE, resource: RBAC_RESOURCES.EMPLOYEE_COMPANY },
  // Role/Permission
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.ROLE_COMPANY },
  { action: RBAC_ACTIONS.CREATE, resource: RBAC_RESOURCES.ROLE_COMPANY },
  { action: RBAC_ACTIONS.UPDATE, resource: RBAC_RESOURCES.ROLE_COMPANY },
  { action: RBAC_ACTIONS.DELETE, resource: RBAC_RESOURCES.ROLE_COMPANY },
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.PERMISSION_COMPANY },
  // Report
  { action: RBAC_ACTIONS.EXPORT, resource: RBAC_RESOURCES.REPORT_COMPANY },
  { action: RBAC_ACTIONS.EXPORT, resource: RBAC_RESOURCES.REPORT_DEPARTMENT },
  // Dashboard
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.DASHBOARD_COMPANY },
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.DASHBOARD_DEPARTMENT },
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.DASHBOARD_SECTION },
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.DASHBOARD_EMPLOYEE },
];
