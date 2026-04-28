import {KpiCycleResponse} from "@/types/shared/kpi-cycle.type";

/** Evaluation period: start-of-year, mid-year, year-end */
export type EvalPhase = 'target_setup' | 'mid_year' | 'year_end'

export interface KpiPeriod {
  id: string
  year: number
  currentPhase: EvalPhase
  phaseLabel: string
}

/** Form layout inside the member evidence drawer (khai báo theo loại KPI) */
export type EvidenceFormCase =
  | 'monthly'
  | 'project_metrics'
  | 'general'
  | 'upload_only'
  /** Nhóm B: một layout — Evidence + nhập điểm + comment */
  | 'category_b'

/**
 * Trạng thái đánh giá KPI (member view) — nguồn API; FE có thể suy luận khi thiếu.
 */
export type MemberKpiEvaluationStatus =
  | 'not_started'       // ⚪ Chưa đánh giá
  | 'pending_approval'  // 🟡 Chờ duyệt
  | 'approved'          // 🟢 Đã duyệt
  | 'revision'          // 🟠 Cần làm lại
  | 'overdue'           // 🔴 Quá hạn

/** KPI Item (individual KPI row in the KPI sheet) */
export interface KpiItem {
  id: string
  code: string
  name: string
  description?: string
  /** Cột Chỉ tiêu — ưu tiên target_description từ API (có thể HTML) */
  target: string
  /** ka.target_value — mục tiêu giao cho cá nhân */
  assignmentTargetValue?: number | null
  /** ki.target_value — chỉ tiêu chuẩn thư viện KPI */
  kpiTemplateTargetValue?: number | null
  /** kpi_assignments.status_code */
  statusCode?: number | null
  /** Nhãn ASM_STATUS từ API */
  assignmentStatusName?: string | null
  weight: number
  group: string
  /** kpi_categories — nhóm hiển thị Personal KPI */
  categoryId?: string | null
  categoryName?: string | null
  /** kpi_master.calculation_rule_code (801–804) */
  calculationRuleCode?: number | null
  /** kpi_master.calculation_type_code — 701 (Actual/Plan) | 702 (Plan/Actual) */
  calculationTypeCode?: number | null
  /** JSON string kpi_assignments.evidences — dùng trang chi tiết */
  evidencesJson?: string | null
  /** Trạng thái đánh giá KPI — chuỗi từ API (member sheet) */
  evaluationStatus?: MemberKpiEvaluationStatus | string
  /** Nhãn hiển thị tùy chọn từ API (song song evaluationStatus) */
  evaluationState?: string | null
  /** Luồng member: quyền chỉnh minh chứng / mở drawer — mặc định an toàn khi thiếu */
  canEditEvidence?: boolean
  canViewEvidence?: boolean
  canEditScore?: boolean
  evidenceTooltip?: string | null
  evidenceStatus: 'submitted' | 'missing' | 'pending'
  /** Nếu backend không gửi, FE có thể suy luận theo mã KPI */
  evidenceFormCase?: EvidenceFormCase
  evidenceNote?: string
  /**
   * KPI chứng chỉ (upload_only): mô tả chứng chỉ / trình độ thực tế nếu khác mục tiêu trên sheet
   * (vd đăng ký TOEIC 700 nhưng nộp JLPT N2).
   */
  certificateOutcomeNote?: string
  selfScore: number | null
  pmScore: number | null
  leaderScore: number | null
  /** Kết quả / thực tế — hiển thị cột Actual Result dạng Result / Actual */
  result?: string | null
  actual?: string | null
  /** Chi tiết layout general: nhiều dòng Plan / Actual (lưu tạm FE / đồng bộ API sau) */
  planActualRecords?: Array<{ plan: string; actual: string }>
  /** KPI A.2 / Work Amount (monthly): tháng 1–12 + Spent / Standard (giờ); Actual Result = (ΣSpent/ΣStd)×100% */
  waTimeRecords?: Array<{ month: string; spent: string; standard: string }>
}

/** KPI Sheet for a member */
export interface KpiSheet {
  id: string
  userId: string
  userName: string
  rank: string
  year: number
  phase: EvalPhase
  items: KpiItem[]
  totalWeight: number
  evidenceCount: number
  evidenceTotalCount: number
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
}

/** Section (Department) in GM view */
export interface KpiSection {
  id: string
  name: string
  managerId: string
  managerName: string
  memberCount: number
  targetSetupPct: number
  midYearPct: number
  yearEndPct: number
  pendingCount: number
}

/** Section member detail for GM detail view */
export interface KpiSectionMember {
  id: string
  name: string
  rank: string
  targetStatus: 'Approved' | 'Pending' | 'Draft'
  midYearStatus: 'Approved' | 'Pending' | 'Draft'
  finalStatus: 'Completed' | 'Evaluating' | 'Not Started'
  score: number | null
}

