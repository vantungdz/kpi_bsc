<script setup lang="ts">
import { computed } from 'vue'
import type { KpiItem } from '@/types/kpi'
import {
  memberItemEvalStatus,
} from '@/utils/memberKpiHelpers'
import { useMemberKpiFormatters } from '@/composables/useMemberKpiFormatters'
import { extractRawInputFromApiTargetDescription } from '@/utils/kpiScoringRulesDsl'

type KpiCategorySection = { key: string; headerLabel: string; items: KpiItem[] }

const props = defineProps<{
  sections: KpiCategorySection[]
  promotionItemsFlat: KpiItem[]
  promotionWeightSum: number
  promotionSelfWeightedAvg: number | null
  promotionPmWeightedAvg: number | null
  isCurrentYear: boolean
  submitting: boolean
  canSubmit: boolean
  isSubmitDisabled: boolean
  submitLabel: string
}>()

const emit = defineEmits<{
  (e: 'open-evidence', item: KpiItem): void
  (e: 'open-feedback', item: KpiItem): void
  (e: 'submit'): void
}>()

const { formatKpiActualResult } = useMemberKpiFormatters()

function rowAlertClass(item: KpiItem): string {
  if (Number(item.statusCode ?? 0) === 407) return 'bg-violet-100/70 ring-1 ring-inset ring-violet-200'
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
  const status = Number(item.statusCode ?? 0)
  return status === 404 || status === 407
}

function formatTargetDisplay(item: KpiItem): string {
  const raw = item.assignmentTargetValue ?? item.kpiTemplateTargetValue
  if (raw == null) return '-'
  const unit = String(item.unitName ?? '').trim()
  return unit ? `${raw} ${unit}` : String(raw)
}

