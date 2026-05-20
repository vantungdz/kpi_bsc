/**
 * GM KPI scoring rules DSL — đồng bộ logic với {@code KpiScoringRulesService} (BE).
 * Mỗi dòng «điểm: điều_kiện»; khoảng `(a,b]` / `[a,b)`; toán tử một ngưỡng.
 * Dấu phẩy cuối dòng (sau điều kiện) là tùy chọn — nếu có sẽ bỏ qua khi parse.
 */

/** Nội dung tooltip «Ví dụ» (GM/PM form) — hiển thị khi hover icon trợ giúp. */
export const SCORING_RULES_EXAMPLE_TOOLTIP = [
  'Example (each line one score level 1–5):',
  '5: >125',
  '4: >110',
  '3: >90',
  '2: >80',
  '1: <=80',
  'Or half-open interval (no gaps between levels):',
  '5: >4.5',
  '4: (3.6, 4.5]',
  '3: (3.0, 3.6]',
  '2: (2.4, 3.0]',
  '1: <=2.4',
].join('\n')

export type ScoringRuleNormalized =
  | { score: number; operator: '<' | '<=' | '>' | '>=' | '='; value: number }
  | { score: number; min: number; max: number; loOpen?: boolean; hiOpen?: boolean }

/** Điểm 1–5: số đầu dòng phải parse đúng (tránh «10:» hiểu nhầm thành điểm 1). */
const LINE = /^\s*(\d+)\s*:\s*(.+)\s*$/
/** (a,b] / [a,b) — dấu phẩy giữa hai số (không phải dấu phẩy bắt buộc cuối dòng). */
const BRACKET_INTERVAL =
  /^\s*([\[(])\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*([\])])\s*$/
const RANGE = /^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/
const LT = /^<\s*(\d+(?:\.\d+)?)$/
const LE = /^<=\s*(\d+(?:\.\d+)?)$/
const GT = /^>\s*(\d+(?:\.\d+)?)$/
const GE = /^>=\s*(\d+(?:\.\d+)?)$/
const EQ = /^=\s*(\d+(?:\.\d+)?)$/

const NEG = -1e18
const POS = 1e18
const EPS = 1e-10

type Closed = { lo: number; hi: number }

function toClosed(rule: ScoringRuleNormalized): Closed {
  if ('min' in rule && 'max' in rule) {
    let lo = rule.min
    let hi = rule.max
    if (rule.loOpen) lo += EPS
    if (rule.hiOpen) hi -= EPS
    return { lo, hi }
  }
  const v = rule.value
  switch (rule.operator) {
    case '<':
      return { lo: NEG, hi: v - EPS }
    case '<=':
      return { lo: NEG, hi: v }
    case '>':
      return { lo: v + EPS, hi: POS }
    case '>=':
      return { lo: v, hi: POS }
    case '=':
      return { lo: v, hi: v }
    default:
      return { lo: NEG, hi: POS }
  }
}

function truncateOneLine(s: string, max: number): string {
  const t = s.replace(/\t/g, ' ').trim().replace(/\s+/g, ' ')
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

function requireNumAfterMatch(score: number, cond: string, raw: string | undefined): number {
  const v = Number.parseFloat(String(raw ?? '').trim())
  if (!Number.isFinite(v)) {
    throw new Error(
      `Score ${score}: a valid number after the operator in «${truncateOneLine(cond, 48)}».`,
    )
  }
  return v
}

function parseCondition(score: number, cond: string): ScoringRuleNormalized {
  const c = cond.trim()
  let m = BRACKET_INTERVAL.exec(c)
  if (m) {
    const left = m[1]
    const right = m[4]
    if ((left !== '(' && left !== '[') || (right !== ')' && right !== ']')) {
      throw new Error(
        `Score ${score}: interval «${truncateOneLine(c, 48)}» — only use ( or [ at the start and ) or ] at the end.`,
      )
    }
    const a = Number.parseFloat(m[2])
    const b = Number.parseFloat(m[3])
    if (!Number.isFinite(a) || !Number.isFinite(b) || a > b) {
      throw new Error(
        `Score ${score}: interval «${truncateOneLine(c, 48)}» is invalid — both numbers must be valid and left ≤ right.`,
      )
    }
    return {
      score,
      min: a,
      max: b,
      loOpen: left === '(',
      hiOpen: right === ')',
    }
  }

  m = RANGE.exec(c)
  if (m) {
    const min = Number.parseFloat(m[1])
    const max = Number.parseFloat(m[2])
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
      throw new Error(
        `Score ${score}: interval «${truncateOneLine(c, 48)}» is invalid — left number ≤ right number (e.g. 50-70).`,
      )
    }
    return { score, min, max }
  }
  m = LE.exec(c)
  if (m) return { score, operator: '<=', value: requireNumAfterMatch(score, c, m[1]) }
  m = LT.exec(c)
  if (m) return { score, operator: '<', value: requireNumAfterMatch(score, c, m[1]) }
  m = GE.exec(c)
  if (m) return { score, operator: '>=', value: requireNumAfterMatch(score, c, m[1]) }
  m = GT.exec(c)
  if (m) return { score, operator: '>', value: requireNumAfterMatch(score, c, m[1]) }
  m = EQ.exec(c)
  if (m) return { score, operator: '=', value: requireNumAfterMatch(score, c, m[1]) }
  throw new Error(
    `Score ${score}: condition «${truncateOneLine(c, 56)}» is invalid — use (a,b] / [a,b); interval 50-70; or <, <=, >, >=, =.`,
  )
}

