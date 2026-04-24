import { ref } from 'vue'
import { apiGetDepartmentManagers } from '@/services/modules/kpi-reference.service'
import type { DepartmentManagerOption } from '@/types/department-manager'

/** Tải quản lý department (`departments.manager_id`) cho form KPI cascading. */
export function useDepartmentManagerOptions() {
  const users = ref<DepartmentManagerOption[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const rows = await apiGetDepartmentManagers()
      users.value = Array.isArray(rows) ? rows : []
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Không tải được danh sách quản lý department'
      users.value = []
    } finally {
      loading.value = false
    }
  }

  return { users, loading, error, load }
}
