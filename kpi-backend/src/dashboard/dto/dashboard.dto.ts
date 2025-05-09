export class KpiPerformanceOverviewDto {
  totalKpis: number;
  achievedCount: number;
  notAchievedCount: number;
  achievedRate: number;
  notAchievedRate: number;
  notUpdatedRecentlyCount: number;
  totalKpisWithValues: number;
  notUpdatedRecentlyRate: number;
  performanceByRole?: PerformanceByRoleDto[];
}

// DTO mới cho KPI Inventory Stats
export class KpiInventoryDto {
  totalKpiDefinitions: number;
  totalKpiAssignments: number;
  assignmentsByDepartment?: {
    departmentId: number;
    departmentName: string;
    count: number;
  }[];
  assignmentsByStatus?: {
    status: string;
    count: number;
  }[];
}

export class PerformanceByRoleDto {
  roleType: 'department' | 'section' | 'employee';
  roleId: number;
  roleName: string;
  totalAssignedKpis: number; 
  achievedCount: number;
  notAchievedCount: number;
  achievedRate?: number;
}
