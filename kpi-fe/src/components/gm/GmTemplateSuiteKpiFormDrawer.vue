<script setup lang="ts">
/**
 * Drawer tạo một KPI cho **bộ template** — tách khỏi `GmCreateStrategicKpiModal` để logic GM workspace không phụ thuộc.
 * Giữ các trường giống form tạo Strategic KPI (custom): không tab, không sao chép, không phân bổ.
 */
import { ref, computed, watch, nextTick } from 'vue'
import { normalizeStrategicKpiKind } from '@/utils/gm-strategic-kpi-kind'
import { useGmKpiCategoryOptions } from '@/composables/useGmKpiCategoryOptions'
import { useKpiCalculationReference } from '@/composables/useKpiCalculationReference'
import { useKpiUnitOptions } from '@/composables/useKpiUnitOptions'
import { kpiFormUnitToUnitCode, kpiPayloadFormUnitKey } from '@/utils/kpiUnitCodes'
import {
  codesFromPersistedCalculationMethod,
  persistedCalculationMethodFromTypeAndRule,
} from '@/utils/kpiCalculationCodes'
import {
  strategicKpiKindFromTypeCode,
  strategicKpiTypeIconClass,
  typeCodeFromStrategicKpiKind,
} from '@/utils/strategicKpiTypeCodes'
import { apiGetStrategicKpiTypes } from '@/services/modules/kpi-reference.service'
import type { KpiTypeOption } from '@/types/kpi-type-option'
import ScoringRulesHelpTooltip from '@/components/kpi/ScoringRulesHelpTooltip.vue'
import {
  buildScoringRulesPayload,
  extractRawInputFromApiTargetDescription,
  validateScoringRulesDsl,
} from '@/utils/kpiScoringRulesDsl'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const open = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    cycleId: string
    /** Khi có — mở drawer ở chế độ sửa, điền form từ snapshot đã lưu. */
    initialPayload?: Record<string, unknown> | null
    /**
     * Trễ trước khi emit `added` (ms). Đặt 0 trên trang thư viện template khi parent gọi API ngay.
     * Parent chịu trách nhiệm đóng drawer (`v-model`) sau khi lưu thành công.
     */
    confirmDelayMs?: number
  }>(),
  { cycleId: '2026', initialPayload: null, confirmDelayMs: 350 },
)

const emit = defineEmits<{
  added: [payload: Record<string, unknown>]
}>()

type StrategicKpiType = 'cascading' | 'individual' | 'promotion'

const DEFAULT_CALCULATION_RULE_CODE = 802
const DEFAULT_CALCULATION_TYPE_CODE = 701

/** Chu kỳ/năm ngữ cảnh từ parent — không còn chọn «Năm đánh giá» trong form. */
const effectiveCycleIdForPayload = computed(() => {
  const c = String(props.cycleId ?? '').trim()
  return c || String(new Date().getFullYear())
})

/** Mã KPI_TYPE từ `GET /kpi/reference/kpi-types-strategic` — đồng bộ drawer Strategic KPI. */
const kpiTypeCode = ref<number>(102)
const kpiType = computed<StrategicKpiType>({
  get: () => strategicKpiKindFromTypeCode(kpiTypeCode.value),
  set: (v) => {
    kpiTypeCode.value = typeCodeFromStrategicKpiKind(v)
  },
})

const kpiTypeRows = ref<KpiTypeOption[]>([])
const kpiTypesLoading = ref(false)
const kpiTypesError = ref<string | null>(null)

async function loadKpiTypes() {
  kpiTypesLoading.value = true
  kpiTypesError.value = null
  try {
    const rows = await apiGetStrategicKpiTypes()
    kpiTypeRows.value = Array.isArray(rows) ? rows : []
    const codes = new Set(kpiTypeRows.value.map((r) => r.code))
    if (!codes.has(kpiTypeCode.value)) {
      kpiTypeCode.value = kpiTypeRows.value[0]?.code ?? 102
    }
  } catch (e: unknown) {
    kpiTypeRows.value = []
    kpiTypesError.value = e instanceof Error ? e.message : 'Không tải được loại hình KPI'
  } finally {
    kpiTypesLoading.value = false
  }
}

const perspective = ref<string>('')

const { categories: kpiCategories, loading: kpiCategoriesLoading, error: kpiCategoriesError, load: loadKpiCategories } =
  useGmKpiCategoryOptions()
const {
  options: kpiUnitOptions,
  loading: kpiUnitsLoading,
  error: kpiUnitsError,
  load: loadKpiUnits,
} = useKpiUnitOptions()
const {
  calcRulesWithTypes,
  loading: calcRefLoading,
  error: calcRefError,
  load: loadCalculationReference,
} = useKpiCalculationReference()

