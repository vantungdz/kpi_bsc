import { KPI_STATUS } from '@/config/constants'

export type SupervisorEvaluationViewer = 'pm' | 'gm'

function normalizeAsmCode(statusCode: number | null | undefined): number | null {
  const code = statusCode != null ? Number(statusCode) : NaN
  return Number.isFinite(code) ? code : null
}

/** ASM 504 / 604 — GM từ chối đánh giá (ẩn trên bảng GM; PM vẫn hiển thị để sửa và gửi lại). */
export function isEvaluationRejected(statusCode: number | null | undefined): boolean {
  const code = normalizeAsmCode(statusCode)
  return code === KPI_STATUS.FIRST_REJECTED || code === KPI_STATUS.SECOND_REJECTED
}

/**
 * Bảng KPI Department / KPI Personal & Promotion (leader & member):
 * - Giữa kỳ: ASM ≥ 502 (đến 504); cuối kỳ: ASM ≥ 602 (đến 604)
 * PM: gồm 504/604; GM: loại 504/604.
 */
export function canSupervisorViewMemberSelfEvaluation(
  statusCode: number | null | undefined,
  viewer: SupervisorEvaluationViewer,
): boolean {
  const code = normalizeAsmCode(statusCode)
  if (code == null) return false
  if (isEvaluationRejected(code) && viewer === 'gm') return false
  if (
    code >= KPI_STATUS.FIRST_WAITING_GM_APPROVAL &&
    code <= KPI_STATUS.FIRST_REJECTED
  ) {
    return true
  }
  // 601: chờ PM duyệt cuối kỳ — PM xem được (bảng dùng snapshot giữa kỳ).
  if (code === KPI_STATUS.SECOND_WAITING_PM_APPROVAL && viewer === 'pm') {
    return true
  }
  return (
    code >= KPI_STATUS.SECOND_WAITING_GM_APPROVAL &&
    code <= KPI_STATUS.SECOND_REJECTED
  )
}

/**
 * KPI do PM nhập (Personal / Promotion / Team row của PM):
 * - Giữa kỳ: ASM ≤ 405
 * - Cuối kỳ: thêm ASM 503 + các mốc leader/member (≥502 / ≥602)
 */
export function canPmOwnViewPortfolioEvaluation(
  statusCode: number | null | undefined,
): boolean {
  const code = normalizeAsmCode(statusCode)
  if (code == null) return false
  return (
    canSupervisorViewMemberSelfEvaluation(code, 'pm') ||
    code <= KPI_STATUS.ACCEPTED ||
    code === KPI_STATUS.FIRST_COMPLETED ||
    code === KPI_STATUS.SECOND_WAITING_PM_APPROVAL
  )
}

/** Chọn self score — bảng portfolio PM (leader/member). */
export function resolveMemberSelfScoreForPortfolio(
  statusCode: number | null | undefined,
  midSelfScore: unknown,
  endSelfScore: unknown,
): number | null {
  const code = normalizeAsmCode(statusCode)
  if (code == null) return null

  const parse = (v: unknown): number | null => {
    if (v == null || v === '') return null
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : null
  }

  const mid = parse(midSelfScore)
  const end = parse(endSelfScore)

  if (
    code >= KPI_STATUS.SECOND_WAITING_GM_APPROVAL &&
    code <= KPI_STATUS.SECOND_REJECTED
  ) {
    return end ?? mid
  }
  if (
    code >= KPI_STATUS.FIRST_WAITING_GM_APPROVAL &&
    code <= KPI_STATUS.FIRST_REJECTED
  ) {
    return mid ?? end
  }
  return null
}

/** Chọn self score — Strategic KPIs / Promotion monitoring (GM). */
export function resolveMemberSelfScoreForDiagnostics(
  statusCode: number | null | undefined,
  midSelfScore: unknown,
  endSelfScore: unknown,
): number | null {
  const code = normalizeAsmCode(statusCode)
  if (code == null || isEvaluationRejected(code)) return null

  const parse = (v: unknown): number | null => {
    if (v == null || v === '') return null
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : null
  }

  const mid = parse(midSelfScore)
  const end = parse(endSelfScore)

  if (code >= KPI_STATUS.COMPLETED && code < KPI_STATUS.SECOND_REJECTED) {
    return end ?? mid
  }
  if (code >= KPI_STATUS.FIRST_COMPLETED && code < KPI_STATUS.FIRST_REJECTED) {
    return mid ?? end
  }
  return null
}

