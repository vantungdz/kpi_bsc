import {
  CALC_RULE_COMMENT,
  normalizeCalculationRuleCode,
  parseNumericFromField,
} from '@/utils/memberKpiHelpers'

export function isDiagnosticsMidYearPhase(
  cycle:
    | { midYearStart?: string | null; midYearEnd?: string | null }
    | null
    | undefined,
): boolean {
  if (!cycle) return false
  const now = Date.now()
  const start = cycle.midYearStart ? new Date(cycle.midYearStart).getTime() : null
  const end = cycle.midYearEnd ? new Date(cycle.midYearEnd).getTime() : null
  if (start == null || end == null) return false
  return now >= start && now <= end
}

function parseNumPct(s: string): number {
  const raw = String(s ?? '').trim()
  if (!raw) return 0
  const fromHelper = parseNumericFromField(raw)
  if (fromHelper != null && Number.isFinite(fromHelper)) return fromHelper
  const fallback = Number.parseFloat(
    raw.replace(/[^0-9.,-]/g, '').replace(',', '.'),
  )
  return Number.isFinite(fallback) ? fallback : 0
}

/** Fallback so sánh chuỗi actual/target khi thiếu số. */
export function diagnosticsActualTextColorClass(
  actual: string,
  target: string,
): string {
  const actualNum = parseNumericFromField(String(actual ?? ''))
  const targetNum = parseNumericFromField(String(target ?? ''))
  if (
    actualNum == null ||
    !Number.isFinite(actualNum) ||
    targetNum == null ||
    !Number.isFinite(targetNum) ||
    targetNum <= 0
  ) {
    return 'text-slate-400'
  }
  return actualNum < targetNum ? 'text-red-600' : 'text-green-600'
}

/**
 * Xanh/đỏ cột Actual khi đã có actual & target số.
 * Mid-year + CALC_RULE 803: ngưỡng = target/2.
 */
export function diagnosticsActualNumericColorClass(
  actualNum: number | null,
  targetFull: number | null,
  calculationRuleCode: unknown,
  isMidYear: boolean,
): string | null {
  if (actualNum == null || !Number.isFinite(actualNum)) return null
  if (targetFull == null || !Number.isFinite(targetFull) || targetFull <= 0) {
    return null
  }
  const isMidYear803 =
    isMidYear &&
    normalizeCalculationRuleCode(calculationRuleCode) === CALC_RULE_COMMENT &&
    targetFull > 0
  const threshold = isMidYear803 ? targetFull / 2 : targetFull
  return actualNum < threshold ? 'text-red-600' : 'text-green-600'
}

/** Màu Actual member / dòng department — đồng bộ Strategic Diagnostics. */
export function diagnosticsMemberActualColorClass(opts: {
  actualRaw: string
  targetRaw: string
  calculationRuleCode: unknown
  isMidYear: boolean
  actualNum?: number | null
  targetNum?: number | null
}): string {
  const targetFull =
    opts.targetNum ?? parseNumericFromField(String(opts.targetRaw ?? ''))
  const actualNum =
    opts.actualNum ?? parseNumericFromField(String(opts.actualRaw ?? ''))

  const isMidYear803 =
    opts.isMidYear &&
    normalizeCalculationRuleCode(opts.calculationRuleCode) ===
      CALC_RULE_COMMENT &&
    targetFull != null &&
    targetFull > 0

  if (isMidYear803) {
    return actualNum != null && actualNum >= targetFull / 2
      ? 'text-green-600'
      : 'text-red-600'
  }

  const fromNum = diagnosticsActualNumericColorClass(
    actualNum,
    targetFull,
    opts.calculationRuleCode,
    opts.isMidYear,
  )
  if (fromNum != null) return fromNum

  return parseNumPct(opts.actualRaw) < parseNumPct(opts.targetRaw)
    ? 'text-red-600'
    : 'text-green-600'
}