/** Dropdown «Nhóm KPI»: API + dòng sửa nếu `categoryId` / UUID `perspective` chưa có trong danh sách. */
const perspectiveOptions = computed((): { value: string; label: string }[] => {
  const opts = kpiCategories.value.map((c) => ({ value: c.id, label: c.name }))
  const raw = props.initialPayload
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return opts
  const rec = raw as Record<string, unknown>
  const cid = String(rec.categoryId ?? '').trim()
  const cname = String(rec.categoryName ?? '').trim()
  if (cid && cname && !opts.some((o) => o.value === cid)) {
    opts.unshift({ value: cid, label: cname })
  }
  const pid = String(rec.perspective ?? '').trim()
  if (UUID_RE.test(pid) && !opts.some((o) => o.value === pid)) {
    opts.unshift({ value: pid, label: cname || `Nhóm (${pid.slice(0, 8)}…)` })
  }
  return opts
})

const kpiName = ref('')
const description = ref('')
const targetValue = ref<string>('')
const unit = ref<string>('MM')
const isImportantKpi = ref(false)
const weightPct = ref<string>('')
const calculationRuleCode = ref(DEFAULT_CALCULATION_RULE_CODE)
const calculationTypeCode = ref<number | null>(DEFAULT_CALCULATION_TYPE_CODE)
const saving = ref(false)

const formErrors = ref<Record<string, string>>({})
const errorBannerRef = ref<HTMLElement | null>(null)

function clearFormErrors() {
  formErrors.value = {}
}

const typesForSelectedRule = computed(
  () => calcRulesWithTypes.value.find((row) => row.code === calculationRuleCode.value)?.calcTypes ?? [],
)

const selectedFormulaExpression = computed(() => {
  const ruleRow = calcRulesWithTypes.value.find((row) => row.code === calculationRuleCode.value)
  if (!ruleRow) return 'Chọn quy tắc tính toán.'
  const parts = [ruleRow.label]
  const types = typesForSelectedRule.value
  const typeRow = types.find((t) => t.code === calculationTypeCode.value)
  if (types.length > 1 && typeRow) parts.push(`Chiều tính: ${typeRow.label}.`)
  else if (types.length === 1 && typeRow) parts.push(`Chiều tính: ${typeRow.label}.`)
  return parts.join(' — ')
})

/** Rule COMMENT (803) — không dùng CALC_TYPE. */
const COMMENT_RULE_CODE = 803

function clampCalculationTypeToRule() {
  if (calculationRuleCode.value === COMMENT_RULE_CODE) {
    calculationTypeCode.value = null
    return
  }
  const types = typesForSelectedRule.value
  if (!types.length) {
    calculationTypeCode.value = null
    return
  }
  const cur = calculationTypeCode.value
  if (cur != null && types.some((t) => t.code === cur)) return
  calculationTypeCode.value = types[0]!.code
}

function resolvePersistedCalculationMethod(): string {
  return persistedCalculationMethodFromTypeAndRule(calculationTypeCode.value, calculationRuleCode.value)
}

function typeCardClassForCode(code: number) {
  const base =
    'relative cursor-pointer rounded-lg border p-3 text-left transition-all hover:border-blue-300'
  const selected = kpiTypeCode.value === code
  if (!selected) return `${base} border-slate-200 bg-white`
  if (code === 103) return `${base} border-purple-500 bg-purple-50`
  return `${base} border-blue-500 bg-blue-50`
}

watch(kpiType, () => {
  const allowedRules = new Set(calcRulesWithTypes.value.map((row) => row.code))
  if (!allowedRules.has(calculationRuleCode.value)) {
    calculationRuleCode.value = calcRulesWithTypes.value[0]?.code ?? DEFAULT_CALCULATION_RULE_CODE
    calculationTypeCode.value = DEFAULT_CALCULATION_TYPE_CODE
  }
  clampCalculationTypeToRule()
})

watch(calculationRuleCode, () => {
  clampCalculationTypeToRule()
})

watch(
  calcRulesWithTypes,
  (rows) => {
    if (!rows.length) return
    if (!rows.some((r) => r.code === calculationRuleCode.value)) {
      calculationRuleCode.value = rows[0]!.code
    }
    clampCalculationTypeToRule()
  },
  { deep: true },
)

