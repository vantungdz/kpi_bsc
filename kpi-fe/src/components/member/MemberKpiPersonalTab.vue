<script setup lang="ts">
import { computed } from 'vue'
import type { KpiItem } from '@/types/kpi'
import {
  memberItemEvalStatus,
} from '@/utils/memberKpiHelpers'
import { useMemberKpiFormatters } from '@/composables/useMemberKpiFormatters'
import { extractRawInputFromApiTargetDescription } from '@/utils/kpiScoringRulesDsl'
import { formatTargetDisplayForMemeber } from '@/utils/strategicKpiTypeCodes'

type KpiCategorySection = { key: string; headerLabel: string; items: KpiItem[] }

const props = defineProps<{
  sections: KpiCategorySection[]
  personalSelfWeightedAvg: number | null
  isCurrentYear: boolean
  employeeComment: string
  supervisorComment: string
  employeeCommentReadonly: boolean
  submitting: boolean
  canSubmit: boolean
  isSubmitDisabled: boolean
  submitLabel: string
}>()

const emit = defineEmits<{
  (e: 'open-evidence', item: KpiItem): void
  (e: 'open-edit-self-created', item: KpiItem): void
  (e: 'open-feedback', item: KpiItem): void
  (e: 'delete-self-created', item: KpiItem): void
  (e: 'update-employee-comment', value: string): void
  (e: 'submit'): void
}>()

const { formatKpiActualResult } = useMemberKpiFormatters()

function parseCodeSortValue(code: unknown): number | null {
  const text = String(code ?? '').trim()
  if (!text) return null
  const match = text.match(/\d+/)
  if (!match) return null
  const value = Number(match[0])
  return Number.isFinite(value) ? value : null
}

function sortItemsForDisplay<T extends { code?: unknown; name?: unknown }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aCode = parseCodeSortValue(a.code)
    const bCode = parseCodeSortValue(b.code)
    if (aCode != null && bCode != null && aCode !== bCode) return aCode - bCode
    if (aCode != null && bCode == null) return -1
    if (aCode == null && bCode != null) return 1

    const aCodeText = String(a.code ?? '').trim().toLowerCase()
    const bCodeText = String(b.code ?? '').trim().toLowerCase()
    if (aCodeText !== bCodeText) return aCodeText.localeCompare(bCodeText, 'vi')

    return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'vi')
  })
}

function rowAlertClass(item: KpiItem): string {
  if (Number(item.statusCode ?? 0) === 407) return 'bg-violet-100/70 ring-1 ring-inset ring-violet-200'
  if (Number(item.statusCode ?? 0) === 406) return 'bg-rose-50/60'
  const s = memberItemEvalStatus(item)
  if (s === 'overdue') return 'bg-rose-50/55'
  if (s === 'revision') return 'bg-orange-50/50'
  if (s === 'pending_approval') return 'bg-sky-50/45'
  if (s === 'approved') return 'bg-emerald-50/40'
  if (s === 'feedback') return 'bg-violet-100/70 ring-1 ring-inset ring-violet-200'
  return ''
}

function statusPhaseClass(code: number | null | undefined): string {
  if ([501, 502, 601, 602].includes(Number(code))) return 'text-sky-700'
  if (Number(code) === 407) return 'text-violet-700'
  if (Number(code) === 406) return 'text-orange-700'
  if ([503, 603].includes(Number(code))) return 'text-emerald-700'
  if ([402, 403, 404, 405].includes(Number(code))) return 'text-slate-700'
  return 'text-slate-600'
}

function statusBadgeClass(code: number | null | undefined): string {
  if ([501, 502, 601, 602].includes(Number(code))) return 'border-sky-200 bg-sky-50'
  if (Number(code) === 407) return 'border-violet-200 bg-violet-50'
  if (Number(code) === 406) return 'border-orange-200 bg-orange-50'
  if ([503, 603].includes(Number(code))) return 'border-emerald-200 bg-emerald-50'
  if ([402, 403, 404, 405].includes(Number(code))) return 'border-slate-200 bg-slate-50'
  return 'border-slate-200 bg-slate-50'
}

