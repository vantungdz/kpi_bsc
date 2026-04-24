/** Phần tử `sys_status_codes` (CALC_TYPE) — `value` = UPPER(name). */
export interface StatusCodeOption {
  code: number
  value: string
  label: string
}

/** Một CALC_RULE (dropdown) + các CALC_TYPE được phép (radio). */
export interface CalcRuleWithTypesOption {
  code: number
  value: string
  label: string
  calcTypes: StatusCodeOption[]
}

export interface KpiCalculationReferenceData {
  calcRulesWithTypes: CalcRuleWithTypesOption[]
}
