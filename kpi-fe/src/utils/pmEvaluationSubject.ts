import { KPI_STATUS } from '@/config/constants'

/**
 * User có ít nhất một assignment đang trong cửa sổ đánh giá PM (501 mid / 601 final).
 * Backend trả {@link requiresPmEvaluation}; fallback khi BE chưa có field (triển khai lệch phiên bản).
 */
export function isPmEvaluationSubject(m: {
  requiresPmEvaluation?: boolean
  statusCode?: number | null
}): boolean {
  if (typeof m.requiresPmEvaluation === 'boolean') return m.requiresPmEvaluation
  const sc = m.statusCode != null ? Number(m.statusCode) : NaN
  return (
    sc === KPI_STATUS.FIRST_WAITING_PM_APPROVAL || sc === KPI_STATUS.SECOND_WAITING_PM_APPROVAL
  )
}
