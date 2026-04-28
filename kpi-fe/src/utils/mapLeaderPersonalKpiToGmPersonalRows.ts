import type { LeaderKpiAssignment, LeaderKpiInformationResponse } from '@/types/kpi'
import type {
  GmBscPerspective,
  GmPersonalKpiRowMock,
  GmPersonalKpiRowStatus,
  GmStrategicKpiKind,
} from '@/types/gm-workspace'

/** `LeaderKpiAssignment.type` (INDIVIDUAL / PROMOTION / …) → tag GM workspace. */
function gmStrategicKpiKindFromLeaderAssignmentType(t: string | null | undefined): GmStrategicKpiKind {
  const u = String(t ?? '').trim().toUpperCase()
  if (u === 'PROMOTION' || u === '103') return 'promotion'
  if (u === 'INDIVIDUAL' || u === '101') return 'individual'
  if (u === 'TEAM' || u === 'CASCADING' || u === '102') return 'cascading'
  return 'individual'
}

function gmStrategicKpiKindFromRequestedType(t: string | null | undefined): GmStrategicKpiKind {
  const u = String(t ?? '').trim().toUpperCase()
  if (u === 'PROMOTION') return 'promotion'
  if (u === 'INDIVIDUAL') return 'individual'
  return 'individual'
}

function stripHtml(s: string): string {
  if (!s) return ''
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Gợi ý nhóm BSC từ tên danh mục (API `kpi_categories.name`). */
function inferBscFromCategoryName(name: string): GmBscPerspective {
  const n = name.toLowerCase()
  if (/financial|tài chính|💰/.test(n)) return 'financial'
  if (/customer|khách hàng|👥/.test(n)) return 'customer'
  if (/learning|đào tạo|growth|phát triển|🎓/.test(n)) return 'learning'
  if (/internal|vận hành|quy trình|nội bộ|⚙️/.test(n)) return 'internal'
  return 'internal'
}

function resolveStatus(a: LeaderKpiAssignment): GmPersonalKpiRowStatus {
  const v = a.endSelfScore ?? a.midSelfScore ?? null
  if (v == null) return 'pending'
  if (v >= 4) return 'good'
  if (v >= 3) return 'warn'
  return 'pending'
}

function formatFinalScore(a: LeaderKpiAssignment): string {
  if (a.endSelfScore != null) return String(a.endSelfScore)
  if (a.midSelfScore != null) return String(a.midSelfScore)
  return '—'
}

/**
 * Gộp một hoặc nhiều payload `GET /kpi/leader/kpi-info` (ví dụ INDIVIDUAL + PROMOTION)
 * thành dòng hiển thị cho `GmGmPersonalKpiPanel`.
 */
export function mergeLeaderKpiInfoResponsesToGmPersonalRows(
  inputs: {
    requestedType: 'INDIVIDUAL' | 'PROMOTION'
    response: LeaderKpiInformationResponse | null | undefined
  }[],
): GmPersonalKpiRowMock[] {
  const seen = new Set<string>()
  const out: GmPersonalKpiRowMock[] = []

  for (const input of inputs) {
    const resp = input.response
    if (!resp?.categories?.length) continue
    for (const cat of resp.categories) {
      const bsc = inferBscFromCategoryName(String(cat.name ?? ''))
      for (const a of cat.assignments ?? []) {
        const id = String(a.assignmentId ?? '').trim()
        if (!id || seen.has(id)) continue
        seen.add(id)
        const fromAssignment = gmStrategicKpiKindFromLeaderAssignmentType(
          (a as LeaderKpiAssignment & { type?: string | null }).type,
        )
        const kpiType =
          fromAssignment === 'individual'
            ? gmStrategicKpiKindFromRequestedType(input.requestedType)
            : fromAssignment
        out.push({
          id,
          diagnosticsFallbackGroup: bsc,
          objective: String(a.kpiName ?? a.kpiCode ?? 'KPI').trim() || 'KPI',
          kpiType,
          target: stripHtml(String(a.targetDescription ?? '')) || '—',
          weight: Number.isFinite(Number(a.weight)) ? Math.round(Number(a.weight)) : 0,
          actual: '—',
          finalScore: formatFinalScore(a),
          status: resolveStatus(a),
        })
      }
    }
  }
  return out
}
