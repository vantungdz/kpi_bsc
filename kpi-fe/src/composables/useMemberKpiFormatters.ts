/**
 * Composable for KPI display formatters that depend on the draft store.
 * Used in KPI table components to show the latest draft values.
 */
import type { KpiItem } from '@/types/kpi'
import { useMemberKpiDraftStore } from '@/stores/member-kpi-drafts.store'
import { memberItemEvalStatus } from '@/utils/memberKpiHelpers'
import { displayTargetValue, formatTargetDisplayForMemeber } from '@/utils/strategicKpiTypeCodes'

export function useMemberKpiFormatters() {
  const draftStore = useMemberKpiDraftStore()

  function formatEvidenceJsonSummary(item: KpiItem): string | undefined {
    const jsonSource = draftStore.getDraft(item.id)?.evidencesJson ?? item.evidencesJson
    const raw = String(jsonSource ?? '').trim()
    if (!raw || raw === '{}' || raw === 'null') return undefined

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const note = String(parsed.note ?? parsed.text ?? '').trim()
      const result = String(parsed.result ?? '').trim()
      const planActualRecords = Array.isArray(parsed.planActualRecords)
        ? (parsed.planActualRecords as unknown[])
            .map((row) => {
              if (!row || typeof row !== 'object') return undefined
              const r = row as Record<string, unknown>
              return String(r.actual ?? '').trim()
            })
            .filter(Boolean)
        : []
      const evdNames = [
        ...(Array.isArray(parsed.evd)
          ? (parsed.evd as unknown[])
              .map((row) => {
                if (!row || typeof row !== 'object') return undefined
                const r = row as Record<string, unknown>
                return String(r.name ?? '').trim() || String(r.url ?? '').trim()
              })
              .filter(Boolean)
          : []),
        ...(Array.isArray(parsed.files)
          ? (parsed.files as unknown[])
              .map((row) => {
                if (!row || typeof row !== 'object') return undefined
                const r = row as Record<string, unknown>
                return String(r.name ?? '').trim() || String(r.url ?? '').trim()
              })
              .filter(Boolean)
          : []),
      ]

      if (item.group === 'B') {
        if (note) return note.length > 64 ? `${note.slice(0, 63)}…` : note
      }

      if (result) return result
      if (planActualRecords.length) return planActualRecords.join(' | ')
      if (note) return note
      if (evdNames.length) return evdNames.join(', ')
    } catch {
      // fallback when JSON parsing fails
    }
    return undefined
  }

  function formatKpiActualResult(item: KpiItem): string {
    const evidenceDisplay = formatEvidenceJsonSummary(item)
    if (evidenceDisplay) return `${evidenceDisplay} ${displayTargetValue(item, evidenceDisplay)}`

    if (item.group === 'B') {
      const c = item.evidenceNote?.trim()
      if (!c) return '-'
      return c.length > 64 ? `${c.slice(0, 63)}…` : c
    }

    const r = item.result?.toString().trim()
    return r || '-'
  }

  /** Trả về true nếu ô Actual có nội dung có nghĩa */
  function hasMeaningfulActualCell(item: KpiItem): boolean {
    return formatKpiActualResult(item) !== '-'
  }

  return {
    formatKpiActualResult,
    formatEvidenceJsonSummary,
    hasMeaningfulActualCell,
    memberItemEvalStatus,
  }
}
