import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UpdateMemberSheetItemBody } from '@/services/modules/kpi-member.service'

/** Draft chỉ đồng bộ server khi bấm Submit Đánh Giá trên dashboard (flushAll). */
export type MemberKpiDraftEntry = {
  evidencesJson: string
  /** 1–5 hoặc null nếu chưa chọn */
  selfScore: number | null
}

export const useMemberKpiDraftStore = defineStore('memberKpiDrafts', () => {
  const drafts = ref<Record<string, MemberKpiDraftEntry>>({})

  function setDraft(assignmentId: string, entry: MemberKpiDraftEntry) {
    drafts.value = { ...drafts.value, [assignmentId]: entry }
  }

  function getDraft(assignmentId: string): MemberKpiDraftEntry | undefined {
    return drafts.value[assignmentId]
  }

  function clearAll() {
    drafts.value = {}
  }

  async function flushAll(
    updateFn: (assignmentId: string, body: UpdateMemberSheetItemBody) => Promise<unknown>,
  ) {
    const entries = Object.entries(drafts.value)
    for (const [id, d] of entries) {
      const body: UpdateMemberSheetItemBody = { evidences: d.evidencesJson }
      if (d.selfScore != null && Number.isFinite(d.selfScore)) {
        const s = Math.round(Number(d.selfScore))
        if (s >= 1 && s <= 5) body.selfScore = s
      }
      await updateFn(id, body)
    }
    clearAll()
  }

  return { drafts, setDraft, getDraft, clearAll, flushAll }
})
