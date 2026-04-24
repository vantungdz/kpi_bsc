import { ref } from 'vue'
import { gmKpiService } from '@/services/modules/kpi-gm.service'
import type { GmKpiCategoryItem } from '@/types/gm-kpi-category'

/** Tải danh sách nhóm KPI (`kpi_categories`) cho dropdown GM. */
export function useGmKpiCategoryOptions() {
  const categories = ref<GmKpiCategoryItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      categories.value = await gmKpiService.getKpiCategories()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Không tải được nhóm KPI'
      categories.value = []
    } finally {
      loading.value = false
    }
  }

  return { categories, loading, error, load }
}