function canOpenEvidence(item: KpiItem): boolean {
  const status = Number(item.statusCode ?? 0)
  return item.canViewEvidence === true || status >= 404
}

function canSendFeedback(item: KpiItem): boolean {
  if (item.createdByCurrentUser === true) return false
  const status = Number(item.statusCode ?? 0)
  return status === 404 || status === 407
}

function canDeleteSelfCreatedVisible(item: KpiItem): boolean {
  if (!props.isCurrentYear) return false
  const status = Number(item.statusCode ?? 0)
  return item.createdByCurrentUser === true && (status === 402 || status === 404 || status === 406)
}

function canDeleteSelfCreatedEnabled(item: KpiItem): boolean {
  const status = Number(item.statusCode ?? 0)
  // 402: đã submit target_setup, chờ PM duyệt -> chỉ hiển thị disabled
  return status === 404 || status === 406
}

function shouldOpenSelfCreatedEditForm(item: KpiItem): boolean {
  const status = Number(item.statusCode ?? 0)
  return (
    item.createdByCurrentUser === true
    && (status === 404 || status === 406)
    && String(item.kpiInformationId ?? '').trim().length > 0
  )
}

function sourceRowClass(item: KpiItem): string {
  if (item.createdByCurrentUser === true) return 'bg-fuchsia-50 hover:bg-fuchsia-100'
  const role = String(item.createdByRoleCode ?? '').trim().toUpperCase()
  if (role === 'GM') return 'bg-amber-50 hover:bg-amber-100'
  if (role === 'PM') return 'bg-blue-50 hover:bg-sky-100'
  return ''
}

function rowClass(item: KpiItem): string {
  const source = sourceRowClass(item)
  if (source) return source
  const alert = rowAlertClass(item)
  if (alert) return alert
  return 'hover:bg-slate-50'
}

function scoreColorClass(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(Number(score))) return 'text-slate-400'
  const v = Number(score)
  if (v <= 2) return 'text-rose-600'
  if (v < 4) return 'text-amber-600'
  return 'text-emerald-600'
}

function finalScoreTooltip(item: KpiItem): string | undefined {
  if (item.pmScore == null || item.selfScore == null) return undefined
  if (Number(item.pmScore) === Number(item.selfScore)) return undefined
  const gm = String(item.gmComment ?? '').trim()
  if (!gm) return undefined
  return `${gm}`
}

function statusTooltip(item: KpiItem): string {
  const status = Number(item.statusCode ?? 0)
  const reason = String(item.updateReason ?? item.feedbackComment ?? '').trim()
  if (status === 406 && reason) return `Rejection reason:\n${reason}`
  return item.assignmentStatusName ?? ''
}

function hasRejectedReason(item: KpiItem): boolean {
  const status = Number(item.statusCode ?? 0)
  const reason = String(item.updateReason ?? item.feedbackComment ?? '').trim()
  return status === 406 && reason.length > 0
}

// function formatTargetDisplay(item: KpiItem): string {
//   const raw = item.assignmentTargetValue ?? item.kpiTemplateTargetValue
//   if (raw == null) return '-'
//   const unit = String(item.unitName ?? '').trim()
//   return unit ? `${raw} ${unit}` : String(raw)
// }

function targetDataTooltip(item: KpiItem): string {
  const rawRules =
    extractRawInputFromApiTargetDescription(item.targetDescription ?? '')
    || extractRawInputFromApiTargetDescription(item.target ?? '')
  if (rawRules) return `Scoring rules:\n${rawRules}`
  const fallback = String(item.target ?? '').trim()
  return fallback || formatTargetDisplayForMemeber(item)
}

// ── Tfoot computed values ─────────────────────────────────────────────────────
const allItems = computed(() => props.sections.flatMap(s => s.items))
const hasPersonalAssignments = computed(() => allItems.value.length > 0)
const sortedSections = computed(() =>
  props.sections.map(section => ({
    ...section,
    items: sortItemsForDisplay(section.items ?? []),
  })),
)

