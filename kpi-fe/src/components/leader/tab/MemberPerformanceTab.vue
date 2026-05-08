<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { LeaderKpiInformationResponse } from '@/types/kpi'
import { formatTargetDisplay } from '@/utils/strategicKpiTypeCodes';

const props = defineProps<{
  member: LeaderMember | null
  data: LeaderKpiInformationResponse | null
}>()

const openRows = reactive<Record<string, boolean>>({})

function toggleRow(id: string) {
  openRows[id] = !openRows[id]
}

function rowOpen(id: string): boolean {
  return !!openRows[id]
}

const totalWeight = computed(() => {
  let sum = 0
  for (const c of props.data?.categories ?? []) {
    for (const a of c.assignments ?? []) {
      sum += a.weight || 0
    }
  }
  return sum
})

// function formatTargetDisplay(assign: any): string {
//   const raw = assign?.targetValue
//   if (raw == null || raw === '') return '-'

//   const unit = String(assign?.unitName ?? '').trim()

//   if (unit === 'Percent') {
//     return `${raw}%`
//   }

//   return unit ? `${raw} ${unit}` : String(raw)
// }

const evaluationComment = computed(() =>
  String(props.data?.kpiSummary?.evaluationComments ?? '').trim(),
)

const allAssignments = computed(() =>
  (props.data?.categories ?? []).flatMap(c => c.assignments ?? []),
)

function selfScoreOf(a: Record<string, unknown>): number | null {
  const endSelf = a.endSelfScore as number | null | undefined
  const midSelf = a.midSelfScore as number | null | undefined
  return endSelf ?? midSelf ?? null
}

function pmScoreOf(a: Record<string, unknown>): number | null {
  const endPm = a.endPmScore as number | null | undefined
  const midPm = a.midPmScore as number | null | undefined
  return endPm ?? midPm ?? null
}

const selfWeightSum = computed(() =>
  allAssignments.value.reduce((sum, a) => (selfScoreOf(a as any) != null ? sum + (a.weight || 0) : sum), 0),
)

const pmWeightSum = computed(() =>
  allAssignments.value.reduce((sum, a) => (pmScoreOf(a as any) != null ? sum + (a.weight || 0) : sum), 0),
)

const totalSelfWeightedScore = computed(() =>
  allAssignments.value.reduce(
    (sum, a) => {
      const s = selfScoreOf(a as any)
      return s != null ? sum + s * (a.weight || 0) : sum
    },
    0,
  ),
)

const totalPmWeightedScore = computed(() =>
  allAssignments.value.reduce(
    (sum, a) => {
      const s = pmScoreOf(a as any)
      return s != null ? sum + s * (a.weight || 0) : sum
    },
    0,
  ),
)

const selfWeightedAvg = computed((): number | null => {
  if (!selfWeightSum.value) return null
  return totalSelfWeightedScore.value / selfWeightSum.value
})

const pmWeightedAvg = computed((): number | null => {
  if (!pmWeightSum.value) return null
  return totalPmWeightedScore.value / pmWeightSum.value
})

function statusClass(code: number | null | undefined): string {
  const c = Number(code ?? 0)
  if ([501, 502, 601, 602].includes(c)) return 'border-sky-200 bg-sky-50 text-sky-700'
  if (c === 407) return 'border-violet-200 bg-violet-50 text-violet-700'
  if (c === 406) return 'border-orange-200 bg-orange-50 text-orange-700'
  if ([503, 603].includes(c)) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function parseEvidence(raw: string | null | undefined): {
  rows: Array<{ plan: string; actual: string; comment: string }>
  urls: string[]
  note: string
  cert: string
  memberFeedback: string
  leaderFeedback: string
  gmComment: string
  result: string
} {
  const empty = {
    rows: [],
    urls: [],
    note: '',
    cert: '',
    memberFeedback: '',
    leaderFeedback: '',
    gmComment: '',
    result: '',
  }
  if (!raw || raw === '{}' || raw === '[]') return empty
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    const rows = Array.isArray(o.planActualRecords)
      ? o.planActualRecords.map((r) => ({
          plan: String((r as Record<string, unknown>)?.plan ?? ''),
          actual: String((r as Record<string, unknown>)?.actual ?? ''),
          comment: String((r as Record<string, unknown>)?.comment ?? ''),
        }))
      : []
    const files = Array.isArray(o.files) ? o.files : []
    const urls = files
      .map((f) => String((f as Record<string, unknown>)?.url ?? '').trim())
      .filter((u) => !!u)
    return {
      rows,
      urls,
      note: String(o.note ?? o.content ?? '').trim(),
      cert: String(o.certificateOutcomeNote ?? '').trim(),
      memberFeedback: String(o.memberFeedback ?? '').trim(),
      leaderFeedback: String(o.leaderFeedback ?? '').trim(),
      gmComment: String(o.gmComment ?? '').trim(),
      result: String(o.result ?? '').trim(),
    }
  } catch {
    return empty
  }
}

