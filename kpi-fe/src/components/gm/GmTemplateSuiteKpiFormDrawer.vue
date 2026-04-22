<script setup lang="ts">
/**
 * Drawer tạo một KPI cho **bộ template** — tách khỏi `GmCreateStrategicKpiModal` để logic GM workspace không phụ thuộc.
 * Giữ các trường giống form tạo Strategic KPI (custom): không tab, không sao chép, không phân bổ.
 */
import { ref, computed, watch, nextTick } from 'vue'
import { normalizeStrategicKpiKind } from '@/mocks/gm-kpi.mock'

const open = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    cycleId: string
    /** Khi có — mở drawer ở chế độ sửa, điền form từ snapshot đã lưu. */
    initialPayload?: Record<string, unknown> | null
  }>(),
  { cycleId: '2026', initialPayload: null },
)

const emit = defineEmits<{
  added: [payload: Record<string, unknown>]
}>()

type StrategicKpiType = 'cascading' | 'individual' | 'promotion'

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

interface FormulaDef {
  value: string
  label: string
  expression: string
}

const FORMULA_MEAN_RATIO = 'mean_by_ratio'
const FORMULA_MEAN_AGGREGATE = 'mean_by_aggregate'

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
const DEFAULT_EVALUATION_DIRECTION = 'maximize' as const

/** `Set<string>` để `.has()` nhận chuỗi từ payload mà không lỗi kiểu so với `Set<literal>`. */
const BSC_VALUE_SET = new Set<string>(BSC_OPTIONS.map((o) => o.value))
type BscPerspective = (typeof BSC_OPTIONS)[number]['value']

type MeanRatioKind = 'actual_plan' | 'plan_actual'
type MeanAggregateKind = 'average' | 'sum'

const evaluationYearOptions = computed(() => {
  const y0 = new Date().getFullYear()
  return [0, 1, 2].map((d) => {
    const y = y0 + d
    return { id: String(y), label: String(y) }
  })
})

const kpiType = ref<StrategicKpiType>('cascading')
const perspective = ref<BscPerspective>('internal')
const kpiName = ref('')
const description = ref('')
const targetValue = ref<string>('')
const unit = ref<string>('MM')
const weightPct = ref<string>('')
const calculationMethod = ref<string>(DEFAULT_CALCULATION_METHOD)
const meanRatioKind = ref<MeanRatioKind>('actual_plan')
const meanAggregateKind = ref<MeanAggregateKind>('average')
const isImportantKpi = ref(false)
const formCycleId = ref(String(props.cycleId))
const saving = ref(false)

const formErrors = ref<Record<string, string>>({})
const errorBannerRef = ref<HTMLElement | null>(null)

function clearFormErrors() {
  formErrors.value = {}
}

