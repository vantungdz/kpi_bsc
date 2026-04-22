<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

export interface CreateIndividualKpiPayload {
  perspective: string
  kpiName: string
  description: string
  unit: string
  weight: number
  cycleYear: number
  calculationMethodPersisted: string
  /** Mô tả ngắn cách tính — hiển thị phụ trong bảng */
  calculationSummary: string
}

const open = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    cycleId: string | number
  }>(),
  {
    cycleId: () => new Date().getFullYear(),
  },
)

const emit = defineEmits<{
  saved: [payload: CreateIndividualKpiPayload]
}>()

const BSC_OPTIONS = [
  { value: 'financial', label: '💰 Financial' },
  { value: 'customer', label: '👥 Customer' },
  { value: 'internal', label: '⚙️ Internal Process' },
  { value: 'learning', label: '🎓 Learning & Growth' },
] as const

const UNIT_OPTIONS = [
  { value: 'MM', label: 'MM' },
  { value: 'POINT', label: 'POINT' },
  { value: 'PRODUCT', label: 'PRODUCT' },
  { value: 'PROJECT', label: 'PROJECT' },
  { value: 'CERTIFICATION', label: 'CERTIFICATION' },
  { value: 'ARTICLE', label: 'ARTICLE' },
  { value: 'PERSON', label: 'PERSON' },
] as const

const FORMULA_MEAN_RATIO = 'mean_by_ratio'
const FORMULA_MEAN_AGGREGATE = 'mean_by_aggregate'

interface FormulaDef {
  value: string
  label: string
  expression: string
}

const KPI_CALCULATION_FORMULAS: FormulaDef[] = [
  {
    value: FORMULA_MEAN_RATIO,
    label: 'Trung bình — theo tỉ lệ',
    expression: 'Chọn Actual/Plan hoặc Plan/Actual.',
  },
  {
    value: FORMULA_MEAN_AGGREGATE,
    label: 'Trung bình — gộp (AVG / SUM)',
    expression: 'Chọn AVG (trung bình) hoặc SUM (tổng).',
  },
  {
    value: 'manual_member_input',
    label: 'Tự nhập — theo số member nhập',
    expression: 'Dựa vào số mà member tự nhập để tính; không áp dụng công thức Plan/Actual cố định.',
  },
]

const DEFAULT_CALCULATION_METHOD = FORMULA_MEAN_RATIO

type MeanRatioKind = 'actual_plan' | 'plan_actual'
type MeanAggregateKind = 'average' | 'sum'

const perspective = ref<string>('internal')
const kpiName = ref('')
const description = ref('')
const unit = ref<string>('MM')
const weightInput = ref<string>('')
const calculationMethod = ref<string>(DEFAULT_CALCULATION_METHOD)
const meanRatioKind = ref<MeanRatioKind>('actual_plan')
const meanAggregateKind = ref<MeanAggregateKind>('average')

const cycleYearNum = computed(() => {
  const n = Number.parseInt(String(props.cycleId).trim(), 10)
  return Number.isFinite(n) ? n : new Date().getFullYear()
})

const formulaOptions = computed((): FormulaDef[] => [...KPI_CALCULATION_FORMULAS])

const selectedFormulaExpression = computed(() => {
  if (calculationMethod.value === 'manual_member_input') {
    return (
      formulaOptions.value.find((f) => f.value === 'manual_member_input')?.expression ??
      'Tự nhập theo số member.'
    )
  }
  if (calculationMethod.value === FORMULA_MEAN_RATIO) {
    return meanRatioKind.value === 'actual_plan'
      ? 'Theo tỉ lệ Actual / Plan.'
      : 'Theo tỉ lệ Plan / Actual.'
  }
  if (calculationMethod.value === FORMULA_MEAN_AGGREGATE) {
    return meanAggregateKind.value === 'sum'
      ? 'Gộp kiểu SUM (tổng).'
      : 'Gộp kiểu AVG (trung bình %).'
  }
  return 'Chọn công thức tính để xem biểu thức.'
})

function resolvePersistedCalculationMethod(): string {
  if (calculationMethod.value === 'manual_member_input') return 'manual_member_input'
  if (calculationMethod.value === FORMULA_MEAN_RATIO) {
    return meanRatioKind.value === 'actual_plan' ? 'mean_actual_plan' : 'mean_plan_actual'
  }
  if (calculationMethod.value === FORMULA_MEAN_AGGREGATE) {
    return meanAggregateKind.value === 'sum' ? 'mean_plan_actual_sum' : 'mean_plan_actual_pct'
  }
  return 'manual_member_input'
}

