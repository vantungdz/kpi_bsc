/** CALC_RULE — đồng bộ sys_status_codes */
export const CALC_RULE_SUM = 801
export const CALC_RULE_AVG = 802
export const CALC_RULE_COMMENT = 803
export const CALC_RULE_WEIGHTED_AVG = 804

export type EvidenceDetailMode = 'weighted' | 'comment' | 'workAmount'

export type PlanActualPair = { plan: string; actual: string; comment?: string }
export type UrlNamePair = { url: string; name: string }
export type WorkAmountRow = { month: number; spentHours: number; standardHours: number }

export type WeightedFormState = {
  text: string
  result: string
  note: string
  planActualRecords: PlanActualPair[]
  evd: UrlNamePair[]
}

export type CommentFormState = {
  note: string
  files: UrlNamePair[]
  /** KPI 803: Plan/Actual — cùng cấu trúc 804, lưu chung note + files */
  planActualRecords: PlanActualPair[]
}

export type WorkAmountFormState = {
  note: string
  workAmounts: WorkAmountRow[]
  files: UrlNamePair[]
}

export function resolveEvidenceDetailMode(
  calculationRuleCode: number | null | undefined,
  evidencesJson: string | null | undefined,
): EvidenceDetailMode {
  if (calculationRuleCode === CALC_RULE_WEIGHTED_AVG) return 'weighted'
  if (calculationRuleCode === CALC_RULE_COMMENT) return 'comment'
  try {
    const raw = evidencesJson?.trim()
    if (raw && raw !== '{}' && raw !== 'null') {
      const o = JSON.parse(raw) as Record<string, unknown>
      if (Array.isArray(o.workAmounts)) return 'workAmount'
    }
  } catch {
    /* ignore */
  }
  return 'workAmount'
}

function safeParse(raw: string | null | undefined): Record<string, unknown> {
  if (!raw?.trim()) return {}
  try {
    const o = JSON.parse(raw)
    return typeof o === 'object' && o !== null && !Array.isArray(o) ? (o as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function parseWeightedPayload(json: string | null | undefined): WeightedFormState {
  const o = safeParse(json)
  const pairs = Array.isArray(o.planActualRecords)
    ? (o.planActualRecords as unknown[])
        .map((x) => {
          if (!x || typeof x !== 'object') return { plan: '', actual: '', comment: '' }
          const r = x as Record<string, unknown>
          return {
            plan: String(r.plan ?? ''),
            actual: String(r.actual ?? ''),
            comment: String(r.comment ?? ''),
          }
        })
        .filter(Boolean)
    : []
  const evd = Array.isArray(o.evd)
    ? (o.evd as unknown[])
        .map((x) => {
          if (!x || typeof x !== 'object') return { url: '', name: '' }
          const r = x as Record<string, unknown>
          return { url: String(r.url ?? ''), name: String(r.name ?? '') }
        })
        .filter(Boolean)
    : []
  return {
    text: String(o.text ?? ''),
    result: String(o.result ?? ''),
    note: String(o.note ?? o.text ?? ''),
    planActualRecords: pairs.length ? pairs : [{ plan: '', actual: '', comment: '' }],
    evd: evd.length ? evd : [{ url: '', name: '' }],
  }
}

export function buildWeightedPayload(s: WeightedFormState): Record<string, unknown> {
  const planActualRecords = s.planActualRecords
    .map(({ plan, actual, comment }) => ({
      plan: plan.trim(),
      actual: actual.trim(),
      ...(comment?.trim() ? { comment: comment.trim() } : {}),
    }))
    .filter((r) => r.plan || r.actual)
  const evd = s.evd
    .map(({ url, name }) => ({ url: url.trim(), name: name.trim() }))
    .filter((r) => r.url || r.name)
  const out: Record<string, unknown> = {}
  if (s.text.trim()) out.text = s.text.trim()
  if (s.result.trim()) out.result = s.result.trim()
  if (s.note.trim()) out.note = s.note.trim()
  if (planActualRecords.length) out.planActualRecords = planActualRecords
  if (evd.length) out.evd = evd
  return out
}

export function parseCommentPayload(json: string | null | undefined): CommentFormState {
  const o = safeParse(json)
  const files = Array.isArray(o.files)
    ? (o.files as unknown[])
        .map((x) => {
          if (!x || typeof x !== 'object') return { url: '', name: '' }
          const r = x as Record<string, unknown>
          return { url: String(r.url ?? ''), name: String(r.name ?? '') }
        })
        .filter(Boolean)
    : []
  const planPairs = Array.isArray(o.planActualRecords)
    ? (o.planActualRecords as unknown[])
        .map((x) => {
          if (!x || typeof x !== 'object') return { plan: '', actual: '', comment: '' }
          const r = x as Record<string, unknown>
          return { plan: String(r.plan ?? ''), actual: String(r.actual ?? ''), comment: String(r.comment ?? '') }
        })
        .filter(Boolean)
    : []
  return {
    // Đồng bộ legacy / BE: từng dùng `text` thay `note` (A.x COMMENT); cột tóm tắt vẫn gộp ở formatEvidenceJsonSummary
    note: String(o.note ?? o.text ?? ''),
    files: files.length ? files : [{ url: '', name: '' }],
    planActualRecords: planPairs,
  }
}

function joinActualsFromPlanRecords(rows: PlanActualPair[]): string {
  const parts = rows.map((r) => r.actual.trim()).filter(Boolean)
  if (!parts.length) return ''
  return parts.join(' | ')
}

export function buildCommentPayload(s: CommentFormState): Record<string, unknown> {
  const planActualRecords = s.planActualRecords
    .map(({ plan, actual, comment }) => ({
      plan: plan.trim(),
      actual: actual.trim(),
      ...(comment?.trim() ? { comment: comment.trim() } : {}),
    }))
    .filter((r) => r.plan || r.actual)
  const files = s.files
    .map(({ url, name }) => ({ url: url.trim(), name: name.trim() }))
    .filter((r) => r.url || r.name)
  const out: Record<string, unknown> = {}
  if (s.note.trim()) out.note = s.note.trim()
  if (files.length) out.files = files
  if (planActualRecords.length) {
    out.planActualRecords = planActualRecords
    const result = joinActualsFromPlanRecords(planActualRecords)
    if (result) out.result = result
  }
  return out
}

const MONTH_DEFAULT = (): WorkAmountRow[] =>
  Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    spentHours: 0,
    standardHours: 0,
  }))

