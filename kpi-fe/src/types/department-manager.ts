/** Một dòng `GET /kpi/reference/department-managers` — user active có role PM. */
export interface DepartmentManagerOption {
  id: string
  username: string
  email: string
  fullName: string
  managingDepartmentsLabel?: string | null
}