/** GM Dashboard data */
export interface GmKpiDashboard {
  year: number
  currentPhase: EvalPhase
  phaseProgressPct: number
  coreTargets: GmCoreTarget[]
  sections: KpiSection[]
  summary: GmSummary
}

export interface GmCoreTarget {
  id: string
  code: string
  name: string
  target: string
  overallValue: string
  overallMet: boolean
  unit: string
  progressPct: number
  breakdown: GmCoreTargetBreakdown[]
}

export interface GmCoreTargetBreakdown {
  sectionId: string
  sectionName: string
  value: string
  met: boolean
  warning?: boolean
}

export interface GmSummary {
  totalMembers: number
  byRank: { label: string; count: number }[]
  yearEndCompleted: number
  highPerformers: number
  meetsTarget: number
  underperforming: number
  pendingEvaluation: number
  missingEvidence: number
  pendingApproval: number
  overdue: number
}

/** Member KPI Dashboard data */
export interface MemberKpiDashboard {
  year: number
  phase: EvalPhase
  phaseLabel: string
  sheet: KpiSheet
  pendingItems: string[]
  canSubmit: boolean
}

/** GET /kpi/member/form-meta — tạo KPI cá nhân */
export interface KpiCategoryOption {
  id: string
  name: string
}

export interface CalcRuleOption {
  code: number
  name: string
  description?: string | null
}

export interface MemberKpiFormMeta {
  cycleId: string;
  cycleYear: number;
  kpiCategories: KpiCategoryOption[]
  calcRules: CalcRuleOption[]
}

/** Gợi ý UI Leader (mock/API): hạn tự đánh giá KPI cá nhân — âm nghĩa là quá hạn */
export interface LeaderDashboardUiHints {
  selfEvalDaysRemaining: number
}

/** Leader Dashboard data */
export interface LeaderKpiDashboard {
  year: number
  phase: EvalPhase
  teamMembers: LeaderTeamMember[]
  mySheet: KpiSheet
  /** Mock: điều khiển banner cảnh báo hạn tự đánh giá (năm chỉnh sửa được) */
  uiHints?: LeaderDashboardUiHints
}

export interface LeaderTeamMember {
  id: string
  name: string
  rank: string
  /** Mô tả vai trò / vị trí (vd Dev - Production) */
  role?: string
  /** Tỉ lệ hoàn thành KPI 0–100 */
  progress?: number
  sheetStatus: string
  score: number | null
  pendingCount: number
}

/** PM Dashboard data */
export interface PmKpiDashboard {
  year: number
  phase: EvalPhase
  teamMembers: PmTeamMember[]
  mySheet: KpiSheet
}

export interface PmTeamMember {
  id: string
  name: string
  rank: string
  sheetStatus: string
  selfScore: number | null
  pmScore: number | null
  awaitingPmReview: boolean
}

// Các type dùng chung cho Hệ thống mã (sys_status_codes)
export interface SysStatusCode {
  code: number;
  category: string;
  name: string;
  description: string;
}

export interface KpiMaster {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  typeCode: number;
  calculationRuleCode: number;
  unitCode: number;
  isGlobal: boolean;
}

export interface KpiCycle {
  id: string;
  year: number;
  name: string;
  statusCode: number;
}

export interface PmMemberOption {
  id: string;
  shortName: string;
  fullName: string;
  departmentName: string;
  rankCode: string;
}

// Payload trả về từ API Init
export interface KpiRegistrationInitResponse {
  activeCycle: KpiCycle;
  kpiLibrary: KpiMaster[];
  kpiTypes: SysStatusCode[];
  calcRules: SysStatusCode[];
  units: SysStatusCode[]; // Nếu backend trả thêm Unit
  teamMembers: PmMemberOption[]; // Danh sách member của PM
}

// Payload gửi lên API Create/Assign
export interface KpiRegistrationRequest {
  existingMasterKpiId?: string | null;
  newKpiName?: string;
  typeCode?: number;
  calculationRuleCode?: number;
  unitCode?: number;
  targetValue?: number;
  weight?: number;
  targetDescription?: string;
  isImportant?: boolean;
  assignedMembers: string[]; // Mảng UUID
  targets: Record<string, number>; // Map UUID -> Target value
}

export interface LeaderKpiInformationResponse {
  year: number;
  kpiCycle: KpiCycleResponse;
  categories: LeaderKpiCategoryGroup[];
  kpiSummary: LeaderKpiSummary;
}

export interface LeaderKpiCategoryGroup {
  id: string;
  name: string;
  assignments: LeaderKpiAssignment[];
}

export interface LeaderKpiAssignment {
  assignmentId: string;
  kpiName: string;
  kpiCode: string;
  targetDescription: string;
  weight: number;
  statusCode: number;
  statusName: string;
  statusDesc: string;
  midSelfScore: number | null;
  endSelfScore: number | null;
  endPmScore: number | null;
  evidences: string | null;
}

export interface LeaderKpiSummary {
  finalScore: number;
  evaluationComments: string;
  evaluationStatus: string;
}