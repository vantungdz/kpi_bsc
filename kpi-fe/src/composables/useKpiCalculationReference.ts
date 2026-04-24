import { ref } from 'vue'
import { apiGetCalculationReference } from '@/services/modules/kpi-reference.service'
import type { CalcRuleWithTypesOption, KpiCalculationReferenceData } from '@/types/kpi-calculation-reference'
import { getFallbackCalculationReference } from '@/utils/calculationReferenceFallback'

function normalizePayload(data: KpiCalculationReferenceData | null | undefined): KpiCalculationReferenceData {
  const fb = getFallbackCalculationReference()
  if (!data?.calcRulesWithTypes?.length) return fb
  return { calcRulesWithTypes: data.calcRulesWithTypes }
}

/** Tải CALC_RULE (dropdown) + CALC_TYPE theo từng rule (`GET /kpi/reference/calculation-reference`). */
export function useKpiCalculationReference() {
  const calcRulesWithTypes = ref<CalcRuleWithTypesOption[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const data = await apiGetCalculationReference()
      const n = normalizePayload(data)
      calcRulesWithTypes.value = n.calcRulesWithTypes
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Không tải được cấu hình cách tính KPI'
      calcRulesWithTypes.value = getFallbackCalculationReference().calcRulesWithTypes
    } finally {
      loading.value = false
    }
  }

  return { calcRulesWithTypes, loading, error, load }
}
