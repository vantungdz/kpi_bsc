import { KPI_STATUS } from '@/config/constants'

export type SupervisorEvaluationViewer = 'pm' | 'gm'

/**
 * PM/GM có được xem Actual & Self score của member hay không.
 * - 405: cả PM & GM đều không
 * - 501: PM có, GM không
 * - 502: cả hai có
 * - Các status khác: xem bình thường
 */
export function canSupervisorViewMemberSelfEvaluation(
  statusCode: number | null | undefined,
  viewer: SupervisorEvaluationViewer,
): boolean {
  const code = statusCode != null ? Number(statusCode) : NaN
  if (!Number.isFinite(code)) return true
  if (code === KPI_STATUS.ACCEPTED) return false
  if (code === KPI_STATUS.FIRST_WAITING_PM_APPROVAL) return viewer === 'pm'
  if (code === KPI_STATUS.FIRST_WAITING_GM_APPROVAL) return true
  return true
}

export function supervisorMemberSelfScoreDisplay(
  selfScore: unknown,
  statusCode: number | null | undefined,
  viewer: SupervisorEvaluationViewer,
): string | number {
  if (!canSupervisorViewMemberSelfEvaluation(statusCode, viewer)) return '-'
  if (selfScore == null || selfScore === '') return '-'
  return selfScore as string | number
}

export function supervisorMemberActualDisplay(
  actual: unknown,
  statusCode: number | null | undefined,
  viewer: SupervisorEvaluationViewer,
): string {
  if (!canSupervisorViewMemberSelfEvaluation(statusCode, viewer)) return '-'
  const text = String(actual ?? '').trim()
  return text || '-'
}

/**
 * Strategic KPIs Tracking & Diagnostics: Actual member chỉ sau khi GM chốt giữa kỳ (ASM ≥ 503).
 */
export function canDiagnosticsShowMemberActual(
  statusCode: number | null | undefined,
): boolean {
  const code = statusCode != null ? Number(statusCode) : NaN
  if (!Number.isFinite(code)) return false
  return code >= KPI_STATUS.FIRST_COMPLETED
}
