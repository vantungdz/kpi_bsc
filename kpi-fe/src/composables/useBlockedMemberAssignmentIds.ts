import { ref, watch, type Ref } from 'vue'
import { apiGetBlockedMemberIdsForAssignment } from '@/services/modules/kpi-reference.service'

function normalizeBlockedIdSet(ids: string[]): Set<string> {
  return new Set(ids.map((x) => String(x).trim().toLowerCase()).filter(Boolean))
}

/**
 * User id (member hoặc PM) không được giao KPI mới trong chu kỳ khi còn assignment ASM khác 404/406/407.
 */
export function useBlockedMemberAssignmentIds(cycleId: Ref<string | null | undefined>) {
  const blockedMemberIds = ref<Set<string>>(new Set())
  const loading = ref(false)

  async function refresh() {
    const cid = String(cycleId.value ?? '').trim()
    if (!cid) {
      blockedMemberIds.value = new Set()
      return
    }
    loading.value = true
    try {
      const ids = await apiGetBlockedMemberIdsForAssignment(cid)
      blockedMemberIds.value = normalizeBlockedIdSet(ids)
    } catch {
      blockedMemberIds.value = new Set()
    } finally {
      loading.value = false
    }
  }

  watch(cycleId, () => void refresh(), { immediate: true })

  return { blockedMemberIds, loading, refresh }
}