export function parseScoringRulesDsl(rawInput: string): ScoringRuleNormalized[] {
  const raw = (rawInput ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!raw.trim()) return []
  const lines = raw.split('\n')

  const seen = new Set<number>()
  const rules: ScoringRuleNormalized[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line == null || !line.trim()) continue
    const lineTrim = line.trim()
    const toParse = lineTrim.endsWith(',') ? lineTrim.slice(0, -1).trim() : lineTrim
    const m = LINE.exec(toParse)
    if (!m) {
      throw new Error(
        `Line ${i + 1}: each line must have the format «score:condition» (e.g. 1: <50). Content: «${truncateOneLine(line, 80)}».`,
      )
    }
    const score = Number.parseInt(m[1], 10)
    if (!Number.isFinite(score) || score < 1 || score > 5) {
      throw new Error(
        `Line ${i + 1}: score must be from 1 to 5 (currently writing «${m[1]}»). Content: «${truncateOneLine(line, 80)}».`,
      )
    }
    if (seen.has(score)) {
      throw new Error(
        `Line ${i + 1}: duplicate score ${score} — each level (1–5) can only be declared once.`,
      )
    }
    seen.add(score)
    const condPart = (m[2] ?? '').trim()
    if (!condPart) {
      throw new Error(`Line ${i + 1}: missing condition after «:» (e.g. ${score}: <50).`)
    }
    rules.push(parseCondition(score, condPart))
  }
  return rules
}

export function validateScoringRulesDsl(rawInput: string): { ok: boolean; errors: string[] } {
  try {
    parseScoringRulesDsl(rawInput)
    return { ok: true, errors: [] }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Invalid.'
    return { ok: false, errors: [msg] }
  }
}

export function buildScoringRulesPayload(rawInput: string): { rawInput: string; rules: ScoringRuleNormalized[] } {
  const raw = rawInput ?? ''
  const rules = parseScoringRulesDsl(raw)
  return { rawInput: raw, rules }
}

/** Chuẩn hóa rule để JSON (số nguyên / thập phân gọn). */
function normalizeRuleForJson(r: ScoringRuleNormalized): Record<string, number | string | boolean> {
  if ('min' in r) {
    const o: Record<string, number | string | boolean> = { score: r.score, min: r.min, max: r.max }
    if (r.loOpen) o.loOpen = true
    if (r.hiOpen) o.hiOpen = true
    return o
  }
  return { score: r.score, operator: r.operator, value: r.value }
}

export function scoringRulesToJsonString(rawInput: string): string {
  const { rawInput: ri, rules } = buildScoringRulesPayload(rawInput)
  return JSON.stringify({
    rawInput: ri,
    rules: rules.map(normalizeRuleForJson),
  })
}

export type KpiScoringRulesApiShape = {
  rawInput?: string | null
  rules?: Array<Record<string, unknown>>
}

/** Chuỗi quy tắc chấm điểm để hiển thị (tooltip / readonly) từ `targetDescription` API. */
export function formatScoringRulesDisplayText(targetDescription: unknown): string {
  const fromApi = extractRawInputFromApiTargetDescription(targetDescription)
  if (fromApi.trim()) return fromApi.trim()
  const raw = typeof targetDescription === 'string' ? targetDescription.trim() : ''
  if (!raw) return ''
  try {
    JSON.parse(raw)
    return ''
  } catch {
    return raw
  }
}

export function extractRawInputFromApiTargetDescription(data: unknown): string {
  if (data == null) return ''
  if (typeof data === 'string') {
    const t = data.trim()
    if (!t) return ''
    try {
      const o = JSON.parse(t) as KpiScoringRulesApiShape
      if (o && typeof o === 'object' && typeof o.rawInput === 'string') return o.rawInput
    } catch {
      return ''
    }
    return ''
  }
  if (typeof data === 'object' && data !== null && 'rawInput' in data) {
    const ri = (data as KpiScoringRulesApiShape).rawInput
    return typeof ri === 'string' ? ri : ''
  }
  return ''
}

export function emptyScoringRulesPayload(): { rawInput: string; rules: ScoringRuleNormalized[] } {
  return { rawInput: '', rules: [] }
}

