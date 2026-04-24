import { ref } from 'vue'
import { apiGetKpiUnits } from '@/services/modules/kpi-reference.service'
import type { KpiUnitOption } from '@/types/kpi-unit'

/** Tải dropdown đơn vị KPI (`GET /kpi/reference/kpi-units`). Lỗi hoặc mảng rỗng → không có option. */
export function useKpiUnitOptions() {
  const options = ref<KpiUnitOption[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const rows = await apiGetKpiUnits()
      options.value = Array.isArray(rows) ? rows : []
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Không tải được danh sách đơn vị KPI'
      options.value = []
    } finally {
      loading.value = false
    }
  }

  return { options, loading, error, load }
}
