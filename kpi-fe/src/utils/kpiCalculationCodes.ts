/**
 * Ánh xạ công thức form Strategic KPI ↔ `sys_status_codes`:
 * - CALC_TYPE (7xx) → `calculation_type_code`
 * - CALC_RULE (8xx) → `calculation_rule_code`
 */

export type PersistedCalculationMethod =
  | 'mean_actual_plan'
  | 'mean_plan_actual'
  | 'mean_plan_actual_pct'
  | 'mean_plan_actual_sum'
  | 'manual_member_input'

export function codesFromPersistedCalculationMethod(
  persisted: string,
): { calculationTypeCode: number | null; calculationRuleCode: number } {
  const k = String(persisted ?? '').trim()
  switch (k) {
    case 'manual_member_input':
      return { calculationTypeCode: null, calculationRuleCode: 803 }
    case 'mean_actual_plan':
      return { calculationTypeCode: 701, calculationRuleCode: 802 }
    case 'mean_plan_actual':
      return { calculationTypeCode: 702, calculationRuleCode: 802 }
    case 'mean_plan_actual_pct':
      return { calculationTypeCode: 701, calculationRuleCode: 802 }
    case 'mean_plan_actual_sum':
      return { calculationTypeCode: null, calculationRuleCode: 801 }
    default:
      return { calculationTypeCode: 701, calculationRuleCode: 802 }
  }
}

/** Từ mã DB → chuỗi persisted dùng hydrate form (ưu tiên khi payload có mã). */
export function persistedCalculationMethodFromCodes(
  typeCode: unknown,
  ruleCode: unknown,
): PersistedCalculationMethod | null {
  const r = Number(ruleCode)
  if (!Number.isFinite(r)) return null

  const tRaw = typeCode
  const tMissing = tRaw == null || tRaw === ''
  const t = tMissing ? NaN : Number(tRaw)

  if (tMissing) {
    if (r === 801) return 'mean_plan_actual_sum'
    if (r === 802) return 'mean_plan_actual_pct'
    if (r === 803) return 'manual_member_input'
    return null
  }

  if (!Number.isFinite(t)) return null
  // Dòng cũ lưu CALC_TYPE 703 — vẫn hydrate đúng form COMMENT.
  if (r === 803 && t === 703) return 'manual_member_input'
  if (t === 701 && r === 802) return 'mean_actual_plan'
  if (t === 702 && r === 802) return 'mean_plan_actual'
  return null
}

/** Chuỗi `calculationMethod` gửi lên (mock / parent) từ cặp mã form. */
export function persistedCalculationMethodFromTypeAndRule(
  typeCode: number | null,
  ruleCode: number,
): PersistedCalculationMethod {
  const s = persistedCalculationMethodFromCodes(typeCode, ruleCode)
  if (s) return s
  if (ruleCode === 803) return 'manual_member_input'
  if (ruleCode === 801) return 'mean_plan_actual_sum'
  if (ruleCode === 802) {
    if (typeCode === 702) return 'mean_plan_actual'
    if (typeCode === 701) return 'mean_actual_plan'
    return 'mean_plan_actual_pct'
  }
  return 'mean_actual_plan'
}
