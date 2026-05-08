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

/** Đếm mọi node trong cây team (đệ quy) đang chờ PM đánh giá (501 / 601). */
export function countPmEvaluationSubjectsInHierarchy(nodes: unknown[] | null | undefined): number {
  if (!Array.isArray(nodes) || nodes.length === 0) return 0
  let count = 0
  for (const raw of nodes) {
    const node = raw as { children?: unknown[] }
    if (node && isPmEvaluationSubject(node)) count++
    const children = node?.children
    if (Array.isArray(children) && children.length > 0) {
      count += countPmEvaluationSubjectsInHierarchy(children)
    }
  }
  return count
}
