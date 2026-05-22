import { KPI_STATUS } from '@/config/constants'
import { gmAsmStatusPillClass } from '@/utils/gmAsmStatusUi'

/** Chip + dot — đồng bộ tab KPI Personal / Promotion, Team Review, drawer đánh giá PM với Strategic Diagnostics. */
export type PmAsmStatusChipUi = {
  chip: string
  dot: string
}

const DEFAULT_CHIP = 'border-slate-200 bg-slate-50 text-slate-500'
const DEFAULT_DOT = 'bg-slate-300 ring-2 ring-slate-100'

/** Dot — cùng nhóm màu với {@link gmAsmStatusPillClass}. */
function gmAlignedDotClass(code: number): string {
  switch (code) {
    case KPI_STATUS.INACTIVE:
      return 'bg-slate-400 ring-2 ring-slate-100'
    case KPI_STATUS.REJECTED:
      return 'bg-rose-500 ring-2 ring-rose-100'
    case KPI_STATUS.FEEDBACK_IN_PROGRESS:
      return 'bg-violet-500 ring-2 ring-violet-100'
    case KPI_STATUS.ACCEPTED:
      return 'bg-blue-400 ring-2 ring-blue-100'
    case KPI_STATUS.FIRST_COMPLETED:
    case KPI_STATUS.COMPLETED:
      return 'bg-emerald-500 ring-2 ring-emerald-100'
    case KPI_STATUS.WAITING_PM_APPROVAL:
    case KPI_STATUS.WAITING_GM_APPROVAL:
    case KPI_STATUS.PENDING_ACCEPTANCE:
    case KPI_STATUS.FIRST_WAITING_PM_APPROVAL:
    case KPI_STATUS.FIRST_WAITING_GM_APPROVAL:
    case KPI_STATUS.SECOND_WAITING_PM_APPROVAL:
    case KPI_STATUS.SECOND_WAITING_GM_APPROVAL:
      return 'bg-amber-400 ring-2 ring-amber-100'
    default:
      return DEFAULT_DOT
  }
}

const PM_ASM_STATUS_CODES = [
  KPI_STATUS.INACTIVE,
  KPI_STATUS.WAITING_PM_APPROVAL,
  KPI_STATUS.WAITING_GM_APPROVAL,
  KPI_STATUS.PENDING_ACCEPTANCE,
  KPI_STATUS.ACCEPTED,
  KPI_STATUS.REJECTED,
  KPI_STATUS.FEEDBACK_IN_PROGRESS,
  KPI_STATUS.FIRST_WAITING_PM_APPROVAL,
  KPI_STATUS.FIRST_WAITING_GM_APPROVAL,
  KPI_STATUS.FIRST_COMPLETED,
  KPI_STATUS.SECOND_WAITING_PM_APPROVAL,
  KPI_STATUS.SECOND_WAITING_GM_APPROVAL,
  KPI_STATUS.COMPLETED,
] as const

export const PM_ASM_STATUS_CHIP_UI: Record<number, PmAsmStatusChipUi> =
  Object.fromEntries(
    PM_ASM_STATUS_CODES.map((code) => [
      code,
      {
        chip: gmAsmStatusPillClass(code),
        dot: gmAlignedDotClass(code),
      },
    ]),
  )

export function pmAsmStatusPillClass(statusCode: number): string {
  return gmAsmStatusPillClass(statusCode) || DEFAULT_CHIP
}

export function pmAsmStatusDotClass(statusCode: number): string {
  const n = Number(statusCode)
  if (!Number.isFinite(n)) return DEFAULT_DOT
  return gmAlignedDotClass(Math.round(n))
}

export function pmAsmStatusChipUi(
  statusCode: number | null | undefined,
): PmAsmStatusChipUi | null {
  if (statusCode == null || statusCode === 0) return null
  const n = Number(statusCode)
  if (!Number.isFinite(n)) return null
  return {
    chip: pmAsmStatusPillClass(n),
    dot: pmAsmStatusDotClass(n),
  }
}