function ruleRecordFromApi(rec: Record<string, unknown>): ScoringRuleNormalized | null {
  const scoreRaw = rec.score
  const score = typeof scoreRaw === 'number' ? scoreRaw : Number(scoreRaw)
  if (!Number.isFinite(score) || score < 1 || score > 5) return null
  const minRaw = rec.min
  const maxRaw = rec.max
  if (minRaw != null && maxRaw != null) {
    const min = typeof minRaw === 'number' ? minRaw : Number(minRaw)
    const max = typeof maxRaw === 'number' ? maxRaw : Number(maxRaw)
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null
    const loOpen = rec.loOpen === true
    const hiOpen = rec.hiOpen === true
    return { score, min, max, ...(loOpen ? { loOpen: true } : {}), ...(hiOpen ? { hiOpen: true } : {}) }
  }
  const op = rec.operator
  const valRaw = rec.value
  if (typeof op === 'string' && (op === '<' || op === '<=' || op === '>' || op === '>=' || op === '=')) {
    const value = typeof valRaw === 'number' ? valRaw : Number(valRaw)
    if (!Number.isFinite(value)) return null
    return { score, operator: op, value }
  }
  return null
}

/**
 * Đọc quy tắc chấm điểm từ `kpis_information.target_description` (JSON API hoặc chuỗi JSON) — dùng preview điểm trên FE.
 */
export function parseScoringRulesFromTargetDescriptionStored(stored: unknown): ScoringRuleNormalized[] {
  if (stored == null) return []
  if (typeof stored === 'object' && stored !== null && !Array.isArray(stored)) {
    const o = stored as KpiScoringRulesApiShape
    const raw = typeof o.rawInput === 'string' ? o.rawInput : ''
    if (raw.trim()) {
      try {
        return parseScoringRulesDsl(raw)
      } catch {
        /* fall through */
      }
    }
    if (Array.isArray(o.rules) && o.rules.length > 0) {
      return o.rules
        .map((r) => (r && typeof r === 'object' ? ruleRecordFromApi(r as Record<string, unknown>) : null))
        .filter((x): x is ScoringRuleNormalized => x != null)
    }
    return []
  }
  if (typeof stored === 'string') {
    const t = stored.trim()
    if (!t) return []
    if (t.startsWith('{')) {
      try {
        return parseScoringRulesFromTargetDescriptionStored(JSON.parse(t) as KpiScoringRulesApiShape)
      } catch {
        return []
      }
    }
    return []
  }
  return []
}

function metricInClosed(metric: number, closed: Closed): boolean {
  return metric >= closed.lo && metric <= closed.hi
}

/** Ánh xạ metric (tỉ lệ % hoặc số Actual) → điểm 1–5 theo thứ tự quy tắc (khớp BE {@code KpiScoringRulesService#resolveScore}). */
export function resolveScoringScoreForMetric(
  metric: number | null | undefined,
  rules: ScoringRuleNormalized[],
): number | null {
  if (metric == null || !Number.isFinite(metric) || rules.length === 0) return null
  const m = metric as number
  for (const r of rules) {
    const c = toClosed(r)
    if (metricInClosed(m, c)) return r.score
  }
  return null
}

/**
 * Parse ScoringRuleNormalized[] from kpis_information.target_description.
 * Accepts either the JSON payload `{ rawInput, rules }` stored by StrategicKpiService
 * or a raw DSL string.
 */
export function parseRulesFromTargetDescription(
  target: string | null | undefined,
): ScoringRuleNormalized[] {
  if (!target) return []
  const t = String(target).trim()
  if (!t) return []
  // Try JSON (GM/strategic flow: { rawInput: "...", rules: [...] })
  try {
    const o = JSON.parse(t) as Record<string, unknown>
    if (o && typeof o === 'object') {
      const rawInput = typeof o.rawInput === 'string' ? o.rawInput : ''
      if (rawInput.trim()) {
        try { return parseScoringRulesDsl(rawInput) } catch { /* ignore */ }
      }
    }
  } catch { /* not JSON */ }
  // Try raw DSL
  try { return parseScoringRulesDsl(t) } catch { /* not DSL */ }
  return []
}

/**
 * Match a numeric actual value against parsed scoring rules.
 * Returns the matching score (1–5) or null if no rule matches.
 */
export function computeScoreFromRules(
  actualValue: number,
  rules: ScoringRuleNormalized[],
): number | null {
  for (const rule of rules) {
    let matches = false
    if ('min' in rule && 'max' in rule) {
      matches = actualValue >= rule.min && actualValue <= rule.max
    } else {
      switch (rule.operator) {
        case '<':  matches = actualValue <  rule.value; break
        case '<=': matches = actualValue <= rule.value; break
        case '>':  matches = actualValue >  rule.value; break
        case '>=': matches = actualValue >= rule.value; break
        case '=':  matches = actualValue === rule.value; break
      }
    }
    console.log(`Checking rule: ${JSON.stringify(rule)}, Actual value: ${actualValue}, Matches: ${matches}`)
    if (matches) return rule.score
  }
  return null
}