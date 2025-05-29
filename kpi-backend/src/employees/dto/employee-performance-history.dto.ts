export class EmployeePerformanceYearDto {
  year: number;
  averageKpiScore: number;
  achievedCount: number;
  notAchievedCount: number;
  achievedRate: number;
  notAchievedRate: number;
  highlightComments?: string[];
}

export class EmployeePerformanceHistoryDto {
  employeeId: number;
  fullName: string;
  department?: string;
  years: EmployeePerformanceYearDto[];
}
