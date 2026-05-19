<script setup lang="ts">
import { computed } from 'vue'
import { formatKpiTargetWithUnit } from '@/utils/kpiUnitCodes'

const props = withDefaults(
  defineProps<{
    evidences: string | null | undefined
    calculationRuleCode?: number | null
    unitCode?: number | null
    /** Màu cột Actual: performance = emerald, promotion = violet */
    actualTone?: 'emerald' | 'violet'
  }>(),
  { actualTone: 'emerald' },
)

type EvidenceRow = { plan: string; actual: string; comment: string }
type Attachment = { url: string; name: string }

const parsed = computed(() => {
  const empty = {
    rows: [] as EvidenceRow[],
    attachments: [] as Attachment[],
    note: '',
    cert: '',
    memberFeedback: '',
    leaderFeedback: '',
    gmComment: '',
    result: '',
  }
  const raw = props.evidences
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

    const fromFiles = Array.isArray(o.files)
      ? (o.files as unknown[])
          .map((f) => {
            if (!f || typeof f !== 'object') return null
            const rec = f as Record<string, unknown>
            const url = String(rec.url ?? '').trim()
            if (!url) return null
            const name = String(rec.name ?? rec.fileName ?? '').trim()
            return { url, name: name || url }
          })
          .filter((x): x is Attachment => x != null)
      : []

    const fromEvd = Array.isArray(o.evd)
      ? (o.evd as unknown[])
          .map((f) => {
            if (!f || typeof f !== 'object') return null
            const rec = f as Record<string, unknown>
            const url = String(rec.url ?? '').trim()
            if (!url) return null
            const name = String(rec.name ?? '').trim()
            return { url, name: name || url }
          })
          .filter((x): x is Attachment => x != null)
      : []

    const seen = new Set<string>()
    const attachments: Attachment[] = []
    for (const a of [...fromFiles, ...fromEvd]) {
      if (seen.has(a.url)) continue
      seen.add(a.url)
      attachments.push(a)
    }

    return {
      rows,
      attachments,
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
})

const hidePlanColumn = computed(() => {
  const rule = Number(props.calculationRuleCode ?? NaN)
  if (rule === 803 || rule === 801) return true
  const rows = parsed.value.rows
  if (!rows.length) return false
  const hasActual = rows.some((r) => r.actual.trim() !== '')
  if (!hasActual) return false
  const hasPlan = rows.some((r) => r.plan.trim() !== '')
  return !hasPlan
})

const actualCellClass = computed(() =>
  props.actualTone === 'violet' ? 'font-bold text-violet-600' : 'font-bold text-emerald-600',
)

function formatActualCell(actual: string): string {
  const trimmed = actual.trim()
  if (!trimmed || trimmed === '-') return '-'
  return formatKpiTargetWithUnit(trimmed, props.unitCode ?? undefined)
}

const hasTable = computed(() => parsed.value.rows.length > 0)
const hasComment = computed(() => !!parsed.value.note)
const hasAttachments = computed(() => parsed.value.attachments.length > 0)
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <span
        v-if="parsed.memberFeedback || parsed.leaderFeedback"
        class="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700"
      >
        Feedback Pending PM Review
      </span>
    </div>

    <p v-if="parsed.cert" class="text-xs text-indigo-700">
      <span class="font-bold text-indigo-500">Certificate / Outcome:</span>
      {{ parsed.cert }}
    </p>
    <p v-if="parsed.memberFeedback" class="text-xs text-violet-700">
      <span class="font-bold text-violet-500">Member feedback:</span>
      {{ parsed.memberFeedback }}
    </p>
    <p v-if="parsed.leaderFeedback" class="text-xs text-violet-700">
      <span class="font-bold text-violet-500">Leader feedback:</span>
      {{ parsed.leaderFeedback }}
    </p>
    <p v-if="parsed.gmComment" class="text-xs text-slate-700">
      <span class="font-bold text-slate-500">GM comment:</span>
      {{ parsed.gmComment }}
    </p>

    <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Evidences</p>

      <div class="overflow-x-auto rounded-lg border border-indigo-100 bg-white shadow-sm">
        <table class="w-full text-left text-xs">
          <thead class="bg-indigo-50 text-indigo-800 uppercase tracking-wider text-[10px] font-bold">
            <tr>
              <th
                class="px-3 py-2.5 text-center"
                :class="hidePlanColumn ? 'w-2/3' : 'w-3/5'"
              >
                Content
              </th>
              <th
                v-if="!hidePlanColumn"
                class="w-1/5 border-l border-indigo-100/60 px-3 py-2.5 text-center"
              >
                Plan
              </th>
              <th
                class="border-l border-indigo-100/60 px-3 py-2.5 text-center"
                :class="hidePlanColumn ? 'w-1/3' : 'w-1/5'"
              >
                Actual
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="(row, ridx) in parsed.rows"
              :key="ridx"
              class="transition-colors hover:bg-slate-50"
            >
              <td class="px-3 py-2.5 font-medium leading-snug text-slate-800">
                {{ row.comment || '-' }}
              </td>
              <td
                v-if="!hidePlanColumn"
                class="border-l border-slate-100 px-3 py-2.5 text-center text-slate-600"
              >
                {{ row.plan || '-' }}
              </td>
              <td
                class="border-l border-slate-100 px-3 py-2.5 text-center"
                :class="actualCellClass"
              >
                {{ formatActualCell(row.actual) }}
              </td>
            </tr>
            <tr v-if="!hasTable">
              <td
                :colspan="hidePlanColumn ? 2 : 3"
                class="px-3 py-3 text-center text-sm font-medium italic text-slate-400"
              >
                Không có dữ liệu khai báo chi tiết.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="hasComment"
        class="rounded-lg border border-amber-200/80 bg-amber-50/40 px-4 py-3 shadow-sm"
      >
        <p class="mb-1 text-[10px] font-bold uppercase tracking-wide text-amber-800/90">
          Comment of member:
        </p>
        <p class="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{{ parsed.note }}</p>
      </div>

      <div
        v-if="hasAttachments"
        class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
      >
        <p class="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Supporting evidence attached (URL / file)
        </p>
        <ul class="flex flex-col gap-2">
          <li
            v-for="(att, aIdx) in parsed.attachments"
            :key="aIdx"
            class="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2"
          >
            <a
              :href="att.url"
              target="_blank"
              rel="noopener noreferrer"
              class="break-all text-xs font-semibold text-indigo-600 underline hover:text-indigo-800"
            >
              {{ att.name }}
            </a>
          </li>
        </ul>
      </div>
  </div>
</template>
