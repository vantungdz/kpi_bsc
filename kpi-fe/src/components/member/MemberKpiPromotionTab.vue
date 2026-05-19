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
  promotionItemsFlat: KpiItem[]
  promotionWeightSum: number
  promotionSelfWeightedAvg: number | null
  promotionPmWeightedAvg: number | null
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
  if (role === 'PM') return 'bg-blue-50 hover:bg-blue-100'
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

const totalPromotionSelfWeightedScore = computed(() =>
  props.promotionItemsFlat.reduce(
    (sum, i) => (i.selfScore !== null ? sum + (i.selfScore ?? 0) * i.weight : sum),
    0,
  ),
)

const totalPromotionPmWeightedScore = computed(() =>
  props.promotionItemsFlat.reduce(
    (sum, i) => (i.pmScore !== null ? sum + (i.pmScore ?? 0) * i.weight : sum),
    0,
  ),
)

const hasPromotionAssignments = computed(() => props.promotionItemsFlat.length > 0)
</script>

<template>
  <div
    class="flex flex-col gap-1 border-b border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
  >
    <h3 class="flex items-center gap-2 text-lg font-bold text-slate-800">
      <i class="fas fa-arrow-trend-up text-slate-400" />
      Promotion KPI Details
    </h3>

  </div>

  <div v-if="promotionItemsFlat.length === 0" class="px-5 py-16 text-center text-sm text-slate-500">
    <i class="fas fa-medal mb-3 text-3xl text-violet-200" />
    <p class="font-medium text-slate-600">No Promotion KPI Yet</p>
    <p class="mt-1 mx-auto max-w-md text-xs text-slate-400">
      When PM/Leader assigns promotion goals (Direct), items will appear here.
    </p>
  </div>

  <div v-else>
    <div class="overflow-x-auto">
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
        <template v-for="section in sections" :key="'p-' + section.key">
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
            <td class="px-5 py-4 text-center text-sm font-semibold text-slate-400">{{ idx + 1 }}</td>

            <td class="px-5 py-4">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p class="text-sm font-bold text-slate-900">{{ item.code }} {{ item.name }}</p>
              </div>
              <p
                v-if="item.certificateOutcomeNote"
                class="mt-1.5 max-w-xs rounded border border-indigo-100 bg-indigo-50/90 px-2 py-1 text-[10px] font-medium leading-snug text-indigo-900 line-clamp-2"
                :title="item.certificateOutcomeNote"
              >
                <i class="fas fa-certificate mr-1 shrink-0 text-indigo-500" />
                Actual (differs from sheet): {{ item.certificateOutcomeNote }}
              </p>
            </td>

            <td class="max-w-[11rem] px-3 py-4 text-center align-top">
              <span
                class="inline-flex max-w-full flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-[10px] font-semibold leading-tight cursor-pointer"
                :class="statusBadgeClass(item.statusCode)"
                :title="statusTooltip(item)"
              >
                <span class="line-clamp-3 text-center cursor-pointer" :class="statusPhaseClass(item.statusCode)">{{ item.assignmentStatusName ?? '—' }}</span>
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

            <td class="max-w-xs px-5 py-4 align-middle">
              <div class="inline-flex items-center gap-1">
                <p class="text-sm font-medium text-slate-700">
                  {{ formatTargetDisplayForMemeber(item) }}
                </p>
                <span
                  class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-500 cursor-pointer"
                  :title="targetDataTooltip(item)"
                >
                  ?
                </span>
              </div>
            </td>

            <td class="px-5 py-4 text-center">
              <span
                class="inline-block rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-sm font-bold text-slate-700"
              >
                {{ item.weight.toFixed(1) }}
              </span>
            </td>

            <td class="px-5 py-4 text-center align-middle">
              <span
                class="inline-block text-xs font-semibold leading-snug text-slate-700"
              >
                {{ formatKpiActualResult(item) }}
              </span>
            </td>

            <td class="bg-sky-50/50 px-5 py-4 text-center align-middle">
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
                  class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-500 cursor-help cursor-pointer hover:bg-sky-200"
                  :title="finalScoreTooltip(item)"
                >
                  ?
                </span>
              </div>
            </td>

            <td class="px-5 py-4 text-right align-middle">
              <div class="flex items-center justify-end gap-2">
                <button
                  type="button"
                  class="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-indigo-600 cursor-pointer"
                  :class="!canOpenEvidence(item) ? 'pointer-events-none opacity-50' : ''"
                  :title="item.evidenceTooltip ?? ''"
                  :disabled="!canOpenEvidence(item)"
                  @click="shouldOpenSelfCreatedEditForm(item) ? emit('open-edit-self-created', item) : emit('open-evidence', item)"
                >
                  <i class="fas fa-pen text-xs" />
                </button>
                <button
                  v-if="canSendFeedback(item)"
                  type="button"
                  class="flex h-8 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 text-[10px] font-bold text-violet-700 shadow-sm transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-45"
                  :disabled="!canSendFeedback(item)"
                  title="Open this KPI to enter and send feedback"
                  @click="emit('open-feedback', item)"
                >
                  <i class="fas fa-message text-[10px]" />
                </button>
                <button
                  v-if="canDeleteSelfCreatedVisible(item)"
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

      <tfoot class="border-t-2 border-slate-200 bg-slate-100/80 font-bold">
        <tr>
          <td colspan="4" class="px-5 py-4 text-right text-xs uppercase tracking-wider text-slate-700">
            Total Promotion Weight (W):
          </td>
          <td class="px-5 py-4 text-center">
            <span class="text-sm text-slate-800">{{ promotionWeightSum.toFixed(1) }}</span>
            <span class="ml-1 text-xs font-medium text-slate-500">pts</span>
          </td>
          <td class="px-5 py-4 text-center text-xs font-medium text-slate-400">-</td>
          <td class="bg-sky-50/50 px-5 py-4 text-center text-sm text-slate-600">
            {{ totalPromotionSelfWeightedScore > 0 ? totalPromotionSelfWeightedScore : '-' }}
          </td>
          <td class="px-5 py-4 text-center text-sm text-slate-600">
            {{ totalPromotionPmWeightedScore > 0 ? totalPromotionPmWeightedScore : '-' }}
          </td>
          <td class="px-5 py-4" />
        </tr>
        <tr class="bg-violet-50/50 border-t border-slate-200">
          <td colspan="4" class="px-5 py-4 text-right text-xs uppercase tracking-wider text-violet-800">
            Average score:
          </td>
          <td class="px-5 py-4" />
          <td class="px-5 py-4 text-center text-xs font-medium text-slate-400">-</td>
          <td class="bg-sky-50/50 px-5 py-4 text-center text-sm text-violet-500">
            {{ promotionSelfWeightedAvg !== null ? promotionSelfWeightedAvg.toFixed(2) : '0.00' }}
          </td>
          <td class="bg-violet-100/80 px-5 py-4 text-center">
            <span class="text-lg font-extrabold text-violet-700">
              {{ promotionPmWeightedAvg !== null ? promotionPmWeightedAvg.toFixed(2) : '0.00' }}
            </span>
          </td>
          <td class="px-5 py-4" />
        </tr>
      </tfoot>
    </table>
    </div>

    <!-- Comments section -->
    <div v-if="hasPromotionAssignments" class="p-6 border-t border-slate-200 bg-slate-50/30">
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
    <div v-if="hasPromotionAssignments" class="bg-slate-50 p-4 border-t border-slate-200 flex justify-center gap-3">
      <template v-if="isCurrentYear">
        <button
          v-if="canSubmit"
          type="button"
          :disabled="isSubmitDisabled"
          class="px-4 py-2 bg-violet-700 border border-transparent rounded-lg text-sm font-semibold text-white shadow-sm hover:bg-violet-800 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          @click="emit('submit')"
        >
          <i v-if="submitting" class="fas fa-spinner fa-spin text-xs" />
          <i v-else class="fas fa-arrow-trend-up text-xs" />
          {{ submitting ? 'Processing...' : submitLabel }}
        </button>
      </template>
      <div v-else class="text-sm text-slate-500 font-medium">
        This year's data is read-only
      </div>
    </div>
  </div>
</template>
