import { ref, watch, type Ref } from 'vue'
import { apiGetBlockedMemberIdsForAssignment } from '@/services/modules/kpi-reference.service'

function normalizeBlockedIdSet(ids: string[]): Set<string> {
  return new Set(ids.map((x) => String(x).trim().toLowerCase()).filter(Boolean))
}

/** Nhóm chặn gán: strategic = 101+102, promotion = 103. */
export type BlockedAssignmentScope = 'strategic' | 'promotion'

export type BlockedMemberAssignmentQuery = {
  assignmentScope: BlockedAssignmentScope
}

/**
 * User id không được giao KPI mới trong chu kỳ — theo nhóm loại (strategic vs promotion).
 */
export function useBlockedMemberAssignmentIds(
  cycleId: Ref<string | null | undefined>,
  query: Ref<BlockedMemberAssignmentQuery | null | undefined>,
) {
  const blockedMemberIds = ref<Set<string>>(new Set())
  const loading = ref(false)

  async function refresh() {
    const cid = String(cycleId.value ?? '').trim()
    const scope = query.value?.assignmentScope
    if (!cid || !scope) {
      blockedMemberIds.value = new Set()
      return
    }
    loading.value = true
    try {
      const ids = await apiGetBlockedMemberIdsForAssignment(cid, scope)
      blockedMemberIds.value = normalizeBlockedIdSet(ids)
    } catch {
      blockedMemberIds.value = new Set()
    } finally {
      loading.value = false
    }
  }

  watch([cycleId, query], () => void refresh(), { immediate: true, deep: true })

  return { blockedMemberIds, loading, refresh }
}