function evidenceBadgeText(raw: string | null | undefined): string {
  const p = parseEvidence(raw)
  if (p.rows.length || p.urls.length || p.note) return 'Evidence'
  return 'No Evidence'
}

function actualPreview(raw: string | null | undefined): string {
  const p = parseEvidence(raw)
  if (p.rows.length) {
    const values = p.rows.map(r => r.actual.trim()).filter(Boolean)
    if (values.length) return values.slice(0, 2).join(' | ') + (values.length > 2 ? '…' : '')
  }
  if (p.note) return p.note
  return '-'
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div v-if="!data?.categories?.length" class="p-8 text-center text-slate-500">
      Chưa có dữ liệu KPI Cá nhân.
    </div>

    <div v-else class="bg-white border-b border-slate-200">
      <table class="w-full text-left">
        <thead class="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 shadow-sm">
          <tr>
            <th class="w-10 px-4 py-3 text-center">STT</th>
            <th class="px-4 py-3">Hạng Mục (Objectives)</th>
            <th class="px-4 py-3">Chỉ tiêu (Target)</th>
            <th class="px-4 py-3">Thực tế (Actual)</th>
            <th class="w-20 px-4 py-3 text-center">Trọng số (W)</th>
            <th class="w-36 px-4 py-3 text-center">Evidence</th>
            <th class="w-20 px-4 py-3 text-center">Self</th>
            <th class="w-24 px-4 py-3 text-center">PM Score</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <template v-for="(category, catIndex) in data.categories" :key="`p-${catIndex}`">
            <tr class="bg-amber-50/80 border-y border-amber-100">
              <td colspan="8" class="px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-800">
                {{ category.name }}
              </td>
            </tr>

            <template v-for="(assign, assignIndex) in category.assignments" :key="assign.assignmentId">
              <tr class="group bg-white transition-colors hover:bg-slate-50">
                <td class="px-4 py-3 text-center text-xs font-semibold text-slate-400">{{ assignIndex + 1 }}</td>
                <td class="px-4 py-3 align-middle">
                  <button
                    type="button"
                    class="w-full text-left"
                    @click="toggleRow(assign.assignmentId)"
                  >
                    <p class="text-sm font-bold text-slate-900">{{ assign.kpiCode }} {{ assign.kpiName }} 
                      <span
                        class="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ml-2"
                        :class="statusClass(assign.statusCode)"
                      >
                        {{ assign.statusDesc || '-' }}
                      </span>
                    </p>
                  </button>
                </td>
                <td class="px-4 py-3 align-middle">
                  <p class="text-xs font-medium text-slate-700">{{ formatTargetDisplay(assign) }}</p>
                </td>
                <td class="px-4 py-3 align-middle">
                  <p class="text-xs font-bold text-emerald-700">{{ parseEvidence(assign.evidences).result || '-' }}</p>
                </td>
                <td class="px-4 py-3 text-center align-middle">
                  <span class="inline-block rounded-lg bg-slate-100 px-2 py-1 text-sm font-bold text-slate-700">
                    {{ assign.weight || 0 }}
                  </span>
                </td>
                <td class="px-4 py-3 text-center align-middle">
                  <button
                    type="button"
                    class="inline-flex min-w-28 items-center justify-between gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-[11px] font-bold text-blue-700"
                    @click="toggleRow(assign.assignmentId)"
                  >
                    <span class="inline-flex items-center gap-1">
                      <i class="fas fa-file-alt text-xs" />
                      {{ evidenceBadgeText(assign.evidences) }}
                    </span>
                    <i class="fas fa-chevron-down text-[10px] text-slate-500 transition-transform" :class="rowOpen(assign.assignmentId) ? 'rotate-180' : ''" />
                  </button>
                </td>
                <td class="px-4 py-3 text-center align-middle">
                  <span class="inline-block min-w-10 rounded-lg bg-slate-100 px-2 py-1.5 text-sm font-bold text-slate-700">
                    {{ assign.endSelfScore ?? assign.midSelfScore ?? 0 }}
                  </span>
                </td>
                <td class="px-4 py-3 text-center align-middle">
                  <span class="inline-block min-w-10 rounded-lg bg-slate-50 px-2 py-1.5 text-sm font-semibold text-slate-600">
                    {{ assign.endPmScore }}
                  </span>
                </td>
              </tr>

              <tr v-if="rowOpen(assign.assignmentId)" class="bg-slate-50/40">
                <td colspan="8" class="border-t border-indigo-100 px-5 py-3">
                  <div class="space-y-3 rounded-lg border border-indigo-100 bg-white p-3">
                    <div class="flex flex-wrap items-center gap-2">
                      <span
                        v-if="parseEvidence(assign.evidences).memberFeedback || parseEvidence(assign.evidences).leaderFeedback"
                        class="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700"
                      >
                        Chờ PM kiểm tra feedback
                      </span>
                    </div>

                    <p v-if="parseEvidence(assign.evidences).note" class="text-xs text-slate-700">
                      <span class="font-bold text-slate-500">Ghi chú:</span>
                      {{ parseEvidence(assign.evidences).note }}
                    </p>
                    <p v-if="parseEvidence(assign.evidences).cert" class="text-xs text-indigo-700">
                      <span class="font-bold text-indigo-500">Chứng chỉ / Outcome:</span>
                      {{ parseEvidence(assign.evidences).cert }}
                    </p>
                    <p v-if="parseEvidence(assign.evidences).memberFeedback" class="text-xs text-violet-700">
                      <span class="font-bold text-violet-500">Member feedback:</span>
                      {{ parseEvidence(assign.evidences).memberFeedback }}
                    </p>
                    <p v-if="parseEvidence(assign.evidences).leaderFeedback" class="text-xs text-violet-700">
                      <span class="font-bold text-violet-500">Leader feedback:</span>
                      {{ parseEvidence(assign.evidences).leaderFeedback }}
                    </p>
                    <p v-if="parseEvidence(assign.evidences).gmComment" class="text-xs text-slate-700">
                      <span class="font-bold text-slate-500">GM comment:</span>
                      {{ parseEvidence(assign.evidences).gmComment }}
                    </p>

                    <div class="overflow-hidden rounded-lg border border-indigo-100">
                      <div class="border-b border-indigo-100 bg-indigo-50/70 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-indigo-800">
                        Evidences
                      </div>
                      <div v-if="parseEvidence(assign.evidences).rows.length" class="overflow-x-auto">
                        <table class="w-full text-xs">
                          <thead class="border-b border-indigo-100 bg-slate-50 text-slate-700">
                            <tr>
                              <th class="px-2 py-1.5 text-left font-bold">Plan</th>
                              <th class="px-2 py-1.5 text-left font-bold">Actual</th>
                              <th class="px-2 py-1.5 text-left font-bold">Comment</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-slate-100 bg-white">
                            <tr v-for="(r, ridx) in parseEvidence(assign.evidences).rows" :key="`${assign.assignmentId}-${ridx}`">
                              <td class="px-2 py-1.5 text-slate-700">{{ r.plan || '-' }}</td>
                              <td class="px-2 py-1.5 font-semibold text-emerald-700">{{ r.actual || '-' }}</td>
                              <td class="px-2 py-1.5 text-slate-700">{{ r.comment || '-' }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div v-else class="px-3 py-2 text-xs text-slate-500">Chưa có chi tiết evidence dạng bảng.</div>
                    </div>

                    <div v-if="parseEvidence(assign.evidences).urls.length" class="space-y-1">
                      <p class="text-[11px] font-bold uppercase text-slate-500">Links</p>
                      <a
                        v-for="(u, uidx) in parseEvidence(assign.evidences).urls"
                        :key="`${assign.assignmentId}-u-${uidx}`"
                        :href="u"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="block truncate text-xs font-medium text-indigo-700 hover:underline"
                      >
                        {{ u }}
                      </a>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </template>
        </tbody>

        <tfoot class="border-t-2 border-slate-200 bg-slate-100/80 font-bold">
          <tr>
            <td colspan="4" class="px-5 py-3 text-right text-xs uppercase tracking-wider text-slate-700">
              Tổng cộng (Total score):
            </td>
            <td class="px-5 py-3 text-center text-sm text-slate-700">{{ totalWeight }}</td>
            <td class="px-5 py-3 text-center text-xs font-medium text-slate-400">-</td>
            <td class="bg-sky-50/50 px-5 py-3 text-center text-sm text-slate-700">
              {{ totalSelfWeightedScore > 0 ? totalSelfWeightedScore.toFixed(1) : '-' }}
            </td>
            <td class="px-5 py-3 text-center text-sm text-slate-600">
              {{ totalPmWeightedScore > 0 ? totalPmWeightedScore.toFixed(1) : '-' }}
            </td>
          </tr>
          <tr class="border-t border-slate-200 bg-violet-50/50">
            <td colspan="4" class="px-5 py-3 text-right text-xs uppercase tracking-wider text-violet-800">
              Điểm trung bình (Average score):
            </td>
            <td class="px-5 py-3" />
            <td class="px-5 py-3 text-center text-xs font-medium text-slate-400">-</td>
            <td class="bg-sky-50/50 px-5 py-3 text-center text-sm text-slate-700">
              {{ selfWeightedAvg !== null ? selfWeightedAvg.toFixed(2) : '-' }}
            </td>
            <td class="bg-violet-100/80 px-5 py-3 text-center">
              <span class="text-lg font-extrabold text-violet-700">
                {{ pmWeightedAvg !== null ? pmWeightedAvg.toFixed(2) : '-' }}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>

      <div class="border-t border-slate-200 bg-white p-5">
        <h4 class="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
          <i class="fas fa-comments text-blue-600" />
          Comment of employee and supervisor
        </h4>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Employee's Comment
            </label>
            <textarea
              :value="evaluationComment || 'Chưa có nhận xét.'"
              rows="3"
              readonly
              class="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Supervisor Comment
            </label>
            <textarea
              value=""
              rows="3"
              readonly
              placeholder="Chưa có nhận xét từ Supervisor."
              class="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
