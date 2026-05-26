import { extractRawInputFromApiTargetDescription } from '@/utils/kpiScoringRulesDsl'
import { formatKpiTargetWithUnit } from '@/utils/kpiUnitCodes'

export type AssigneeEditDiffFields = {
  targetValue?: number | string | null
  baselineTargetValue?: number | string | null
  targetDescription?: string | null
  baselineScoringDescription?: string | null
  unitCode?: number | null
  targetChanged?: boolean | null
  scoringChanged?: boolean | null
  assigneeHasEdits?: boolean | null
}

export function scoringRulesTextFromStored(stored: string | null | undefined): string {
  const fromApi = extractRawInputFromApiTargetDescription(stored ?? '')
  if (fromApi.trim()) return fromApi.trim()
  const raw = String(stored ?? '').trim()
  return raw || ''
}

function formatTargetNum(v: unknown): string {
  if (v == null || String(v).trim() === '') return '—'
  const n = Number.parseFloat(String(v))
  if (!Number.isFinite(n)) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

export function formatAssigneeTargetDisplay(
  value: unknown,
  unitCode?: number | null,
): string {
  return formatKpiTargetWithUnit(formatTargetNum(value), unitCode ?? undefined)
}

export function assigneeHasEditsFromFields(f: AssigneeEditDiffFields): boolean {
  if (f.assigneeHasEdits === true) return true
  return f.targetChanged === true || f.scoringChanged === true
}
