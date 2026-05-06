/** Payload `data` từ `GET /kpi/gm/diagnostics-hierarchy` (Spring `GmDiagnosticsHierarchyResponse`). */

export interface GmDiagnosticsHierarchyApiData {
  year: number
  cycleId: string
  cycleName: string
  cycleStatusCode: number | null
  catalogItems: GmKpiCatalogItemApi[]
  kpis: GmDiagKpiApi[]
}

export interface GmKpiCatalogItemApi {
  id: string
  cycleId: string
  masterKpiId: string
  code: string | null
  name: string
  categoryId: string | null
  categoryName: string | null
  typeCode: number
  calculationRuleCode: number | null
  calculationTypeCode: number | null
  unitCode: number | null
  isGlobal: boolean | null
  targetDescription: string | null
  targetValue: number | string | null
  weight: number | string | null
  isImportant: boolean | null
}

export interface GmDiagKpiApi {
  id: string
  name: string
  weight: string
  target: string
  /** `short` | `ok` | `excess` — so với tổng target assignment. */
  targetBalance?: string | null
  actual: string
  status: string
  blockerSummary: string
  kpiType: string
  /** `kpi_master.unit_code` — KPI_UNIT; map sang select Unit trên form. */
  unitCode?: number | null
  /** `kpi_master.category_id` — đồng bộ thư viện; không dùng BSC cố định. */
  categoryId?: string | null
  /** `kpi_categories.name` */
  categoryName?: string | null
  lifecycleStatus?: string | null
  isImportant?: boolean | null
  /** `kpi_master.is_global` — GM giao công ty vs member đề xuất. */
  isGlobal?: boolean | null
  pmOwners: GmDiagPmApi[]
  investigateDeptId?: string | null
  investigateKpiName?: string | null
}

export interface GmDiagPmApi {
  id: string
  name: string
  /** UUID manager phòng (section) — trùng `members[0].id` khi chỉ có assignee là manager. */
  ownerUserId?: string | null
  ownerRoleCode?: string | null
  /** `roles.name` manager phòng — nhãn tag (không suy từ code trên FE). */
  ownerRoleLabel?: string | null
  unitLine: string
  /** Cùng trọng số KPI (diagnostics). */
  weight?: string | null
  target: string
  targetBalance?: string | null
  actual: string
  status: string
  blockerSummary: string
  members: GmDiagMemberApi[]
  leaders?: GmDiagLeaderApi[] | null
}

export interface GmDiagLeaderApi {
  id: string
  name: string
  ownerRoleCode?: string | null
  /** `roles.name` supervisor nhóm. */
  ownerRoleLabel?: string | null
  weight?: string | null
  target: string
  targetBalance?: string | null
  actual: string
  status: string
  blockerSummary: string
  members: GmDiagMemberApi[]
}

export interface GmDiagMemberApi {
  id: string
  assignmentId?: string | null
  name: string
  weight?: string | null
  /** `kpi_assignments.status_code` (ASM). */
  statusCode?: number | null
  target: string
  targetBalance?: string | null
  actual: string
  status: string
  /** `roles.code` của assignee — badge cạnh tên trong breakdown. */
  ownerRoleCode?: string | null
  /** `roles.name` assignee — nhãn tag. */
  ownerRoleLabel?: string | null
  /** `roles.code` supervisor. */
  leaderRoleCode?: string | null
  /** `roles.name` supervisor (nhóm leader). */
  leaderRoleName?: string | null
  /** Nhãn trạng thái hiệu suất (tiếng Việt) từ BE; mock có thể thiếu. */
  performanceLabel?: string | null
  /** Mục tiêu năm (số trần) — đồng bộ % Actual và tiến độ trên bảng diagnostics. */
  submissionTarget?: number | string | null
  /** Giữa kỳ: điểm giữa kỳ; cuối kỳ: điểm final sau GM→PM→self. */
  submissionActual?: number | string | null
  feedbackNote?: string | null
  blocker: string
  rank?: string | null
  leader?: string | null
}