/** @deprecated Dùng resolveMemberSelfScoreForPortfolio hoặc ForDiagnostics. */
export function resolveMemberSelfScoreByAsm(
  statusCode: number | null | undefined,
  midSelfScore: unknown,
  endSelfScore: unknown,
): number | null {
  return resolveMemberSelfScoreForPortfolio(statusCode, midSelfScore, endSelfScore)
}

/** Self score trên bảng portfolio (sau visibility). */
export function resolvePortfolioMemberSelfScore(
  statusCode: number | null | undefined,
  midSelfScore: unknown,
  endSelfScore: unknown,
  viewer: SupervisorEvaluationViewer,
): number | null {
  if (!canSupervisorViewMemberSelfEvaluation(statusCode, viewer)) return null
  return resolveMemberSelfScoreForPortfolio(statusCode, midSelfScore, endSelfScore)
}

export function supervisorMemberSelfScoreDisplay(
  selfScore: unknown,
  statusCode: number | null | undefined,
  viewer: SupervisorEvaluationViewer,
  midSelfScore?: unknown,
  endSelfScore?: unknown,
): string | number {
  const resolved =
    midSelfScore !== undefined || endSelfScore !== undefined
      ? resolvePortfolioMemberSelfScore(statusCode, midSelfScore, endSelfScore, viewer)
      : canSupervisorViewMemberSelfEvaluation(statusCode, viewer)
        ? selfScore
        : null
  if (resolved == null || resolved === '') return '-'
  return resolved as string | number
}

export function supervisorMemberActualDisplay(
  actual: unknown,
  statusCode: number | null | undefined,
  viewer: SupervisorEvaluationViewer,
  opts?: { pmOwned?: boolean },
): string {
  const visible = opts?.pmOwned
    ? canPmOwnViewPortfolioEvaluation(statusCode)
    : canSupervisorViewMemberSelfEvaluation(statusCode, viewer)
  if (!visible) return '-'
  const text = String(actual ?? '').trim()
  return text || '-'
}

/** PM xem KPI của chính mình trên bảng portfolio. */
export function resolvePmOwnPortfolioSelfScore(
  statusCode: number | null | undefined,
  midSelfScore?: unknown,
  endSelfScore?: unknown,
  fallbackSelfScore?: unknown,
): number | null {
  const code = normalizeAsmCode(statusCode)
  if (code == null || !canPmOwnViewPortfolioEvaluation(code)) return null

  const parse = (v: unknown): number | null => {
    if (v == null || v === '') return null
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : null
  }

  const fromPortfolio = resolveMemberSelfScoreForPortfolio(code, midSelfScore, endSelfScore)
  if (fromPortfolio != null) return fromPortfolio

  if (code === KPI_STATUS.FIRST_COMPLETED) {
    return (
      resolveMemberSelfScoreForDiagnostics(code, midSelfScore, endSelfScore)
      ?? parse(endSelfScore)
      ?? parse(midSelfScore)
    )
  }

  if (code <= KPI_STATUS.ACCEPTED) {
    return parse(midSelfScore) ?? parse(endSelfScore) ?? parse(fallbackSelfScore)
  }

  return parse(endSelfScore) ?? parse(midSelfScore) ?? parse(fallbackSelfScore)
}

/** Self score — bảng KPI Personal / Promotion (PM). */
export function pmTableSelfScoreDisplay(
  statusCode: number | null | undefined,
  opts?: {
    midSelfScore?: unknown
    endSelfScore?: unknown
    evidences?: string | null
  },
): string | number {
  const code = normalizeAsmCode(statusCode)
  if (code == null || !usesPmTableSnapshotStatus(code)) return '-'
  const tableScore = resolvePmTableSelfScore(
    code,
    opts?.midSelfScore,
    opts?.endSelfScore,
    opts?.evidences,
  )
  if (tableScore != null) return tableScore
  if (
    hasApprovedMidYearSnapshot(opts?.evidences) &&
    (code === KPI_STATUS.FIRST_COMPLETED || code === KPI_STATUS.SECOND_WAITING_PM_APPROVAL)
  ) {
    return '-'
  }
  return '-'
}

