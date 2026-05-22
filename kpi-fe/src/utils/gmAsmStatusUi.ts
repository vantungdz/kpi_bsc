import { KPI_STATUS } from '@/config/constants'

export function normalizeGmAsmStatusCode(code: unknown): number | null {
  const n = typeof code === 'number' ? code : Number(code)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

/** Rollup ASM — ưu tiên 407 (Processing Feedback), giống Strategic Diagnostics. */
export function minGmAsmStatusCode(
  codes: Array<number | null | undefined>,
): number | null {
  const valid = codes
    .map(normalizeGmAsmStatusCode)
    .filter((n): n is number => n != null)
  if (valid.includes(KPI_STATUS.FEEDBACK_IN_PROGRESS)) {
    return KPI_STATUS.FEEDBACK_IN_PROGRESS
  }
  return valid.length > 0 ? Math.min(...valid) : null
}

/** Chip màu — đồng bộ bảng Strategic KPIs Tracking & Diagnostics. */
export function gmAsmStatusPillClass(code: number | null | undefined): string {
  switch (normalizeGmAsmStatusCode(code)) {
    case KPI_STATUS.INACTIVE:
      return 'border-slate-200 bg-slate-50 text-slate-700'
    case KPI_STATUS.REJECTED:
      return 'border-rose-200 bg-rose-50 text-rose-700'
    case KPI_STATUS.FEEDBACK_IN_PROGRESS:
      return 'border-violet-200 bg-violet-50 text-violet-700'
    case KPI_STATUS.ACCEPTED:
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case KPI_STATUS.FIRST_COMPLETED:
    case KPI_STATUS.COMPLETED:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case KPI_STATUS.WAITING_PM_APPROVAL:
    case KPI_STATUS.WAITING_GM_APPROVAL:
    case KPI_STATUS.PENDING_ACCEPTANCE:
    case KPI_STATUS.FIRST_WAITING_PM_APPROVAL:
    case KPI_STATUS.FIRST_WAITING_GM_APPROVAL:
    case KPI_STATUS.SECOND_WAITING_PM_APPROVAL:
    case KPI_STATUS.SECOND_WAITING_GM_APPROVAL:
      return 'border-amber-200 bg-amber-50 text-amber-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-500'
  }
}