/** Tổng trọng số của tất cả KPI */
const totalWeight = computed(() =>
  allItems.value.reduce((sum, i) => sum + i.weight, 0),
)

/** Tổng (selfScore × weight) cho các KPI đã có điểm tự đánh giá */
const totalSelfWeightedScore = computed(() =>
  allItems.value.reduce(
    (sum, i) => (i.selfScore !== null ? sum + (i.selfScore ?? 0) * i.weight : sum),
    0,
  ),
)

/** Tổng (pmScore × weight) cho các KPI đã có điểm PM */
const totalPmWeightedScore = computed(() =>
  allItems.value.reduce(
    (sum, i) => (i.pmScore !== null ? sum + (i.pmScore ?? 0) * i.weight : sum),
    0,
  ),
)

/** Điểm trung bình cuối cùng (PM) có trọng số */
const pmWeightedAvg = computed((): number | null => {
  const rows = allItems.value.filter(i => i.pmScore !== null)
  if (!rows.length) return null
  let num = 0
  let den = 0
  for (const i of rows) {
    num += (i.pmScore ?? 0) * i.weight
    den += i.weight
  }
  return den ? num / den : null
})
</script>

<template>
  <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
    <h3 class="flex items-center gap-2 text-lg font-bold text-slate-800">
      <i class="fas fa-list-alt text-slate-400" />
      Personal KPI Details
    </h3>
  </div>

  <div v-if="!hasPersonalAssignments" class="px-5 py-16 text-center text-sm text-slate-500">
    <i class="fas fa-bullseye mb-3 text-3xl text-slate-200" />
    <p class="font-medium text-slate-600">No Personal KPI Yet</p>
    <p class="mt-1 mx-auto max-w-md text-xs text-slate-400">
      When PM/Leader assigns personal goals or you create a new KPI, items will appear here.
    </p>
  </div>

  <div v-else class="overflow-x-auto">
    <table class="w-full text-left">
      <thead class="border-b border-slate-200 bg-slate-200">
        <tr class="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <th class="w-12 px-5 py-4 text-center">#</th>
          <th class="min-w-[200px] px-5 py-4">Objectives</th>
          <th class="min-w-[10rem] px-5 py-4 text-center">KPI Status</th>
          <th class="px-5 py-4">Target</th>
          <th class="w-24 px-5 py-4 text-center">Weight (W)</th>
          <th class="min-w-[8rem] px-5 py-4 text-center">
            <span class="inline-flex items-center gap-1">
              Actual Result
            </span>
          </th>
          <th class="w-28 px-5 py-4 text-center ">Self Score</th>
          <th class="w-28 px-5 py-4 text-center">Final Score</th>
          <th class="w-28 px-5 py-4 text-right">Actions</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <template v-for="section in sortedSections" :key="section.key">
          <tr class="border-y border-slate-200 bg-slate-50">
            <td colspan="9" class="py-2 px-5 text-xs font-bold text-slate-800 uppercase tracking-wider">
              {{ section.headerLabel }}
            </td>
          </tr>
          <tr
            v-for="(item, idx) in section.items"
            :key="item.id"
            class="group transition-colors"
            :class="rowClass(item)"
          >
            <td class="py-4 px-5 text-center text-sm font-semibold text-slate-400">{{ idx + 1 }}</td>

            <td class="py-4 px-5">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p class="text-sm font-bold text-slate-900">{{ item.code }} {{ item.name }}</p>
              </div>
            </td>

            <td class="max-w-[11rem] px-3 py-4 text-center align-top">
              <span
                class="inline-flex max-w-full flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-[10px] font-semibold leading-tight"
                :class="statusBadgeClass(item.statusCode)"
                :title="statusTooltip(item)"
              >
                <span class="line-clamp-3 text-center" :class="statusPhaseClass(item.statusCode)">{{ item.assignmentStatusName ?? '—' }}</span>
              </span>
              <span
                  v-if="hasRejectedReason(item)"
                  :title="statusTooltip(item)"
                  class="ml-1 mt-1 inline-flex max-w-full items-start gap-1 text-left text-[10px] font-medium text-orange-700 cursor-pointer hover:bg-orange-100 rounded"
                >
                  <span class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-orange-300 text-[10px] font-bold leading-none text-orange-700 cursor-pointer">
                    ?
                  </span>
               </span>
            </td>

            <td class="max-w-xs py-4 px-5 align-middle">
              <div class="inline-flex items-center gap-1">
                <p class="text-sm font-medium text-slate-700 text-center">
                  {{ formatTargetDisplayForMemeber(item) }}
                </p>
                <span
                  class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-500 cursor-help cursor-pointer"
                  :title="targetDataTooltip(item)"
                >
                  ?
                </span>
              </div>
            </td>

            <td class="py-4 px-5 text-center">
              <span
                class="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 font-bold text-sm rounded-md border border-slate-200"
              >
                {{ item.weight }}
              </span>
            </td>

            <td class="py-4 px-5 text-center align-middle">
              <span
                class="text-sm font-semibold leading-snug text-slate-700 inline-block"
              >
                {{ formatKpiActualResult(item) }}
              </span>
            </td>

            <td class="bg-sky-50/50 py-4 px-5 text-center align-middle">
              <span class="text-sm font-bold" :class="scoreColorClass(item.selfScore)">
                {{ item.selfScore ?? '-' }}
              </span>
            </td>

            <td class="py-4 px-5 text-center align-middle">
              <div class="inline-flex items-center gap-1 justify-center">
                <p 
                  class="font-medium text-sm display-inline-flex items-center gap-1"
                  :class="scoreColorClass(item.pmScore)">
                  {{ item.pmScore ?? '-' }}
                </p>
                <span
                  v-if="finalScoreTooltip(item)"
                  class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-500 cursor-help cursor-pointer hover:bg-sky-200 cursor-pointer"
                  :title="finalScoreTooltip(item)"
                >
                  ?
                </span>
              </div>
            </td>

            <td class="py-4 px-5 text-right align-middle">
              <div class="flex items-center justify-end gap-2">
                <button
                  type="button"
                  class="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-indigo-600 cursor-pointer"
                  :class="!canOpenEvidence(item) ? 'pointer-events-none opacity-50' : ''"
                  :title="item.evidenceTooltip ?? ''"
                  :disabled="!canOpenEvidence(item)"
                  @click="shouldOpenSelfCreatedEditForm(item) ? emit('open-edit-self-created', item) : emit('open-evidence', item)"
                >
                  <i class="fas fa-pen text-[10px]" />
                </button>
                <button
                  v-if="canSendFeedback(item)"
                  type="button"
                  class="flex h-8 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 text-[10px] font-bold text-violet-700 shadow-sm transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                  :disabled="!canSendFeedback(item)"
                  title="Open this KPI to enter and send feedback"
                  @click="emit('open-feedback', item)"
                >
                  <i class="fas fa-message text-[10px]" />
                </button>
                <button
                  v-if="item.createdByCurrentUser === true"
                  type="button"
                  class="flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-[10px] font-bold text-rose-700 shadow-sm transition-colors hover:bg-rose-100 cursor-pointer"
                  :class="!canDeleteSelfCreatedEnabled(item) ? 'cursor-not-allowed opacity-45 hover:bg-rose-50' : ''"
                  :disabled="!canDeleteSelfCreatedEnabled(item)"
                  :title="canDeleteSelfCreatedEnabled(item) ? 'Delete self-created KPI' : 'KPI already submitted, cannot be deleted'"
                  @click="emit('delete-self-created', item)"
                >
                  <i class="fas fa-trash text-[10px]" />
                </button>
              </div>
            </td>
          </tr>
        </template>
      </tbody>

      <tfoot class="bg-slate-100/80 border-t-2 border-slate-200 font-bold">
        <!-- Tổng cộng -->
        <tr>
          <td colspan="4" class="py-4 px-5 text-right text-slate-700 uppercase text-xs tracking-wider">
            Total (Total score):
          </td>
          <td class="py-4 px-5 text-center">
            <span class="text-sm text-slate-800">{{ totalWeight }}</span>
            <span class="text-xs text-slate-500 font-medium ml-1">pts</span>
          </td>
          <td class="py-4 px-5 text-center text-xs font-medium text-slate-400">-</td>
          <td class="bg-sky-50/50 py-4 px-5 text-center text-sm text-slate-500">
            {{ totalSelfWeightedScore > 0 ? totalSelfWeightedScore : '-' }}
          </td>
          <td class="py-4 px-5 text-center">
            <span class="text-sm text-slate-800">
              {{ totalPmWeightedScore > 0 ? totalPmWeightedScore : '-' }}
            </span>
          </td>
          <td class="py-4 px-5 text-center text-slate-500 text-sm"></td>
        </tr>
        <!-- Điểm trung bình -->
        <tr class="bg-violet-50/50 border-t border-slate-200">
          <td colspan="4" class="py-4 px-5 text-right text-violet-800 uppercase text-xs tracking-wider">
            Average score:
          </td>
          <td class="py-4 px-5"></td>
          <td class="py-4 px-5 text-center text-xs font-medium text-slate-400">-</td>
          <td class="bg-sky-50/50 py-4 px-5 text-center text-sm text-slate-500">
            <span class="text-sm text-violet-500">
              {{ personalSelfWeightedAvg !== null ? personalSelfWeightedAvg.toFixed(2) : '-' }}
            </span>
          </td>
          <td class="py-4 px-5 text-center bg-violet-100/80">
            <span class="text-lg text-violet-700 font-extrabold">
              {{ pmWeightedAvg !== null ? pmWeightedAvg.toFixed(2) : '-' }}
            </span>
          </td>
          <td class="py-4 px-5 text-center text-slate-500 text-sm"></td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- Comments section -->
  <div v-if="hasPersonalAssignments" class="p-6 border-t border-slate-200 bg-slate-50/30">
    <h4 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
      <i class="fas fa-comments text-blue-600" />
      Comment of employee and supervisor
    </h4>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            Employee's Comment
          </label>
          <textarea
            class="w-full h-24 p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none resize-none shadow-sm"
            :class="{ 'bg-slate-100 text-slate-500': employeeCommentReadonly }"
            placeholder="Enter your comment..."
            :readonly="employeeCommentReadonly"
            :value="employeeComment"
            @input="emit('update-employee-comment', String(($event.target as HTMLTextAreaElement).value ?? ''))"
          />
        </div>
      </div>
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            Supervisor Comment
          </label>
          <textarea
            class="w-full h-24 p-3 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 outline-none resize-none"
            placeholder="Supervisor will enter their comment here..."
            :value="supervisorComment"
            readonly
          />
        </div>
      </div>
    </div>
  </div>

  <!-- Footer / Submit -->
  <div v-if="hasPersonalAssignments" class="bg-slate-50 p-4 border-t border-slate-200 flex justify-center gap-3">
    <template v-if="isCurrentYear">
      <button
        v-if="canSubmit"
        type="button"
        :disabled="isSubmitDisabled"
        class="px-4 py-2 bg-slate-900 border border-transparent rounded-lg text-sm font-semibold text-white shadow-sm hover:bg-slate-800 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        @click="emit('submit')"
      >
        <i v-if="submitting" class="fas fa-spinner fa-spin text-xs" />
        <i v-else class="fas fa-paper-plane text-xs" />
        {{ submitting ? 'Processing...' : submitLabel }}
      </button>
    </template>
    <div v-else class="text-sm text-slate-500 font-medium">
      This year's data is read-only
    </div>
  </div>
</template>