function resetForm() {
  kpiTypeCode.value = kpiTypeRows.value[0]?.code ?? 102
  perspective.value = kpiCategories.value[0]?.id ?? ''
  kpiName.value = ''
  description.value = ''
  targetValue.value = ''
  unit.value = 'MM'
  isImportantKpi.value = false
  weightPct.value = ''
  calculationRuleCode.value = DEFAULT_CALCULATION_RULE_CODE
  calculationTypeCode.value = DEFAULT_CALCULATION_TYPE_CODE
  clearFormErrors()
}

function hydrateCalculationFromPersisted(cm: string) {
  const { calculationTypeCode: tc, calculationRuleCode: rc } = codesFromPersistedCalculationMethod(cm)
  calculationRuleCode.value = rc
  calculationTypeCode.value = tc
  clampCalculationTypeToRule()
}

function resolveCategoryIdFromPayload(p: Record<string, unknown>): string {
  const fromCat = String(p.categoryId ?? '').trim()
  if (fromCat) return fromCat
  const fromPers = String(p.perspective ?? '').trim()
  if (UUID_RE.test(fromPers)) return fromPers
  return ''
}

function hydrateFromPayload(p: Record<string, unknown>) {
  clearFormErrors()
  const tcRaw = p.typeCode
  const fromCode =
    typeof tcRaw === 'number' && Number.isFinite(tcRaw)
      ? tcRaw
      : Number.parseInt(String(tcRaw ?? '').trim(), 10)
  const codes = new Set(kpiTypeRows.value.map((r) => r.code))
  if (Number.isFinite(fromCode) && codes.has(fromCode)) {
    kpiTypeCode.value = fromCode
  } else {
    kpiTypeCode.value = typeCodeFromStrategicKpiKind(normalizeStrategicKpiKind(p.kpiType))
    if (!codes.has(kpiTypeCode.value)) {
      kpiTypeCode.value = kpiTypeRows.value[0]?.code ?? 102
    }
  }
  const resolved = resolveCategoryIdFromPayload(p)
  perspective.value = resolved || (kpiCategories.value[0]?.id ?? '')
  kpiName.value = String(p.kpiName ?? '')
  description.value = extractRawInputFromApiTargetDescription(
    (p as Record<string, unknown>).targetDescription ?? (p as Record<string, unknown>).description,
  )
  targetValue.value = String(p.targetValue ?? '')
  unit.value = kpiPayloadFormUnitKey(p)
  isImportantKpi.value = p.isImportant === true
  weightPct.value = String(p.weightPct ?? '')
    .replace(/%/g, '')
    .trim()
  hydrateCalculationFromPersisted(String(p.calculationMethod ?? 'mean_actual_plan'))
}

const isEditing = computed(() => {
  const raw = props.initialPayload
  return !!(raw && typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length > 0)
})

const drawerTitle = computed(() => (isEditing.value ? 'Sửa KPI trong bộ mẫu' : 'Thêm KPI vào bộ mẫu'))
const confirmButtonLabel = computed(() => (isEditing.value ? 'Cập nhật KPI' : 'Thêm vào bộ mẫu'))

watch(open, async (v) => {
  if (!v) return
  await Promise.all([loadKpiCategories(), loadKpiTypes(), loadKpiUnits(), loadCalculationReference()])
  await nextTick()
  if (isEditing.value && props.initialPayload) {
    hydrateFromPayload(props.initialPayload)
  } else {
    resetForm()
  }
})

function close() {
  open.value = false
}

