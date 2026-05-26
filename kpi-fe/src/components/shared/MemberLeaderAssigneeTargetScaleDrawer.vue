<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  buildScoringRulesPayload,
  extractRawInputFromApiTargetDescription,
  validateScoringRulesDsl,
} from '@/utils/kpiScoringRulesDsl'
import { assigneeTargetScaleService } from '@/services/shared/assignee-target-scale.service'
import { gmKpiService } from '@/services/modules/kpi-gm.service'
import type { KpiScoringRulesPayload } from '@/types/gm-strategic-kpi-edit'
import { getApiErrorMessage } from '@/utils/apiErrorMessage'
import ScoringRulesHelpTooltip from '@/components/kpi/ScoringRulesHelpTooltip.vue'
import { useAutoScoringRulesFromTarget } from '@/composables/useAutoScoringRulesFromTarget'

export interface MemberLeaderAssigneeTargetScaleEditItem {
  id: string
  kpiInformationId?: string | null
  target?: string | null
  targetDescription?: string | null
  kpiName?: string | null
  categoryName?: string | null
  weight?: number | string | null
  unitName?: string | null
  calculationRuleCode?: number | null
  calculationTypeCode?: number | null
}

const open = defineModel<boolean>({ default: false })

const props = defineProps<{
  item: MemberLeaderAssigneeTargetScaleEditItem | null
}>()
const item = computed(() => props.item)

const emit = defineEmits<{
  (e: 'saved', payload: { assignmentId: string; target: string; targetDescription: string }): void
}>()

const targetValue = ref('')
const scoringRules = ref('')
const saving = ref(false)
const syncingRulesFromApi = ref(false)
const formError = ref('')
let hydrateRequestSeq = 0

const { onScoringRulesManualInput, resetAutoScoringRulesTracking, markCurrentScoringRulesAsAutoBaseline, pauseAutoSyncFromTarget } = useAutoScoringRulesFromTarget(
  targetValue,
  scoringRules,
)
const initialSnapshot = ref<{ target: number | null; scoringRules: string } | null>(null)

const calcRuleLabel = computed(() => {
  const code = Number(props.item?.calculationRuleCode ?? 0)
  if (code === 801) return 'Cộng dồn điểm của các KPI con'
  if (code === 803) return 'Nhập điểm thủ công dựa trên nhận xét đánh giá'
  if (code === 802) return 'Lấy trung bình cộng điểm các KPI con'
  return '—'
})

const calcTypeLabel = computed(() => {
  const code = Number(props.item?.calculationTypeCode ?? 0)
  if (code === 701) return 'Actual / Plan'
  if (code === 702) return 'Plan / Actual'
  return '—'
})

watch(
  () => [open.value, props.item] as const,
  ([isOpen, item]) => {
    if (!isOpen || !item) return
    const resumeAutoSync = pauseAutoSyncFromTarget()
    formError.value = ''
    resetAutoScoringRulesTracking()
    targetValue.value = String(item.target ?? '').trim()
    scoringRules.value = extractRawInputFromApiTargetDescription(item.targetDescription ?? '')
    void hydrateScoringRulesFromApi(item).finally(async () => {
      await nextTick()
      await nextTick()
      resumeAutoSync()
    })
  },
)

async function hydrateScoringRulesFromApi(row: MemberLeaderAssigneeTargetScaleEditItem) {
  const requestSeq = ++hydrateRequestSeq
  const kpiInformationId = String(row.kpiInformationId ?? '').trim()
  let finalRules = String(scoringRules.value ?? '').trim()

  if (kpiInformationId) {
    syncingRulesFromApi.value = true
    try {
      const latest = await gmKpiService.getStrategicKpiForEdit(kpiInformationId)
      if (requestSeq !== hydrateRequestSeq) return
      const latestRules = extractRawInputFromApiTargetDescription(latest?.targetDescription ?? '')
      if (latestRules.trim()) {
        finalRules = latestRules.trim()
        scoringRules.value = latestRules
      }
    } catch {
      // Fallback về dữ liệu hiện có trên row khi không lấy được detail API.
    } finally {
      if (requestSeq === hydrateRequestSeq) {
        syncingRulesFromApi.value = false
      }
    }
  } else {
    syncingRulesFromApi.value = false
  }

  if (requestSeq !== hydrateRequestSeq) return
  markCurrentScoringRulesAsAutoBaseline()
  initialSnapshot.value = {
    target: Number.isFinite(Number.parseFloat(String(targetValue.value).trim()))
      ? Number.parseFloat(String(targetValue.value).trim())
      : null,
    scoringRules: finalRules,
  }
}

