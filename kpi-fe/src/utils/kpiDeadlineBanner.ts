import dayjs from 'dayjs'
import type { EvalPhase } from '@/types/kpi'
import type { KpiCycleResponse } from '@/types/shared/kpi-cycle.type'

export type KpiDeadlineBannerVm = {
  kind: 'warning' | 'overdue'
  title: string
  subtitle?: string
  daysLeft?: number
  bgClass: string
  borderClass: string
  iconWrapClass: string
  titleClass: string
  subtitleClass: string
  ctaClass: string
  icon: string
}

function phaseDeadline(cycle: KpiCycleResponse, phase: EvalPhase): string | null {
  if (phase === 'target_setup') return cycle.goalSettingEnd
  if (phase === 'mid_year') return cycle.midYearEnd
  return cycle.endYearEnd
}

function phaseStart(cycle: KpiCycleResponse, phase: EvalPhase): string | null {
  if (phase === 'target_setup') return cycle.goalSettingStart
  if (phase === 'mid_year') return cycle.midYearStart
  return cycle.endYearStart
}

export function buildKpiDeadlineBanner(params: {
  cycle: KpiCycleResponse | null
  phase: EvalPhase | null | undefined
  subjectLabel?: string
  warningDays?: number
  hasPendingAction?: boolean
}): KpiDeadlineBannerVm | null {
  const { cycle, phase, warningDays = 3, hasPendingAction = true } = params
  const subject = (params.subjectLabel ?? 'KPI').trim() || 'KPI'
  if (!cycle || !phase || !hasPendingAction) return null

  const startRaw = phaseStart(cycle, phase)
  const deadlineRaw = phaseDeadline(cycle, phase)
  if (!startRaw || !deadlineRaw) return null
  const start = dayjs(startRaw)
  const deadline = dayjs(deadlineRaw)
  if (!start.isValid() || !deadline.isValid()) return null

  const now = dayjs()
  // Chỉ cảnh báo trong/qua phase hiện tại. Chưa tới phase thì không hiển thị.
  if (now.isBefore(start.startOf('day'))) return null

  const daysLeft = deadline.endOf('day').diff(now.startOf('day'), 'day')

  if (daysLeft < 0) {
    return {
      kind: 'overdue',
      title: `${subject} self-evaluation overdue`,
      subtitle: 'Please complete your self-evaluation and submit the KPI sheet as soon as possible for PM/HR to process.',
      bgClass: 'bg-rose-50',
      borderClass: 'border-rose-200',
      iconWrapClass: 'bg-rose-100 text-rose-600',
      titleClass: 'text-rose-900',
      subtitleClass: 'text-rose-800/95',
      ctaClass: 'rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-700',
      icon: 'fas fa-exclamation-circle',
    }
  }

  if (daysLeft <= warningDays) {
    return {
      kind: 'warning',
      title: `${subject} evaluation period is in progress`,
      daysLeft,
      bgClass: 'bg-amber-50',
      borderClass: 'border-amber-200',
      iconWrapClass: 'bg-amber-100 text-amber-600',
      titleClass: 'text-amber-900',
      subtitleClass: 'text-amber-800/95',
      ctaClass: 'rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-700',
      icon: 'fas fa-clock',
    }
  }

  return null
}