function validateForm(): boolean {
  clearFormErrors()
  const err: Record<string, string> = {}

  const allowedPerspective = new Set(perspectiveOptions.value.map((o) => o.value))
  const pid = String(perspective.value ?? '').trim()
  if (!pid || !allowedPerspective.has(pid)) {
    err.perspective = 'Chọn nhóm KPI (kpi_categories).'
  }

  const allowedTypeCodes = new Set(kpiTypeRows.value.map((r) => r.code))
  if (!allowedTypeCodes.has(kpiTypeCode.value)) {
    err.kpiType = 'Chọn loại hình KPI từ danh sách hệ thống.'
  }

  if (!kpiName.value.trim()) {
    err.kpiName = 'Vui lòng nhập tên KPI.'
  }

  const tvRaw = targetValue.value
  const tvStr = String(tvRaw ?? '').trim()
  if (tvStr === '' || Number.isNaN(Number(tvRaw))) {
    err.targetValue = 'Nhập mục tiêu (số).'
  } else if (Number(tvRaw) < 0) {
    err.targetValue = 'Mục tiêu phải ≥ 0.'
  }

  const wStr = String(weightPct.value).trim()
  const wNum = Number.parseFloat(wStr)
  if (!wStr) {
    err.weightPct = 'Nhập trọng số (%).'
  } else if (!Number.isFinite(wNum) || wNum <= 0 || wNum > 100) {
    err.weightPct = 'Trọng số phải từ 1 đến 100.'
  }

  const ruleOpts = calcRulesWithTypes.value
  if (!ruleOpts.some((row) => row.code === calculationRuleCode.value)) {
    err.calculationMethod = 'Chọn quy tắc tính toán.'
  } else {
    const types = typesForSelectedRule.value
    if (types.length > 0) {
      const tc = calculationTypeCode.value
      if (tc == null || !types.some((t) => t.code === tc)) {
        err.calculationMethod = 'Chọn chiều tính toán.'
      }
    }
  }

  const descTrim = description.value.trim()
  if (!descTrim) {
    err.scoringRules = 'Vui lòng nhập quy tắc chấm điểm (đủ các mức 1–5 theo cú pháp).'
  } else {
    const vr = validateScoringRulesDsl(description.value)
    if (!vr.ok) {
      err.scoringRules = vr.errors.join(' ')
    }
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
    targetDescription: description.value.trim()
      ? buildScoringRulesPayload(description.value)
      : null,
    targetValue:
      Number.parseFloat(String(targetValue.value).trim()),
    unit: unit.value,
    unitCode: kpiFormUnitToUnitCode(unit.value),
    weightPct: weightPct.value,
    cycleId: effectiveCycleIdForPayload.value,
    calculationMethod: resolvePersistedCalculationMethod(),
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

  payload.typeCode = typeCodeFromStrategicKpiKind(kpiType.value)

  if (props.confirmDelayMs > 0) {
    await new Promise((r) => setTimeout(r, props.confirmDelayMs))
  }
  saving.value = false
  emit('added', payload)
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
                      Nhóm KPI (kpi_categories) <span class="text-rose-500">*</span>
                    </label>
                    <p v-if="kpiCategoriesError" class="mb-1 text-[10px] font-semibold text-rose-600">
                      {{ kpiCategoriesError }}
                    </p>
                    <div class="relative">
                      <select
                        v-model="perspective"
                        :disabled="kpiCategoriesLoading"
                        class="input-required w-full cursor-pointer appearance-none rounded-md py-2 pl-3 pr-8 text-xs font-bold text-slate-800 outline-none transition-all disabled:cursor-not-allowed disabled:opacity-60"
                        :class="formErrors.perspective ? '!border-rose-400 !bg-rose-50/50' : ''"
                      >
                        <option value="" disabled>{{ kpiCategoriesLoading ? 'Đang tải…' : '— Chọn nhóm —' }}</option>
                        <option v-for="o in perspectiveOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
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
                  <p v-if="kpiTypesError" class="mb-2 text-[10px] font-semibold text-rose-600">{{ kpiTypesError }}</p>
                  <p v-else-if="kpiTypesLoading" class="mb-2 text-[10px] font-medium text-slate-500">
                    Đang tải loại hình KPI từ hệ thống…
                  </p>
                  <div
                    class="grid grid-cols-1 gap-3"
                    :class="[
                      kpiTypeRows.length <= 1 ? '' : kpiTypeRows.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3',
                    ]"
                  >
                    <button
                      v-for="opt in kpiTypeRows"
                      :key="opt.code"
                      type="button"
                      :disabled="kpiTypesLoading"
                      :class="typeCardClassForCode(opt.code)"
                      @click="kpiTypeCode = opt.code"
                    >
                      <span
                        class="absolute right-2.5 top-2.5 transition-all"
                        :class="[
                          opt.code === 103 ? 'text-purple-600' : 'text-blue-600',
                          kpiTypeCode === opt.code ? 'opacity-100 scale-100' : 'scale-50 opacity-0',
                        ]"
                      >
                        <i class="fas fa-check-circle text-base" aria-hidden="true" />
                      </span>
                      <div class="mb-1.5 flex items-center gap-2">
                        <span class="rounded border border-slate-100 bg-slate-50 p-1 shadow-sm">
                          <i :class="strategicKpiTypeIconClass(opt.code)" aria-hidden="true" />
                        </span>
                        <span class="text-xs font-bold leading-snug text-slate-800">{{
                          opt.description || opt.name
                        }}</span>
                      </div>
                    </button>
                  </div>
                  <p
                    v-if="!kpiTypesLoading && !kpiTypesError && kpiTypeRows.length === 0"
                    class="mt-2 text-[11px] font-medium text-amber-800"
                  >
                    Chưa có dữ liệu loại KPI (nhóm KPI_TYPE trong hệ thống).
                  </p>
                  <p v-if="formErrors.kpiType" class="mt-1 text-[10px] font-semibold text-rose-600">
                    {{ formErrors.kpiType }}
                  </p>
                </div>

                <div
                  class="grid grid-cols-1 gap-4"
                  :class="'sm:grid-cols-2 sm:gap-x-6'"
                >
                  <div class="min-w-0">
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

                <div
                  class="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-x-4 sm:gap-y-0"
                >
                  <div class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Unit <span class="text-rose-500">*</span>
                    </label>
                    <p v-if="kpiUnitsError" class="mb-1 text-[10px] font-semibold text-amber-700">
                      {{ kpiUnitsError }}
                    </p>
                    <div class="relative min-w-0 w-full">
                      <select
                        v-model="unit"
                        class="input-required min-h-[38px] w-full cursor-pointer appearance-none rounded-md py-2 pl-2.5 pr-7 text-xs font-bold text-slate-800 outline-none transition-all"
                        :disabled="kpiUnitsLoading"
                      >
                        <option v-for="u in kpiUnitOptions" :key="u.value" :value="u.value">{{ u.label }}</option>
                      </select>
                      <i
                        class="fas fa-chevron-down pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                  <label
                    class="flex min-h-[38px] cursor-pointer items-center gap-2 self-start rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 sm:self-end sm:whitespace-nowrap"
                  >
                    <input
                      v-model="isImportantKpi"
                      type="checkbox"
                      class="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400/40"
                    />
                    <span>KPI quan trọng</span>
                  </label>
                </div>

                <div>
                  <p v-if="calcRefError" class="mb-1 text-[10px] font-semibold text-amber-700">
                    {{ calcRefError }}
                  </p>
                  <div class="mb-1.5 flex items-center gap-1.5">
                    <label class="block flex-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Phân loại cách tính <span class="text-rose-500">*</span>
                    </label>
                    <span
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
                        v-model.number="calculationRuleCode"
                        class="input-required min-h-[38px] w-full cursor-pointer appearance-none rounded-md py-2 pr-7 text-xs font-bold text-slate-800 outline-none transition-all"
                        :class="[
                          typesForSelectedRule.length > 1 ? 'pl-8' : 'pl-2.5',
                          formErrors.calculationMethod ? '!border-rose-400 !bg-rose-50/50' : '',
                        ]"
                        :disabled="calcRefLoading"
                        :title="selectedFormulaExpression"
                      >
                        <option
                          v-for="row in calcRulesWithTypes"
                          :key="row.code"
                          :value="row.code"
                          :title="row.label"
                        >
                          {{ row.label }}
                        </option>
                      </select>
                      <i
                        v-if="typesForSelectedRule.length > 1"
                        class="fas fa-calculator pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                        aria-hidden="true"
                      />
                      <i
                        class="fas fa-chevron-down pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                        aria-hidden="true"
                      />
                    </div>
                    <div
                      v-if="typesForSelectedRule.length > 1"
                      class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-slate-200/90 bg-slate-50/70 px-2.5 py-2"
                    >
                      <label
                        v-for="t in typesForSelectedRule"
                        :key="t.code"
                        class="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-700"
                      >
                        <input
                          v-model.number="calculationTypeCode"
                          type="radio"
                          name="gm-tpl-kpi-calc-type"
                          :value="t.code"
                          class="h-3.5 w-3.5 border-slate-300 text-slate-700 focus:ring-slate-400/40"
                        />
                        {{ t.label }}
                      </label>
                    </div>
                  </div>
                  <p v-if="formErrors.calculationMethod" class="mt-1 text-[10px] font-semibold text-rose-600">
                    {{ formErrors.calculationMethod }}
                  </p>
                </div>

                <div>
                  <div class="mb-1.5 flex items-center gap-1.5">
                    <label class="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Quy tắc chấm điểm <span class="text-rose-500">*</span>
                    </label>
                    <ScoringRulesHelpTooltip aria-label="Ví dụ cú pháp quy tắc chấm điểm" />
                  </div>
                  <textarea
                    v-model="description"
                    rows="5"
                    placeholder="1: &lt;50&#10;2: 50-70&#10;3: 71-85&#10;4: 86-99&#10;5: &gt;=100"
                    class="custom-scrollbar min-h-[7.5rem] w-full resize-y rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none transition-all focus:ring-2"
                    :class="
                      formErrors.scoringRules
                        ? '!border-rose-400 !bg-rose-50/70 focus:border-rose-400 focus:ring-rose-100'
                        : 'input-required focus:border-blue-400 focus:ring-blue-100'
                    "
                  />
                  <p v-if="formErrors.scoringRules" class="mt-1 text-[10px] font-semibold text-rose-600">
                    {{ formErrors.scoringRules }}
                  </p>
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