export function parseWorkAmountPayload(json: string | null | undefined): WorkAmountFormState {
  const o = safeParse(json)
  let workAmounts = MONTH_DEFAULT()
  const rawWorkAmounts = Array.isArray(o.workAmounts) ? o.workAmounts : undefined
  const rawLegacyWorkAmounts = Array.isArray(o.waTimeRecords) ? o.waTimeRecords : undefined

  const parseRows = (source: unknown[]): WorkAmountRow[] => {
    const byMonth = new Map<number, WorkAmountRow>()
    for (const x of source as unknown[]) {
      if (!x || typeof x !== 'object') continue
      const r = x as Record<string, unknown>
      const m = Number(r.month)
      if (!Number.isFinite(m) || m < 1 || m > 12) continue
      byMonth.set(m, {
        month: m,
        spentHours: Number(r.spentHours ?? r.spent ?? 0) || 0,
        standardHours: Number(r.standardHours ?? r.standard ?? 0) || 0,
      })
    }
    if (byMonth.size > 0) {
      return MONTH_DEFAULT().map((row) => byMonth.get(row.month) ?? row)
    }
    return []
  }

  let parsedWorkAmounts: WorkAmountRow[] = []
  if (rawWorkAmounts) {
    parsedWorkAmounts = parseRows(rawWorkAmounts)
    const hasValues = parsedWorkAmounts.some(w => w.spentHours !== 0 || w.standardHours !== 0)
    if (!hasValues && rawLegacyWorkAmounts) {
      parsedWorkAmounts = parseRows(rawLegacyWorkAmounts)
    }
  } else if (rawLegacyWorkAmounts) {
    parsedWorkAmounts = parseRows(rawLegacyWorkAmounts)
  }

  if (parsedWorkAmounts.length > 0) {
    workAmounts = parsedWorkAmounts
  }

  const files = Array.isArray(o.files)
    ? (o.files as unknown[])
        .map((x) => {
          if (!x || typeof x !== 'object') return { url: '', name: '' }
          const r = x as Record<string, unknown>
          return { url: String(r.url ?? ''), name: String(r.name ?? '') }
        })
        .filter(Boolean)
    : []
  return {
    note: String(o.note ?? ''),
    workAmounts,
    files: files.length ? files : [{ url: '', name: '' }],
  }
}

export function buildWorkAmountPayload(s: WorkAmountFormState): Record<string, unknown> {
  const workAmounts = s.workAmounts.map((w) => ({
    month: w.month,
    spentHours: Number(w.spentHours) || 0,
    standardHours: Number(w.standardHours) || 0,
  }))
  const files = s.files
    .map(({ url, name }) => ({ url: url.trim(), name: name.trim() }))
    .filter((r) => r.url || r.name)
  const out: Record<string, unknown> = {}
  if (s.note.trim()) out.note = s.note.trim()
  out.workAmounts = workAmounts
  if (files.length) out.files = files
  return out
}