const cycleDateBounds = computed(() => {
  const m = /^(\d{4})$/.exec(String(formCycleId.value).trim())
  const year = m?.[1] ?? '2026'
  return { start: `${year}-01-01`, end: `${year}-12-31` }
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
    return meanAggregateKind.value === 'sum' ? 'Gộp kiểu SUM (tổng).' : 'Gộp kiểu AVG (trung bình %).'
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

function typeCardClass(t: StrategicKpiType) {
  const base =
    'relative cursor-pointer rounded-lg border p-3 text-left transition-all hover:border-blue-300'
  const selected = kpiType.value === t
  if (!selected) return `${base} border-slate-200 bg-white`
  if (t === 'promotion') return `${base} border-purple-500 bg-purple-50`
  return `${base} border-blue-500 bg-blue-50`
}

watch(kpiType, () => {
  if (kpiType.value !== 'cascading') targetValue.value = ''
  const allowed = new Set(KPI_CALCULATION_FORMULAS.map((f) => f.value))
  if (!allowed.has(calculationMethod.value)) {
    calculationMethod.value = DEFAULT_CALCULATION_METHOD
    meanRatioKind.value = 'actual_plan'
    meanAggregateKind.value = 'average'
  }
})

watch(
  () => props.cycleId,
  (id) => {
    const evalOpts = evaluationYearOptions.value
    const evalIds = new Set(evalOpts.map((c) => c.id))
    const header = String(id)
    if (evalIds.has(header)) formCycleId.value = header
  },
)

function resetForm() {
  kpiType.value = 'cascading'
  perspective.value = 'internal'
  kpiName.value = ''
  description.value = ''
  targetValue.value = ''
  unit.value = 'MM'
  weightPct.value = ''
  calculationMethod.value = DEFAULT_CALCULATION_METHOD
  meanRatioKind.value = 'actual_plan'
  meanAggregateKind.value = 'average'
  isImportantKpi.value = false
  const evalOpts = evaluationYearOptions.value
  const evalIds = new Set(evalOpts.map((c) => c.id))
  const header = String(props.cycleId)
  formCycleId.value = evalIds.has(header) ? header : String(evalOpts[0]?.id ?? new Date().getFullYear())
  clearFormErrors()
}

function hydrateCalculationFromPersisted(cm: string) {
  if (cm === 'manual_member_input') {
    calculationMethod.value = 'manual_member_input'
    return
  }
  if (cm === 'mean_plan_actual_pct' || cm === 'mean_plan_actual_sum') {
    calculationMethod.value = FORMULA_MEAN_AGGREGATE
    meanAggregateKind.value = cm === 'mean_plan_actual_sum' ? 'sum' : 'average'
    return
  }
  calculationMethod.value = FORMULA_MEAN_RATIO
  meanRatioKind.value = cm === 'mean_actual_plan' ? 'actual_plan' : 'plan_actual'
}

function hydrateFromPayload(p: Record<string, unknown>) {
  clearFormErrors()
  kpiType.value = normalizeStrategicKpiKind(p.kpiType)
  const pers = String(p.perspective ?? '').trim()
  perspective.value = BSC_VALUE_SET.has(pers) ? (pers as BscPerspective) : 'internal'
  kpiName.value = String(p.kpiName ?? '')
  description.value = String(p.description ?? '')
  targetValue.value = kpiType.value === 'cascading' ? String(p.targetValue ?? '') : ''
  unit.value = String(p.unit ?? 'MM') || 'MM'
  weightPct.value = String(p.weightPct ?? '')
    .replace(/%/g, '')
    .trim()
  const c = String(p.cycleId ?? props.cycleId).trim()
  const evalOpts = evaluationYearOptions.value
  const evalIds = new Set(evalOpts.map((x) => x.id))
  formCycleId.value = evalIds.has(c) ? c : String(evalOpts[0]?.id ?? new Date().getFullYear())
  hydrateCalculationFromPersisted(String(p.calculationMethod ?? 'mean_actual_plan'))
  isImportantKpi.value = p.isImportant === true
}

const isEditing = computed(() => {
  const raw = props.initialPayload
  return !!(raw && typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length > 0)
})

const drawerTitle = computed(() => (isEditing.value ? 'Sửa KPI trong bộ mẫu' : 'Thêm KPI vào bộ mẫu'))
const confirmButtonLabel = computed(() => (isEditing.value ? 'Cập nhật KPI' : 'Thêm vào bộ mẫu'))

watch(open, (v) => {
  if (!v) return
  void nextTick(() => {
    if (isEditing.value && props.initialPayload) {
      hydrateFromPayload(props.initialPayload)
    } else {
      resetForm()
    }
  })
})

function close() {
  open.value = false
}

const KPI_TYPE_VALUES: StrategicKpiType[] = ['cascading', 'individual', 'promotion']

function validateForm(): boolean {
  clearFormErrors()
  const err: Record<string, string> = {}

  if (!BSC_VALUE_SET.has(perspective.value)) {
    err.perspective = 'Chọn khía cạnh BSC (Perspective).'
  }

  if (!KPI_TYPE_VALUES.includes(kpiType.value)) {
    err.kpiType = 'Chọn loại hình KPI (Cascading / Individual / Promotion).'
  }

  if (!kpiName.value.trim()) {
    err.kpiName = 'Vui lòng nhập tên KPI.'
  }

  if (kpiType.value === 'cascading') {
    const tvRaw = targetValue.value
    const tvStr = String(tvRaw ?? '').trim()
    if (tvStr === '' || Number.isNaN(Number(tvRaw))) {
      err.targetValue = 'Nhập mục tiêu (số).'
    } else if (Number(tvRaw) < 0) {
      err.targetValue = 'Mục tiêu phải ≥ 0.'
    }
  }

  const wStr = String(weightPct.value).trim()
  const wNum = Number.parseFloat(wStr)
  if (!wStr) {
    err.weightPct = 'Nhập trọng số (%).'
  } else if (!Number.isFinite(wNum) || wNum <= 0 || wNum > 100) {
    err.weightPct = 'Trọng số phải từ 1 đến 100.'
  }

  if (!KPI_CALCULATION_FORMULAS.some((f) => f.value === calculationMethod.value)) {
    err.calculationMethod = 'Chọn phân loại cách tính (công thức KPI).'
  }

  formErrors.value = err
  return Object.keys(err).length === 0
}

async function confirmAdd() {
  if (!validateForm()) {
    await nextTick()
    errorBannerRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    return
  }

  saving.value = true
  const payload: Record<string, unknown> = {
    kpiType: kpiType.value,
    perspective: perspective.value,
    kpiName: kpiName.value,
    description: description.value,
    targetValue: kpiType.value === 'cascading' ? targetValue.value : '',
    unit: unit.value,
    weightPct: weightPct.value,
    startDate: cycleDateBounds.value.start,
    endDate: cycleDateBounds.value.end,
    cycleId: formCycleId.value,
    calculationMethod: resolvePersistedCalculationMethod(),
    evaluationDirection: DEFAULT_EVALUATION_DIRECTION,
    isImportant: isImportantKpi.value,
  }
  if (kpiType.value === 'cascading') {
    payload.assignPMs = []
    payload.pmTargets = {}
  } else if (kpiType.value === 'individual') {
    payload.ranks = []
    payload.rankMemberIds = {}
    payload.memberIds = []
  } else {
    payload.memberIds = []
  }

  await new Promise((r) => setTimeout(r, 350))
  saving.value = false
  emit('added', payload)
  open.value = false
}
</script>

<template>
  <Teleport to="body">
    <Transition name="gm-tpl-suite-kpi-drawer">
      <div
        v-if="open"
        class="fixed inset-0 z-[180] sm:left-64"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gm-tpl-suite-kpi-title"
      >
        <div
          class="gm-tpl-suite-kpi-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
          @click="close"
        />
        <div
          class="gm-tpl-suite-kpi-panel absolute bottom-0 right-0 top-0 flex w-full max-w-full flex-col border-l border-slate-200 bg-slate-50 shadow-2xl md:max-w-[700px] lg:max-w-[800px]"
        >
          <div class="z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 id="gm-tpl-suite-kpi-title" class="flex items-center gap-2 text-lg font-bold text-slate-800">
                <span class="rounded-lg bg-purple-100 p-1.5 text-purple-700 shadow-sm">
                  <i class="fas fa-bullseye text-sm" aria-hidden="true" />
                </span>
                {{ drawerTitle }}
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
              ref="errorBannerRef"
              class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900 shadow-sm"
              role="alert"
            >
              <p class="mb-2 flex items-center gap-2 font-bold">
                <i class="fas fa-circle-exclamation text-rose-600" aria-hidden="true" />
                Vui lòng sửa các lỗi sau.
              </p>
              <ul class="list-inside list-disc space-y-0.5 text-[11px] font-semibold text-rose-800">
                <li v-for="(msg, key) in formErrors" :key="key">{{ msg }}</li>
              </ul>
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
                      Perspective (BSC) <span class="text-rose-500">*</span>
                    </label>
                    <div class="relative">
                      <select
                        v-model="perspective"
                        class="input-required w-full cursor-pointer appearance-none rounded-md py-2 pl-3 pr-8 text-xs font-bold text-slate-800 outline-none transition-all"
                        :class="formErrors.perspective ? '!border-rose-400 !bg-rose-50/50' : ''"
                      >
                        <option v-for="o in BSC_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                      </select>
                      <i
                        class="fas fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                        aria-hidden="true"
                      />
                    </div>
                    <p v-if="formErrors.perspective" class="mt-1 text-[10px] font-semibold text-rose-600">
                      {{ formErrors.perspective }}
                    </p>
                  </div>
                  <div class="min-w-0 sm:flex-1">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      KPI Name <span class="text-rose-500">*</span>
                    </label>
                    <input
                      v-model="kpiName"
                      type="text"
                      placeholder="e.g. Enterprise Delivery Rate"
                      class="input-required w-full rounded-md px-3 py-2 text-xs font-bold text-slate-800 outline-none transition-all"
                      :class="formErrors.kpiName ? '!border-rose-400 !bg-rose-50/50' : ''"
                    />
                    <p v-if="formErrors.kpiName" class="mt-1 text-[10px] font-semibold text-rose-600">
                      {{ formErrors.kpiName }}
                    </p>
                  </div>
                </div>

                <div>
                  <label class="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Loại hình KPI (cách thức giao) <span class="text-rose-500">*</span>
                  </label>
                  <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <button type="button" :class="typeCardClass('cascading')" @click="kpiType = 'cascading'">
                      <span
                        class="absolute right-2.5 top-2.5 text-blue-600 transition-all"
                        :class="kpiType === 'cascading' ? 'opacity-100 scale-100' : 'scale-50 opacity-0'"
                      >
                        <i class="fas fa-check-circle text-base" aria-hidden="true" />
                      </span>
                      <div class="mb-1.5 flex items-center gap-2">
                        <span class="rounded border border-slate-100 bg-slate-50 p-1">
                          <i class="fas fa-code-branch text-xs text-blue-600" aria-hidden="true" />
                        </span>
                        <span class="text-xs font-bold text-slate-800">Cascading KPI</span>
                      </div>
                      <p class="text-[11px] font-medium leading-tight text-slate-500">Giao cho PM phân rã tiếp.</p>
                    </button>

                    <button type="button" :class="typeCardClass('individual')" @click="kpiType = 'individual'">
                      <span
                        class="absolute right-2.5 top-2.5 text-blue-600 transition-all"
                        :class="kpiType === 'individual' ? 'opacity-100 scale-100' : 'scale-50 opacity-0'"
                      >
                        <i class="fas fa-check-circle text-base" aria-hidden="true" />
                      </span>
                      <div class="mb-1.5 flex items-center gap-2">
                        <span class="rounded border border-slate-100 bg-slate-50 p-1">
                          <i class="fas fa-crosshairs text-xs text-slate-600" aria-hidden="true" />
                        </span>
                        <span class="text-xs font-bold text-slate-800">Individual KPI</span>
                      </div>
                      <p class="text-[11px] font-medium leading-tight text-slate-500">Giao hàng loạt cho Rank.</p>
                    </button>

                    <button type="button" :class="typeCardClass('promotion')" @click="kpiType = 'promotion'">
                      <span
                        class="absolute right-2.5 top-2.5 text-purple-600 transition-all"
                        :class="kpiType === 'promotion' ? 'opacity-100 scale-100' : 'scale-50 opacity-0'"
                      >
                        <i class="fas fa-check-circle text-base" aria-hidden="true" />
                      </span>
                      <div class="mb-1.5 flex items-center gap-2">
                        <span class="rounded border border-slate-100 bg-slate-50 p-1 shadow-sm">
                          <i class="fas fa-user-plus text-xs text-purple-600" aria-hidden="true" />
                        </span>
                        <span class="text-xs font-bold text-slate-800">Promotion KPI</span>
                      </div>
                      <p class="text-[11px] font-medium leading-tight text-slate-500">Giao đích danh cá nhân.</p>
                    </button>
                  </div>
                  <p v-if="formErrors.kpiType" class="mt-1 text-[10px] font-semibold text-rose-600">
                    {{ formErrors.kpiType }}
                  </p>
                </div>

                <div class="flex items-center gap-2 rounded-md border border-slate-200/90 bg-slate-50/60 px-2.5 py-1.5">
                  <input
                    id="gm-tpl-kpi-important"
                    v-model="isImportantKpi"
                    type="checkbox"
                    class="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-amber-500 focus:ring-amber-400/50"
                  />
                  <label for="gm-tpl-kpi-important" class="cursor-pointer text-[11px] font-semibold text-slate-600">
                    KPI quan trọng
                  </label>
                </div>

                <div
                  class="grid grid-cols-1 gap-4"
                  :class="kpiType === 'cascading' ? 'sm:grid-cols-2 sm:gap-x-6' : ''"
                >
                  <div v-if="kpiType === 'cascading'" class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Target <span class="text-rose-500">*</span>
                    </label>
                    <input
                      v-model="targetValue"
                      type="number"
                      placeholder="95"
                      min="0"
                      class="input-required min-h-[38px] w-full rounded-md px-2.5 py-2 text-xs font-bold text-slate-800 outline-none transition-all"
                      :class="formErrors.targetValue ? '!border-rose-400 !bg-rose-50/50' : ''"
                    />
                    <p v-if="formErrors.targetValue" class="mt-1 text-[10px] font-semibold text-rose-600">
                      {{ formErrors.targetValue }}
                    </p>
                  </div>
                  <div class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Trọng số (Weight) <span class="text-rose-500">*</span>
                    </label>
                    <div class="relative">
                      <input
                        v-model="weightPct"
                        type="number"
                        placeholder="30"
                        min="1"
                        max="100"
                        class="input-required min-h-[38px] w-full rounded-md py-2 pl-2.5 pr-6 text-xs font-bold text-slate-800 outline-none transition-all"
                        :class="formErrors.weightPct ? '!border-rose-400 !bg-rose-50/50' : ''"
                      />
                      <span
                        class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-blue-400"
                      >%</span>
                    </div>
                    <p v-if="formErrors.weightPct" class="mt-1 text-[10px] font-semibold text-rose-600">
                      {{ formErrors.weightPct }}
                    </p>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-6">
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
                  <div class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Năm đánh giá <span class="text-rose-500">*</span>
                    </label>
                    <div class="relative w-full">
                      <select
                        v-model="formCycleId"
                        class="input-required min-h-[38px] w-full cursor-pointer appearance-none rounded-md py-2 pl-2.5 pr-7 text-xs font-bold text-slate-800 outline-none transition-all"
                      >
                        <option v-for="c in evaluationYearOptions" :key="c.id" :value="c.id">
                          {{ c.label }}
                        </option>
                      </select>
                      <i
                        class="fas fa-chevron-down pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>

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
                    <div
                      class="relative min-w-0 w-full sm:min-w-[22rem] md:min-w-[26rem] lg:min-w-[28rem] sm:flex-[1.35]"
                    >
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
                          name="gm-tpl-kpi-mean-ratio"
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
                          name="gm-tpl-kpi-mean-ratio"
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
                          name="gm-tpl-kpi-mean-agg"
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
                          name="gm-tpl-kpi-mean-agg"
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
                    placeholder="Giải thích ngắn gọn về mục tiêu và cách đo lường..."
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
              :disabled="saving"
              @click="close"
            >
              Hủy
            </button>
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-lg bg-purple-600 px-6 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-purple-700 disabled:opacity-60"
              :disabled="saving"
              @click="confirmAdd"
            >
              <i v-if="saving" class="fas fa-spinner fa-spin text-sm" aria-hidden="true" />
              <i v-else class="fas fa-plus text-sm" aria-hidden="true" />
              {{ saving ? 'Đang xử lý...' : confirmButtonLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.gm-tpl-suite-kpi-drawer-enter-active,
.gm-tpl-suite-kpi-drawer-leave-active {
  transition-duration: 0.28s;
}
.gm-tpl-suite-kpi-drawer-enter-active .gm-tpl-suite-kpi-backdrop,
.gm-tpl-suite-kpi-drawer-leave-active .gm-tpl-suite-kpi-backdrop {
  transition: opacity 0.28s ease;
}
.gm-tpl-suite-kpi-drawer-enter-active .gm-tpl-suite-kpi-panel,
.gm-tpl-suite-kpi-drawer-leave-active .gm-tpl-suite-kpi-panel {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.gm-tpl-suite-kpi-drawer-enter-from .gm-tpl-suite-kpi-backdrop,
.gm-tpl-suite-kpi-drawer-leave-to .gm-tpl-suite-kpi-backdrop {
  opacity: 0;
}
.gm-tpl-suite-kpi-drawer-enter-to .gm-tpl-suite-kpi-backdrop,
.gm-tpl-suite-kpi-drawer-leave-from .gm-tpl-suite-kpi-backdrop {
  opacity: 1;
}
.gm-tpl-suite-kpi-drawer-enter-from .gm-tpl-suite-kpi-panel,
.gm-tpl-suite-kpi-drawer-leave-to .gm-tpl-suite-kpi-panel {
  transform: translateX(100%);
}
.gm-tpl-suite-kpi-drawer-enter-to .gm-tpl-suite-kpi-panel,
.gm-tpl-suite-kpi-drawer-leave-from .gm-tpl-suite-kpi-panel {
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