function targetDataTooltip(item: KpiItem): string {
  const rawRules =
    extractRawInputFromApiTargetDescription(item.targetDescription ?? '')
    || extractRawInputFromApiTargetDescription(item.target ?? '')
  if (rawRules) return `Quy tắc chấm điểm:\n${rawRules}`
  const fallback = String(item.target ?? '').trim()
  return fallback || formatTargetDisplay(item)
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
</script>

<template>
  <div
    class="flex flex-col gap-1 border-b border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
  >
    <h3 class="flex items-center gap-2 text-lg font-bold text-slate-800">
      <i class="fas fa-arrow-trend-up text-slate-400" />
      Chi Tiết Bảng KPI Promotion
    </h3>

  </div>

  <div v-if="promotionItemsFlat.length === 0" class="px-5 py-16 text-center text-sm text-slate-500">
    <i class="fas fa-medal mb-3 text-3xl text-violet-200" />
    <p class="font-medium text-slate-600">Chưa có KPI Promotion</p>
    <p class="mt-1 mx-auto max-w-md text-xs text-slate-400">
      Khi PM/Leader giao mục tiêu thăng tiến (Direct), các dòng sẽ hiển thị tại đây.
    </p>
  </div>

  <div v-else class="overflow-x-auto">
    <table class="w-full text-left">
      <thead class="border-b border-slate-200 bg-white">
        <tr class="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <th class="w-12 px-5 py-4 text-center">STT</th>
          <th class="min-w-[200px] px-5 py-4">Hạng Mục (Objectives)</th>
          <th class="min-w-[10rem] px-5 py-4 text-center">Trạng thái KPI</th>
          <th class="px-5 py-4">Chỉ Tiêu (Target)</th>
          <th class="w-24 px-5 py-4 text-center">Trọng số (W)</th>
          <th class="min-w-[8rem] px-5 py-4 text-center">
            <span class="inline-flex items-center gap-1">
              Actual Result
            </span>
          </th>
          <th class="w-28 bg-sky-50/90 px-5 py-4 text-center text-slate-600">Self Score</th>
          <th class="w-28 px-5 py-4 text-center">Final Score</th>
          <th class="w-28 px-5 py-4 text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <template v-for="section in sections" :key="'p-' + section.key">
          <tr class="bg-amber-50/80 border-y border-amber-100">
            <td colspan="9" class="py-2 px-5 text-xs font-bold text-amber-800 uppercase tracking-wider">
              {{ section.headerLabel }}
            </td>
          </tr>
          <tr
            v-for="(item, idx) in section.items"
            :key="item.id"
            class="group transition-colors hover:bg-slate-50"
            :class="rowAlertClass(item)"
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
                Thực tế (khác sheet): {{ item.certificateOutcomeNote }}
              </p>
            </td>

            <td class="max-w-[11rem] px-3 py-4 text-center align-top">
              <span
                class="inline-flex max-w-full flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-[10px] font-semibold leading-tight"
                :class="statusBadgeClass(item.statusCode)"
                :title="item.assignmentStatusName ?? ''"
              >
                <span class="line-clamp-3 text-center" :class="statusPhaseClass(item.statusCode)">{{ item.assignmentStatusName ?? '—' }}</span>
              </span>
            </td>

            <td class="max-w-xs px-5 py-4 align-middle">
              <div class="inline-flex items-center gap-1">
                <p class="text-sm font-medium text-slate-700">
                  {{ formatTargetDisplay(item) }}
                </p>
                <span
                  class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-500 cursor-help"
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
              <span class="text-sm font-bold text-slate-800">{{ item.selfScore ?? '-' }}</span>
            </td>

            <td class="px-5 py-4 text-center align-middle">
              <span class="text-sm font-medium text-slate-400">
                {{ item.pmScore !== null ? item.pmScore : '-' }}
              </span>
            </td>

            <td class="px-5 py-4 text-right align-middle">
              <div class="flex items-center justify-end gap-2">
                <button
                  type="button"
                  class="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-indigo-600"
                  :class="!canOpenEvidence(item) ? 'pointer-events-none opacity-50' : ''"
                  :title="item.evidenceTooltip ?? ''"
                  :disabled="!canOpenEvidence(item)"
                  @click="emit('open-evidence', item)"
                >
                  <i class="fas fa-eye text-xs" />
                  Detail
                </button>
                <button
                  type="button"
                  class="flex h-8 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 text-[10px] font-bold text-violet-700 shadow-sm transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-45"
                  :disabled="!canSendFeedback(item)"
                  title="Mở KPI này để nhập và gửi feedback riêng"
                  @click="emit('open-feedback', item)"
                >
                  <i class="fas fa-message text-[10px]" />
                </button>
              </div>
            </td>
          </tr>
        </template>
      </tbody>

      <tfoot class="border-t-2 border-slate-200 bg-slate-100/80 font-bold">
        <tr>
          <td colspan="4" class="px-5 py-4 text-right text-xs uppercase tracking-wider text-slate-700">
            Tổng trọng số (Promotion W):
          </td>
          <td class="px-5 py-4 text-center">
            <span class="text-sm text-slate-800">{{ promotionWeightSum.toFixed(1) }}</span>
            <span class="ml-1 text-xs font-medium text-slate-500">pts</span>
          </td>
          <td class="px-5 py-4 text-center text-xs font-medium text-slate-400">-</td>
          <td class="bg-sky-50/50 px-5 py-4 text-center text-sm text-slate-600">
            {{ totalPromotionSelfWeightedScore > 0 ? totalPromotionSelfWeightedScore.toFixed(2) : '-' }}
          </td>
          <td class="px-5 py-4 text-center text-sm text-slate-600">
            {{ totalPromotionPmWeightedScore > 0 ? totalPromotionPmWeightedScore.toFixed(2) : '-' }}
          </td>
          <td class="px-5 py-4" />
        </tr>
        <tr class="bg-violet-50/50 border-t border-slate-200">
          <td colspan="4" class="px-5 py-4 text-right text-xs uppercase tracking-wider text-violet-800">
            Điểm trung bình (Average score):
          </td>
          <td class="px-5 py-4" />
          <td class="px-5 py-4 text-center text-xs font-medium text-slate-400">-</td>
          <td class="bg-sky-50/50 px-5 py-4 text-center text-sm text-slate-700">
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

    <!-- Footer / Submit -->
    <div class="bg-slate-50 p-4 border-t border-slate-200 flex justify-center gap-3">
      <template v-if="isCurrentYear">
        <button
          v-if="canSubmit"
          type="button"
          :disabled="isSubmitDisabled"
          class="px-4 py-2 bg-violet-700 border border-transparent rounded-lg text-sm font-semibold text-white shadow-sm hover:bg-violet-800 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          @click="emit('submit')"
        >
          <i v-if="submitting" class="fas fa-spinner fa-spin text-xs" />
          <i v-else class="fas fa-arrow-trend-up text-xs" />
          {{ submitting ? 'Đang xử lý...' : submitLabel }}
        </button>
      </template>
      <div v-else class="text-sm text-slate-500 font-medium">
        Dữ liệu năm này chỉ để xem
      </div>
    </div>
  </div>
</template>