export function pmPortfolioMemberSelfScoreDisplay(
  selfScore: unknown,
  statusCode: number | null | undefined,
  opts?: {
    pmOwned?: boolean
    midSelfScore?: unknown
    endSelfScore?: unknown
    evidences?: string | null
    /** Bảng portfolio — dùng snapshot giữa kỳ khi ASM 503/601/602/603. */
    tableView?: boolean
  },
): string | number {
  if (opts?.tableView && usesPmTableSnapshotStatus(statusCode)) {
    return pmTableSelfScoreDisplay(statusCode, {
      midSelfScore: opts.midSelfScore,
      endSelfScore: opts.endSelfScore,
      evidences: opts.evidences,
    })
  }
  if (opts?.pmOwned) {
    const resolved = resolvePmOwnPortfolioSelfScore(
      statusCode,
      opts.midSelfScore,
      opts.endSelfScore,
      selfScore,
    )
    if (resolved == null) return '-'
    return resolved
  }
  return supervisorMemberSelfScoreDisplay(
    selfScore,
    statusCode,
    'pm',
    opts?.midSelfScore,
    opts?.endSelfScore,
  )
}

/** Drawer đánh giá PM/GM — luôn hiển thị điểm đã nhập. */
export function resolveDrawerMemberSelfScore(
  statusCode: number | null | undefined,
  midSelfScore: unknown,
  endSelfScore: unknown,
): number | null {
  const byPortfolio = resolveMemberSelfScoreForPortfolio(statusCode, midSelfScore, endSelfScore)
  if (byPortfolio != null) return byPortfolio
  const byDiagnostics = resolveMemberSelfScoreForDiagnostics(statusCode, midSelfScore, endSelfScore)
  if (byDiagnostics != null) return byDiagnostics
  const mid = midSelfScore != null && midSelfScore !== '' ? Number(midSelfScore) : null
  if (mid != null && Number.isFinite(mid)) return mid
  const end = endSelfScore != null && endSelfScore !== '' ? Number(endSelfScore) : null
  if (end != null && Number.isFinite(end)) return end
  return null
}

export function supervisorMemberSelfScoreDisplayInDrawer(
  selfScore: unknown,
  statusCode?: number | null,
  midSelfScore?: unknown,
  endSelfScore?: unknown,
): string | number {
  const resolved = resolveDrawerMemberSelfScore(
    statusCode,
    midSelfScore ?? selfScore,
    endSelfScore,
  )
  if (resolved == null) return '-'
  return resolved
}

/** Drawer đánh giá PM/GM — luôn hiển thị actual nếu có giá trị. */
export function supervisorMemberActualDisplayInDrawer(actual: unknown): string {
  const text = String(actual ?? '').trim()
  return text || '-'
}

/**
 * Strategic KPIs Tracking & Diagnostics / Promotion KPI Progress (GM):
 * - Giữa kỳ: ASM ≥ 503 (đến trước 504)
 * - Cuối kỳ: ASM ≥ 603 (đến trước 604)
 * 501/502/601/602 → ẩn; 504/604 → ẩn.
 */
export type ApprovedMidYearSnapshot = {
  selfScore?: number | string | null
  actual?: string | null
  capturedAt?: string | null
}

const SNAPSHOT_KEY = 'approvedMidYearSnapshot'

