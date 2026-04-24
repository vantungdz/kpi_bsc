/** Một dòng `GET /kpi/reference/department-managers` — user là `departments.manager_id`. */
export interface DepartmentManagerOption {
  id: string
  username: string
  email: string
  fullName: string
  managingDepartmentsLabel?: string | null
}
