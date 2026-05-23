<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  buildScoringRulesPayload,
  extractRawInputFromApiTargetDescription,
  validateScoringRulesDsl,
} from '@/utils/kpiScoringRulesDsl'
import { assigneeTargetScaleService } from '@/services/shared/assignee-target-scale.service'
import type { KpiScoringRulesPayload } from '@/types/gm-strategic-kpi-edit'
import { getApiErrorMessage } from '@/utils/apiErrorMessage'
import ScoringRulesHelpTooltip from '@/components/kpi/ScoringRulesHelpTooltip.vue'

export interface PmAssigneeTargetScaleEditItem {
  id: string
  target?: string | null
  targetDescription?: string | null
}

const open = defineModel<boolean>({ default: false })

const props = defineProps<{
  item: PmAssigneeTargetScaleEditItem | null
}>()

const emit = defineEmits<{
  (e: 'saved', payload: { assignmentId: string; target: string; targetDescription: string }): void
}>()

const targetValue = ref('')
const scoringRules = ref('')
const saving = ref(false)
const error = ref('')

watch(
  () => [open.value, props.item] as const,
  ([isOpen, item]) => {
    if (!isOpen || !item) return
    error.value = ''
    targetValue.value = String(item.target ?? '').trim()
    scoringRules.value = extractRawInputFromApiTargetDescription(item.targetDescription ?? '')
  },
)

async function save() {
  const item = props.item
  if (!item?.id) return
  const tv = Number.parseFloat(String(targetValue.value).trim())
  if (!Number.isFinite(tv) || tv <= 0) {
    error.value = 'Target phải là số lớn hơn 0.'
    return
  }
  const descTrim = scoringRules.value.trim()
  if (!descTrim) {
    error.value = 'Nhập thang điểm (quy tắc chấm điểm).'
    return
  }
  const vr = validateScoringRulesDsl(scoringRules.value)
  if (!vr.ok) {
    error.value = vr.errors.join(' ')
    return
  }
  saving.value = true
  error.value = ''
  try {
    const updated = await assigneeTargetScaleService.update(item.id, {
      targetValue: tv,
      targetDescription: buildScoringRulesPayload(scoringRules.value) as KpiScoringRulesPayload,
    })
    if (!updated?.assignmentId) {
      error.value = 'Không lưu được thay đổi.'
      return
    }
    emit('saved', {
      assignmentId: item.id,
      target: String(updated.assignmentTargetValue ?? tv),
      targetDescription: String(updated.targetDescription ?? ''),
    })
    open.value = false
  } catch (e: unknown) {
    error.value = getApiErrorMessage(e, 'Không lưu được thay đổi.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/45 p-4"
        @click.self="open = false"
      >
        <div class="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
          <h3 class="text-sm font-bold text-slate-800">
            Sửa target &amp; thang điểm
          </h3>
          <p class="mt-1 text-[11px] text-slate-500">
            Chỉ áp dụng cho assignment KPI của bạn.
          </p>

          <div class="mt-4 space-y-3">
            <div>
              <label class="text-[10px] font-bold uppercase tracking-wide text-slate-500">Target</label>
              <input
                v-model="targetValue"
                type="number"
                min="0"
                step="any"
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <div class="mb-1 flex items-center gap-1">
                <label class="text-[10px] font-bold uppercase tracking-wide text-slate-500">Thang điểm</label>
                <ScoringRulesHelpTooltip />
              </div>
              <textarea
                v-model="scoringRules"
                rows="6"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                placeholder="Quy tắc chấm điểm (DSL)"
              />
            </div>
            <p v-if="error" class="text-[11px] font-semibold text-rose-600">{{ error }}</p>
          </div>

          <div class="mt-5 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
              :disabled="saving"
              @click="open = false"
            >
              Hủy
            </button>
            <button
              type="button"
              class="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              :disabled="saving"
              @click="save"
            >
              {{ saving ? 'Đang lưu…' : 'Lưu' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