function parseScore(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Có key snapshot trong evidences (kể cả khi parse chi tiết thất bại). */
export function hasApprovedMidYearSnapshot(
  evidences: string | null | undefined,
): boolean {
  const trimmed = (evidences ?? '').trim()
  if (!trimmed) return false
  try {
    const o = JSON.parse(trimmed) as Record<string, unknown>
    const snap = o[SNAPSHOT_KEY]
    return snap != null && typeof snap === 'object' && !Array.isArray(snap)
  } catch {
    return false
  }
}

export function parseApprovedMidYearSnapshot(
  evidences: string | null | undefined,
): ApprovedMidYearSnapshot | null {
  const trimmed = (evidences ?? '').trim()
  if (!trimmed) return null
  try {
    const o = JSON.parse(trimmed) as Record<string, unknown>
    const snap = o[SNAPSHOT_KEY]
    if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return null
    const s = snap as Record<string, unknown>
    const selfScore = parseScore(s.selfScore)
    const actual =
      s.actual != null && String(s.actual).trim() !== '' ? String(s.actual).trim() : null
    const capturedAt =
      s.capturedAt != null && String(s.capturedAt).trim() !== ''
        ? String(s.capturedAt).trim()
        : null
    if (selfScore == null && actual == null && capturedAt == null) return null
    return { selfScore, actual, capturedAt }
  } catch {
    return null
  }
}

/** Actual gốc trong evidences (trường actual hoặc completed đầu tiên trong planActualRecords). */
export function extractActualFromEvidencesJson(
  evidences: string | null | undefined,
): string | null {
  const trimmed = (evidences ?? '').trim()
  if (!trimmed) return null
  try {
    const o = JSON.parse(trimmed) as Record<string, unknown>
    if (o.actual != null && String(o.actual).trim() !== '') {
      return String(o.actual).trim()
    }
    const pr = o.planActualRecords
    if (Array.isArray(pr)) {
      for (const x of pr) {
        const r = (x ?? {}) as Record<string, unknown>
        if (r.completed != null && String(r.completed).trim() !== '') {
          return String(r.completed).trim()
        }
        if (r.actual != null && String(r.actual).trim() !== '') {
          return String(r.actual).trim()
        }
      }
    }
    return null
  } catch {
    return null
  }
}

function snapshotSelfScoreOrFallback(
  evidences: string | null | undefined,
  midSelfScore: unknown,
): number | null {
  if (hasApprovedMidYearSnapshot(evidences)) {
    const snap = parseApprovedMidYearSnapshot(evidences)
    if (snap?.selfScore != null) return parseScore(snap.selfScore)
    return null
  }
  return parseScore(midSelfScore)
}

function snapshotActualOrFallback(evidences: string | null | undefined): string | null {
  if (hasApprovedMidYearSnapshot(evidences)) {
    const snap = parseApprovedMidYearSnapshot(evidences)
    if (snap?.actual != null) return snap.actual
    return null
  }
  return extractActualFromEvidencesJson(evidences)
}

/** Evidences JSON cho bảng PM (field API `actualResult` = full evidences). */
export function pmPortfolioEvidencesJson(row: {
  evidencesJson?: string | null
  actualResult?: string | null
} | null | undefined): string | null {
  const fromJson = row?.evidencesJson != null ? String(row.evidencesJson).trim() : ''
  if (fromJson) return fromJson
  const fromActual = row?.actualResult != null ? String(row.actualResult).trim() : ''
  return fromActual || null
}

const PM_TABLE_SNAPSHOT_STATUSES = new Set<number>([
  KPI_STATUS.FIRST_COMPLETED,
  KPI_STATUS.SECOND_WAITING_PM_APPROVAL,
  KPI_STATUS.SECOND_WAITING_GM_APPROVAL,
  KPI_STATUS.COMPLETED,
])

export function usesPmTableSnapshotStatus(statusCode: number | null | undefined): boolean {
  const code = normalizeAsmCode(statusCode)
  return code != null && PM_TABLE_SNAPSHOT_STATUSES.has(code)
}

/** Bảng PM — self score: 503/601 snapshot; 602/603 cuối kỳ. */
export function resolvePmTableSelfScore(
  statusCode: number | null | undefined,
  midSelfScore: unknown,
  endSelfScore: unknown,
  evidences?: string | null,
): number | null {
  const code = normalizeAsmCode(statusCode)
  if (code == null) return null
  if (code === KPI_STATUS.FIRST_COMPLETED || code === KPI_STATUS.SECOND_WAITING_PM_APPROVAL) {
    return snapshotSelfScoreOrFallback(evidences, midSelfScore)
  }
  if (code === KPI_STATUS.SECOND_WAITING_GM_APPROVAL || code === KPI_STATUS.COMPLETED) {
    return parseScore(endSelfScore) ?? parseScore(midSelfScore)
  }
  return resolveMemberSelfScoreForPortfolio(code, midSelfScore, endSelfScore)
}

/** Bảng GM — self score: 503/601/602 snapshot; 603 cuối kỳ. */
export function resolveGmTableSelfScore(
  statusCode: number | null | undefined,
  midSelfScore: unknown,
  endSelfScore: unknown,
  evidences?: string | null,
): number | null {
  const code = normalizeAsmCode(statusCode)
  if (code == null) return null
  if (
    code === KPI_STATUS.FIRST_COMPLETED ||
    code === KPI_STATUS.SECOND_WAITING_PM_APPROVAL ||
    code === KPI_STATUS.SECOND_WAITING_GM_APPROVAL
  ) {
    return snapshotSelfScoreOrFallback(evidences, midSelfScore)
  }
  if (code === KPI_STATUS.COMPLETED) {
    return parseScore(endSelfScore) ?? parseScore(midSelfScore)
  }
  return resolveMemberSelfScoreForDiagnostics(code, midSelfScore, endSelfScore)
}

/** Bảng PM — actual: 503/601 snapshot; 602/603 evidences hiện tại. */
export function resolvePmTableActual(
  statusCode: number | null | undefined,
  evidences?: string | null,
): string | null {
  const code = normalizeAsmCode(statusCode)
  if (code == null) return null
  if (code === KPI_STATUS.FIRST_COMPLETED || code === KPI_STATUS.SECOND_WAITING_PM_APPROVAL) {
    return snapshotActualOrFallback(evidences)
  }
  if (code === KPI_STATUS.SECOND_WAITING_GM_APPROVAL || code === KPI_STATUS.COMPLETED) {
    return extractActualFromEvidencesJson(evidences)
  }
  return null
}

/** Bảng GM — actual: 503/601/602 snapshot; 603 evidences hiện tại. */
export function resolveGmTableActual(
  statusCode: number | null | undefined,
  evidences?: string | null,
): string | null {
  const code = normalizeAsmCode(statusCode)
  if (code == null) return null
  if (
    code === KPI_STATUS.FIRST_COMPLETED ||
    code === KPI_STATUS.SECOND_WAITING_PM_APPROVAL ||
    code === KPI_STATUS.SECOND_WAITING_GM_APPROVAL
  ) {
    return snapshotActualOrFallback(evidences)
  }
  if (code === KPI_STATUS.COMPLETED) {
    return extractActualFromEvidencesJson(evidences)
  }
  return null
}

export function canDiagnosticsShowMemberActual(
  statusCode: number | null | undefined,
): boolean {
  const code = normalizeAsmCode(statusCode)
  if (code == null || isEvaluationRejected(code)) return false
  return (
    code === KPI_STATUS.FIRST_COMPLETED ||
    code === KPI_STATUS.SECOND_WAITING_PM_APPROVAL ||
    code === KPI_STATUS.SECOND_WAITING_GM_APPROVAL ||
    code === KPI_STATUS.COMPLETED
  )
}

/** GM Strategic Diagnostics — self score (503/601/602 snapshot; 603 cuối kỳ). */
export function resolveGmDiagnosticsSelfScore(
  statusCode: number | null | undefined,
  midSelfScore: unknown,
  endSelfScore: unknown,
  evidences?: string | null,
): number | null {
  return resolveGmTableSelfScore(statusCode, midSelfScore, endSelfScore, evidences)
}

/** GM Strategic Diagnostics — actual (503/601/602 snapshot; 603 cuối kỳ). */
export function resolveGmDiagnosticsActual(
  statusCode: number | null | undefined,
  evidences?: string | null,
): string | null {
  return resolveGmTableActual(statusCode, evidences)
}

/** ASM cho phép member nhận thêm KPI mới trong cùng chu kỳ (404, 406, 407). */
export const MEMBER_ASSIGN_ALLOWED_STATUSES = new Set<number>([
  KPI_STATUS.PENDING_ACCEPTANCE,
  KPI_STATUS.REJECTED,
  KPI_STATUS.FEEDBACK_IN_PROGRESS,
])

export const MEMBER_ASSIGN_BLOCK_MESSAGE =
  'Cannot assign KPI to this member because they already have an active KPI.'

export const PROMOTION_ASSIGN_BLOCK_MESSAGE =
  'Cannot assign promotion KPI because this member already has an active promotion KPI.'

export const PM_ASSIGN_BLOCK_MESSAGE =
  'Cannot assign KPI to this PM because they already have an active KPI. Unlock the PM’s KPI first.'

export function isMemberAssignmentBlocked(
  memberId: string,
  blockedMemberIds: ReadonlySet<string>,
): boolean {
  const id = String(memberId ?? '').trim().toLowerCase()
  if (!id) return false
  return blockedMemberIds.has(id)
}