function close() {
  if (saving.value) return
  open.value = false
}

const hasMeaningfulChanges = computed(() => {
  const initial = initialSnapshot.value
  if (!initial) return true
  const current = {
    target: Number.isFinite(Number.parseFloat(String(targetValue.value).trim()))
      ? Number.parseFloat(String(targetValue.value).trim())
      : null,
    scoringRules: String(scoringRules.value ?? '').trim(),
  }
  return JSON.stringify(current) !== JSON.stringify(initial)
})

async function save() {
  const item = props.item
  if (!item?.id) return
  if (!hasMeaningfulChanges.value) {
    formError.value = 'Bạn chưa thay đổi target hoặc quy tắc chấm điểm.'
    return
  }
  const tv = Number.parseFloat(String(targetValue.value).trim())
  if (!Number.isFinite(tv) || tv <= 0) {
    formError.value = 'Target phải là số lớn hơn 0.'
    return
  }
  const descTrim = scoringRules.value.trim()
  if (!descTrim) {
    formError.value = 'Nhập thang điểm (quy tắc chấm điểm).'
    return
  }
  const vr = validateScoringRulesDsl(scoringRules.value)
  if (!vr.ok) {
    formError.value = vr.errors.join(' ')
    return
  }

  saving.value = true
  formError.value = ''
  try {
    const updated = await assigneeTargetScaleService.update(item.id, {
      targetValue: tv,
      targetDescription: buildScoringRulesPayload(scoringRules.value) as KpiScoringRulesPayload,
    })
    if (!updated?.assignmentId) {
      formError.value = 'Không lưu được thay đổi.'
      return
    }
    emit('saved', {
      assignmentId: item.id,
      target: String(updated.assignmentTargetValue ?? tv),
      targetDescription: String(updated.targetDescription ?? ''),
    })
    open.value = false
  } catch (e: unknown) {
    formError.value = getApiErrorMessage(e, 'Không lưu được thay đổi.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="assignee-edit-drawer">
      <div
        v-if="open"
        class="fixed inset-0 z-[220]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-leader-assignee-edit-title"
      >
        <div
          class="assignee-edit-drawer-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
          @click="close"
        />

        <div
          class="assignee-edit-drawer-panel absolute bottom-0 right-0 top-0 flex w-full max-w-full flex-col border-l border-slate-200 bg-slate-50 shadow-2xl md:max-w-[700px] lg:max-w-[800px]"
        >
          <div class="z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2
                id="member-leader-assignee-edit-title"
                class="flex items-center gap-2 text-lg font-bold text-slate-800"
              >
                <span class="rounded-lg bg-blue-100 p-1.5 text-blue-700 shadow-sm">
                  <i class="fas fa-bullseye text-sm" aria-hidden="true" />
                </span>
                Chỉnh sửa KPI cá nhân
              </h2>
              <p class="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Chỉ chỉnh sửa Target và Quy tắc chấm điểm cho assignment của bạn
              </p>
            </div>
            <button
              type="button"
              class="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
              aria-label="Đóng"
              @click="close"
            >
              <i class="fas fa-times text-base" aria-hidden="true" />
            </button>
          </div>

          <div class="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-6">
            <div
              v-if="formError"
              class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900 shadow-sm"
              role="alert"
            >
              <p class="flex items-center gap-2 font-bold">
                <i class="fas fa-circle-exclamation text-rose-600" aria-hidden="true" />
                {{ formError }}
              </p>
            </div>

            <div class="gm-kpi-section-card rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <label class="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-800">
                <span class="rounded-lg bg-slate-100 p-1.5 text-indigo-600">
                  <i class="fas fa-file-lines text-sm" aria-hidden="true" />
                </span>
                Thông tin cơ bản &amp; phân loại
              </label>

              <div class="space-y-4">
                <div class="flex flex-col gap-3 sm:flex-row">
                  <div class="sm:w-1/3">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Nhóm KPI
                    </label>
                    <input
                      :value="String(item?.categoryName ?? '-')"
                      type="text"
                      disabled
                      class="w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600"
                    />
                  </div>
                  <div class="min-w-0 sm:flex-1">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      KPI Name
                    </label>
                    <input
                      :value="String(item?.kpiName ?? '-')"
                      type="text"
                      disabled
                      class="w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-x-6">
                  <div class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Target <span class="text-rose-500">*</span>
                    </label>
                    <input
                      v-model="targetValue"
                      type="number"
                      min="0"
                      step="any"
                      class="input-required min-h-[38px] w-full rounded-md px-2.5 py-2 text-xs font-bold text-slate-800 outline-none transition-all"
                    />
                  </div>
                  <div class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Trọng số (Weight)
                    </label>
                    <input
                      :value="String(item?.weight ?? '-')"
                      type="text"
                      disabled
                      class="w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600"
                    />
                  </div>
                  <div class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Unit
                    </label>
                    <input
                      :value="String(item?.unitName ?? '-')"
                      type="text"
                      disabled
                      class="w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Phân loại cách tính
                  </label>
                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      :value="calcRuleLabel"
                      type="text"
                      disabled
                      class="w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600"
                    />
                    <input
                      :value="calcTypeLabel"
                      type="text"
                      disabled
                      class="w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <div class="mb-1.5 flex items-center gap-1.5">
                    <label class="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Quy tắc chấm điểm <span class="text-rose-500">*</span>
                    </label>
                    <ScoringRulesHelpTooltip aria-label="Ví dụ cú pháp quy tắc chấm điểm" />
                  </div>
                  <textarea
                    v-model="scoringRules"
                    rows="6"
                    placeholder="Nhập target để tự sinh (5: >=1.2X, 4: [1.1X–1.2X), ...)"
                    @input="onScoringRulesManualInput"
                    class="custom-scrollbar input-required min-h-[7.5rem] w-full resize-y rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="z-10 flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white p-5 shadow-sm">
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-5 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-100"
              :disabled="saving || syncingRulesFromApi"
              @click="close"
            >
              Hủy
            </button>
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-lg bg-blue-600 px-6 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
              :disabled="saving || syncingRulesFromApi || !hasMeaningfulChanges"
              @click="save"
            >
              <i
                v-if="saving || syncingRulesFromApi"
                class="fas fa-spinner fa-spin text-sm"
                aria-hidden="true"
              />
              <i v-else class="fas fa-save text-sm" aria-hidden="true" />
              {{ saving ? 'Đang lưu...' : syncingRulesFromApi ? 'Đang đồng bộ...' : 'Lưu thay đổi' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.assignee-edit-drawer-enter-active,
.assignee-edit-drawer-leave-active {
  transition-duration: 0.28s;
}

.assignee-edit-drawer-enter-active .assignee-edit-drawer-backdrop,
.assignee-edit-drawer-leave-active .assignee-edit-drawer-backdrop {
  transition: opacity 0.28s ease;
}

.assignee-edit-drawer-enter-active .assignee-edit-drawer-panel,
.assignee-edit-drawer-leave-active .assignee-edit-drawer-panel {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.assignee-edit-drawer-enter-from .assignee-edit-drawer-backdrop,
.assignee-edit-drawer-leave-to .assignee-edit-drawer-backdrop {
  opacity: 0;
}

.assignee-edit-drawer-enter-to .assignee-edit-drawer-backdrop,
.assignee-edit-drawer-leave-from .assignee-edit-drawer-backdrop {
  opacity: 1;
}

.assignee-edit-drawer-enter-from .assignee-edit-drawer-panel,
.assignee-edit-drawer-leave-to .assignee-edit-drawer-panel {
  transform: translateX(100%);
}

.assignee-edit-drawer-enter-to .assignee-edit-drawer-panel,
.assignee-edit-drawer-leave-from .assignee-edit-drawer-panel {
  transform: translateX(0);
}

.input-required {
  background-color: rgba(239, 246, 255, 0.6);
  border: 1px solid #bfdbfe;
}

.input-required:focus,
.input-required:focus-within {
  background-color: #ffffff;
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.12);
}

.gm-kpi-section-card {
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.gm-kpi-section-card:focus-within {
  border-color: #bfdbfe;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.12);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background-color: #e2e8f0;
}
</style>
