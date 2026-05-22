/** GET /kpi/member|leader/dashboard-options */
export interface KpiDashboardOptions {
  yearsWithAssignments: number[]
  hasOrgMembership: boolean
}

export type YearDropdownOption = { value: number; label: string }