function calculationSummaryLabel(): string {
  const f = formulaOptions.value.find((x) => x.value === calculationMethod.value)
  const base = f?.label ?? calculationMethod.value
  if (calculationMethod.value === FORMULA_MEAN_RATIO) {
    return `${base} (${meanRatioKind.value === 'actual_plan' ? 'Actual/Plan' : 'Plan/Actual'})`
  }
  if (calculationMethod.value === FORMULA_MEAN_AGGREGATE) {
    return `${base} (${meanAggregateKind.value === 'average' ? 'AVG' : 'SUM'})`
  }
  return base
}

const saving = ref(false)
const formErrors = ref<Record<string, string>>({})
const errorBannerRef = ref<HTMLElement | null>(null)

function clearFormErrors() {
  formErrors.value = {}
}

function resetForm() {
  perspective.value = 'internal'
  kpiName.value = ''
  description.value = ''
  unit.value = 'MM'
  weightInput.value = ''
  calculationMethod.value = DEFAULT_CALCULATION_METHOD
  meanRatioKind.value = 'actual_plan'
  meanAggregateKind.value = 'average'
  clearFormErrors()
}

watch(open, (v) => {
  if (v) resetForm()
})

watch(
  () => props.cycleId,
  () => {
    if (open.value) resetForm()
  },
)

function close() {
  open.value = false
}

function validateForm(): boolean {
  clearFormErrors()
  const err: Record<string, string> = {}

  if (!kpiName.value.trim()) {
    err.kpiName = 'Vui lòng nhập tên KPI.'
  }

  const wStr = String(weightInput.value).trim()
  const wNum = Number.parseFloat(wStr)
  if (!wStr) {
    err.weightInput = 'Nhập trọng số (W).'
  } else if (!Number.isFinite(wNum) || wNum <= 0 || wNum > 100) {
    err.weightInput = 'Trọng số phải lớn hơn 0 và tối đa 100.'
  }

  if (!KPI_CALCULATION_FORMULAS.some((f) => f.value === calculationMethod.value)) {
    err.calculationMethod = 'Chọn phân loại cách tính (công thức).'
  }

  formErrors.value = err
  return Object.keys(err).length === 0
}

async function save() {
  if (!validateForm()) {
    await nextTick()
    errorBannerRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    return
  }

  saving.value = true
  const wNum = Number.parseFloat(String(weightInput.value).trim())
  const payload: CreateIndividualKpiPayload = {
    perspective: perspective.value,
    kpiName: kpiName.value.trim(),
    description: description.value.trim(),
    unit: unit.value,
    weight: wNum,
    cycleYear: cycleYearNum.value,
    calculationMethodPersisted: resolvePersistedCalculationMethod(),
    calculationSummary: calculationSummaryLabel(),
  }

  await new Promise((r) => setTimeout(r, 320))
  saving.value = false
  emit('saved', payload)
  open.value = false
}
</script>

