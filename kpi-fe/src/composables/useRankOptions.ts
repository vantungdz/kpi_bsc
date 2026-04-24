import { ref } from 'vue'
import { apiGetRanks } from '@/services/modules/kpi-reference.service'
import type { RankOption } from '@/types/rank-option'

/** Tải danh sách cấp bậc (`GET /kpi/reference/ranks`). */
export function useRankOptions() {
  const ranks = ref<RankOption[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const rows = await apiGetRanks()
      ranks.value = Array.isArray(rows) ? rows : []
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Không tải được danh sách cấp bậc'
      ranks.value = []
    } finally {
      loading.value = false
    }
  }

  return { ranks, loading, error, load }
}
