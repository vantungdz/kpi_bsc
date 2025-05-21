// RBAC action/resource constants. Import and use everywhere instead of hardcode.

export const RBAC_ACTIONS = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  EXPORT: 'export',
  TOGGLE_STATUS: 'toggle_status',
  ASSIGN_USER: 'assign_user',
  ASSIGN_UNIT: 'assign_unit',
  ASSIGN_DIRECT_USER: 'assign_direct_user',
  ASSIGN_SECTION: 'assign_section',
  REJECT: 'reject',
  APPROVE: 'approve',
  COPY_TEMPLATE: 'copy_template',
  MANAGE_ASSIGNMENT: 'manage_assignment',
  MANAGE: 'manage',
};

export const RBAC_RESOURCES = {
  KPI: 'kpi',
  EMPLOYEE: 'employee',
  DASHBOARD: 'dashboard',
  KPI_COMPANY: 'kpi_company',
  KPI_DEPARTMENT: 'kpi_department',
  KPI_SECTION: 'kpi_section',
  KPI_PERSONAL: 'kpi_personal',
  APPROVAL: 'approval',
  MY_KPI_REVIEW: 'my_kpi_review',
  OBJECTIVE_APPROVAL: 'objective_approval',
  REPORT_GENERATOR: 'report_generator',
  EMPLOYEE_KPI_SCORES: 'employee_kpi_scores',
  KPI_REVIEW: 'kpi_review',
  PERFORMANCE_OBJECTIVE_APPROVAL: 'performance_objective_approval',
  KPI_VALUE: 'kpi_value',
  ADMIN: 'admin',
};

// Danh sách đầy đủ các cặp action/resource sử dụng trong hệ thống FE
export const RBAC_PERMISSION_PAIRS = [
  // KPI chung
  { action: RBAC_ACTIONS.EDIT, resource: RBAC_RESOURCES.KPI },
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.KPI },
  { action: RBAC_ACTIONS.TOGGLE_STATUS, resource: RBAC_RESOURCES.KPI },
  { action: RBAC_ACTIONS.COPY_TEMPLATE, resource: RBAC_RESOURCES.KPI },
  { action: RBAC_ACTIONS.MANAGE_ASSIGNMENT, resource: RBAC_RESOURCES.KPI },
  { action: RBAC_ACTIONS.ASSIGN_USER, resource: RBAC_RESOURCES.KPI },
  { action: RBAC_ACTIONS.ASSIGN_UNIT, resource: RBAC_RESOURCES.KPI },
  { action: RBAC_ACTIONS.ASSIGN_DIRECT_USER, resource: RBAC_RESOURCES.KPI },
  { action: RBAC_ACTIONS.ASSIGN_SECTION, resource: RBAC_RESOURCES.KPI },

  // KPI Company/Department/Section/Personal
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.KPI_COMPANY },
  { action: RBAC_ACTIONS.CREATE, resource: RBAC_RESOURCES.KPI_COMPANY },
  { action: RBAC_ACTIONS.DELETE, resource: RBAC_RESOURCES.KPI_COMPANY },
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.KPI_DEPARTMENT },
  { action: RBAC_ACTIONS.CREATE, resource: RBAC_RESOURCES.KPI_DEPARTMENT },
  { action: RBAC_ACTIONS.DELETE, resource: RBAC_RESOURCES.KPI_DEPARTMENT },
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.KPI_SECTION },
  { action: RBAC_ACTIONS.CREATE, resource: RBAC_RESOURCES.KPI_SECTION },
  { action: RBAC_ACTIONS.DELETE, resource: RBAC_RESOURCES.KPI_SECTION },
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.KPI_PERSONAL },
  { action: RBAC_ACTIONS.CREATE, resource: RBAC_RESOURCES.KPI_PERSONAL },
  { action: RBAC_ACTIONS.DELETE, resource: RBAC_RESOURCES.KPI_PERSONAL },

  // KPI Value
  { action: RBAC_ACTIONS.APPROVE, resource: RBAC_RESOURCES.KPI_VALUE },
  { action: RBAC_ACTIONS.REJECT, resource: RBAC_RESOURCES.KPI_VALUE },
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.KPI_VALUE },

  // KPI Review
  { action: RBAC_ACTIONS.APPROVE, resource: RBAC_RESOURCES.KPI_REVIEW },
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.KPI_REVIEW },

  // Employee
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.EMPLOYEE },
  { action: RBAC_ACTIONS.CREATE, resource: RBAC_RESOURCES.EMPLOYEE },
  { action: RBAC_ACTIONS.EDIT, resource: RBAC_RESOURCES.EMPLOYEE },
  { action: RBAC_ACTIONS.DELETE, resource: RBAC_RESOURCES.EMPLOYEE },

  // Employee KPI Scores
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.EMPLOYEE_KPI_SCORES },

  // Approval
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.APPROVAL },

  // My KPI Review
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.MY_KPI_REVIEW },

  // Objective Approval / Performance Objective Approval
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.OBJECTIVE_APPROVAL },
  { action: RBAC_ACTIONS.EDIT, resource: RBAC_RESOURCES.OBJECTIVE_APPROVAL },
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.PERFORMANCE_OBJECTIVE_APPROVAL },
  { action: RBAC_ACTIONS.EDIT, resource: RBAC_RESOURCES.PERFORMANCE_OBJECTIVE_APPROVAL },

  // Dashboard
  { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.DASHBOARD },

  // Report/Report Generator
  { action: 'export', resource: 'report' },
  { action: 'export', resource: RBAC_RESOURCES.REPORT_GENERATOR },
];