<template>
  <Teleport to="body">
    <Transition name="ind-kpi-drawer">
      <div
        v-if="open"
        class="fixed inset-0 z-[100]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ind-create-kpi-title"
      >
        <div
          class="ind-kpi-drawer-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
          @click="close"
        />

        <div
          class="ind-kpi-drawer-panel absolute bottom-0 right-0 top-0 flex w-full max-w-full flex-col border-l border-slate-200 bg-slate-50 shadow-2xl md:max-w-[700px] lg:max-w-[800px]"
        >
          <div class="z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 id="ind-create-kpi-title" class="flex items-center gap-2 text-lg font-bold text-slate-800">
                <span class="rounded-lg bg-blue-100 p-1.5 text-blue-700 shadow-sm">
                  <i class="fas fa-crosshairs text-sm" aria-hidden="true" />
                </span>
                Tạo KPI
              </h2>
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
              v-if="Object.keys(formErrors).length > 0"
              id="ind-create-kpi-errors"
              ref="errorBannerRef"
              class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900 shadow-sm"
              role="alert"
            >
              <p class="mb-2 flex items-center gap-2 font-bold">
                <i class="fas fa-circle-exclamation text-rose-600" aria-hidden="true" />
                Vui lòng sửa các lỗi sau trước khi tạo KPI.
              </p>
              <ul class="list-inside list-disc space-y-0.5 text-[11px] font-semibold text-rose-800">
                <li v-for="(msg, key) in formErrors" :key="key">{{ msg }}</li>
              </ul>
            </div>

            <div class="ind-kpi-section-card rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
                      Perspective (BSC) <span class="text-rose-500">*</span>
                    </label>
                    <div class="relative">
                      <select
                        v-model="perspective"
                        class="input-required w-full cursor-pointer appearance-none rounded-md py-2 pl-3 pr-8 text-xs font-bold text-slate-800 outline-none transition-all"
                      >
                        <option v-for="o in BSC_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                      </select>
                      <i
                        class="fas fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                  <div class="min-w-0 sm:flex-1">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      KPI Name <span class="text-rose-500">*</span>
                    </label>
                    <input
                      v-model="kpiName"
                      type="text"
                      placeholder="Ví dụ: Hoàn thành khóa đào tạo nội bộ"
                      class="input-required w-full rounded-md px-3 py-2 text-xs font-bold text-slate-800 outline-none transition-all"
                      :class="formErrors.kpiName ? '!border-rose-400 !bg-rose-50/50' : ''"
                    />
                    <p v-if="formErrors.kpiName" class="mt-1 text-[10px] font-semibold text-rose-600">
                      {{ formErrors.kpiName }}
                    </p>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-6">
                  <div class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Trọng số (W) <span class="text-rose-500">*</span>
                    </label>
                    <input
                      v-model="weightInput"
                      type="number"
                      placeholder="10"
                      min="0.1"
                      max="100"
                      step="0.1"
                      class="input-required min-h-[38px] w-full rounded-md py-2 pl-2.5 pr-3 text-xs font-bold text-slate-800 outline-none transition-all"
                      :class="formErrors.weightInput ? '!border-rose-400 !bg-rose-50/50' : ''"
                    />
                    <p v-if="formErrors.weightInput" class="mt-1 text-[10px] font-semibold text-rose-600">
                      {{ formErrors.weightInput }}
                    </p>
                  </div>
                  <div class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Unit <span class="text-rose-500">*</span>
                    </label>
                    <div class="relative">
                      <select
                        v-model="unit"
                        class="input-required min-h-[38px] w-full cursor-pointer appearance-none rounded-md py-2 pl-2.5 pr-7 text-xs font-bold text-slate-800 outline-none transition-all"
                      >
                        <option v-for="u in UNIT_OPTIONS" :key="u.value" :value="u.value">{{ u.label }}</option>
                      </select>
                      <i
                        class="fas fa-chevron-down pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>

                <p class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
                  Năm đánh giá KPI:
                  <span class="font-bold text-slate-800">{{ cycleYearNum }}</span>
                  (theo năm đang chọn trên dashboard)
                </p>

                <div>
                  <div class="mb-1.5 flex items-center gap-1.5">
                    <label class="block flex-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Phân loại cách tính <span class="text-rose-500">*</span>
                    </label>
                    <span
                      v-if="calculationMethod !== 'manual_member_input'"
                      class="inline-flex shrink-0 cursor-help text-slate-400 transition-colors hover:text-blue-600"
                      :title="selectedFormulaExpression"
                      tabindex="0"
                      role="note"
                      aria-label="Biểu thức công thức đang chọn"
                    >
                      <i class="fas fa-circle-question text-[12px]" aria-hidden="true" />
                    </span>
                  </div>
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
                    <div class="relative min-w-0 w-full sm:min-w-[22rem] sm:flex-[1.35]">
                      <select
                        v-model="calculationMethod"
                        class="input-required min-h-[38px] w-full appearance-none rounded-md py-2 pr-7 text-xs font-bold text-slate-800 outline-none transition-all"
                        :class="[
                          calculationMethod === 'manual_member_input' ? 'pl-2.5' : 'cursor-help pl-8',
                          formErrors.calculationMethod ? '!border-rose-400 !bg-rose-50/50' : '',
                        ]"
                        :title="
                          calculationMethod === 'manual_member_input' ? undefined : selectedFormulaExpression
                        "
                      >
                        <option
                          v-for="f in formulaOptions"
                          :key="f.value"
                          :value="f.value"
                          :title="f.expression"
                        >
                          {{ f.label }}
                        </option>
                      </select>
                      <i
                        v-if="calculationMethod !== 'manual_member_input'"
                        class="fas fa-calculator pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                        aria-hidden="true"
                      />
                      <i
                        class="fas fa-chevron-down pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                        aria-hidden="true"
                      />
                    </div>
                    <div
                      v-if="calculationMethod === 'mean_by_ratio'"
                      class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-slate-200/90 bg-slate-50/70 px-2.5 py-2"
                    >
                      <span class="text-[9px] font-bold uppercase tracking-wide text-slate-400">Tỉ lệ</span>
                      <label
                        class="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-700"
                      >
                        <input
                          v-model="meanRatioKind"
                          type="radio"
                          name="ind-kpi-mean-ratio"
                          value="actual_plan"
                          class="h-3.5 w-3.5 border-slate-300 text-slate-700 focus:ring-slate-400/40"
                        />
                        Actual/Plan
                      </label>
                      <label
                        class="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-700"
                      >
                        <input
                          v-model="meanRatioKind"
                          type="radio"
                          name="ind-kpi-mean-ratio"
                          value="plan_actual"
                          class="h-3.5 w-3.5 border-slate-300 text-slate-700 focus:ring-slate-400/40"
                        />
                        Plan/Actual
                      </label>
                    </div>
                    <div
                      v-else-if="calculationMethod === 'mean_by_aggregate'"
                      class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-slate-200/90 bg-slate-50/70 px-2.5 py-2"
                    >
                      <span class="text-[9px] font-bold uppercase tracking-wide text-slate-400">Gộp</span>
                      <label
                        class="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-700"
                      >
                        <input
                          v-model="meanAggregateKind"
                          type="radio"
                          name="ind-kpi-mean-agg"
                          value="average"
                          class="h-3.5 w-3.5 border-slate-300 text-slate-700 focus:ring-slate-400/40"
                        />
                        AVG
                      </label>
                      <label
                        class="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-700"
                      >
                        <input
                          v-model="meanAggregateKind"
                          type="radio"
                          name="ind-kpi-mean-agg"
                          value="sum"
                          class="h-3.5 w-3.5 border-slate-300 text-slate-700 focus:ring-slate-400/40"
                        />
                        SUM
                      </label>
                    </div>
                  </div>
                  <p v-if="formErrors.calculationMethod" class="mt-1 text-[10px] font-semibold text-rose-600">
                    {{ formErrors.calculationMethod }}
                  </p>
                </div>

                <div>
                  <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Description
                    <span class="text-[9px] font-normal normal-case text-slate-400">(Optional)</span>
                  </label>
                  <textarea
                    v-model="description"
                    rows="2"
                    placeholder="Giải thích ngắn gọn về cách đo lường..."
                    class="custom-scrollbar w-full resize-none rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="z-10 flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white p-5 shadow-sm">
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-5 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-100"
              @click="close"
            >
              Hủy
            </button>
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-lg bg-blue-600 px-6 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
              :disabled="saving"
              @click="save"
            >
              <i v-if="saving" class="fas fa-spinner fa-spin text-sm" aria-hidden="true" />
              <i v-else class="fas fa-save text-sm" aria-hidden="true" />
              {{ saving ? 'Đang lưu...' : 'Tạo KPI' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ind-kpi-drawer-enter-active,
.ind-kpi-drawer-leave-active {
  transition-duration: 0.28s;
}
.ind-kpi-drawer-enter-active .ind-kpi-drawer-backdrop,
.ind-kpi-drawer-leave-active .ind-kpi-drawer-backdrop {
  transition: opacity 0.28s ease;
}
.ind-kpi-drawer-enter-active .ind-kpi-drawer-panel,
.ind-kpi-drawer-leave-active .ind-kpi-drawer-panel {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.ind-kpi-drawer-enter-from .ind-kpi-drawer-backdrop,
.ind-kpi-drawer-leave-to .ind-kpi-drawer-backdrop {
  opacity: 0;
}
.ind-kpi-drawer-enter-to .ind-kpi-drawer-backdrop,
.ind-kpi-drawer-leave-from .ind-kpi-drawer-backdrop {
  opacity: 1;
}
.ind-kpi-drawer-enter-from .ind-kpi-drawer-panel,
.ind-kpi-drawer-leave-to .ind-kpi-drawer-panel {
  transform: translateX(100%);
}
.ind-kpi-drawer-enter-to .ind-kpi-drawer-panel,
.ind-kpi-drawer-leave-from .ind-kpi-drawer-panel {
  transform: translateX(0);
}

@media (prefers-reduced-motion: reduce) {
  .ind-kpi-drawer-enter-active,
  .ind-kpi-drawer-leave-active,
  .ind-kpi-drawer-enter-active .ind-kpi-drawer-backdrop,
  .ind-kpi-drawer-leave-active .ind-kpi-drawer-backdrop,
  .ind-kpi-drawer-enter-active .ind-kpi-drawer-panel,
  .ind-kpi-drawer-leave-active .ind-kpi-drawer-panel {
    transition-duration: 0.01ms !important;
  }
  .ind-kpi-drawer-enter-from .ind-kpi-drawer-panel,
  .ind-kpi-drawer-leave-to .ind-kpi-drawer-panel {
    transform: none;
  }
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

.ind-kpi-section-card {
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.ind-kpi-section-card:focus-within {
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
