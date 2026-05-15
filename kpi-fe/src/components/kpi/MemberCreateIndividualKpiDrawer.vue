<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { KpiItem } from '@/types/kpi'
import { gmKpiService } from '@/services/modules/kpi-gm.service'
import { useGmKpiCategoryOptions } from '@/composables/useGmKpiCategoryOptions'
import { useKpiCalculationReference } from '@/composables/useKpiCalculationReference'
import { persistedCalculationMethodFromTypeAndRule } from '@/utils/kpiCalculationCodes'
import {
  validateScoringRulesDsl,
  buildScoringRulesPayload,
  extractRawInputFromApiTargetDescription,
} from '@/utils/kpiScoringRulesDsl'
import ScoringRulesHelpTooltip from '@/components/kpi/ScoringRulesHelpTooltip.vue'
import { useKpiUnitOptions } from '@/composables/useKpiUnitOptions'
import { kpiCycleService } from '@/services/shared/kpi-cycle.service'
import { kpiFormUnitToUnitCode } from '@/utils/kpiUnitCodes'

const open = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    /** Year string hoặc cycle UUID — khớp với selectedYear trên MemberDashboard. */
    cycleId: string
    /** Khi có giá trị: mở drawer ở chế độ sửa KPI tự tạo bị reject. */
    editItem?: KpiItem | null
  }>(),
  { cycleId: '', editItem: null },
)

const emit = defineEmits<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saved: [response: any]
}>()

const realCycleId = ref<string>('')
const loadingCycle = ref(false)
const errorCycle = ref<string | null>(null)

// ── Data composables ────────────────────────────────────────────────────────────
const {
  categories: kpiCategories,
  loading: kpiCategoriesLoading,
  error: kpiCategoriesError,
  load: loadKpiCategories,
} = useGmKpiCategoryOptions()

const {
  calcRulesWithTypes,
  loading: calcRefLoading,
  error: calcRefError,
  load: loadCalculationReference,
} = useKpiCalculationReference()
const {
  options: kpiUnitOptions,
  loading: kpiUnitLoading,
  error: kpiUnitError,
  load: loadKpiUnits,
} = useKpiUnitOptions()

const perspectiveOptions = computed((): { value: string; label: string }[] =>
  kpiCategories.value.map((c) => ({ value: c.id, label: c.name })),
)

const cycleYearNumFallback = computed(() => {
  const n = Number.parseInt(String(props.cycleId), 10)
  return Number.isFinite(n) ? n : new Date().getFullYear()
})

const isLoadingMeta = computed(
  () => kpiCategoriesLoading.value || calcRefLoading.value || kpiUnitLoading.value || loadingCycle.value,
)

const metaLoadError = computed(() => {
  const errs = [kpiCategoriesError.value, calcRefError.value, kpiUnitError.value, errorCycle.value]
    .filter(Boolean)
  return errs.length ? errs.join(' | ') : null
})

async function loadFormMeta() {
  loadingCycle.value = true
  errorCycle.value = null
  try {
    const [cycleData] = await Promise.all([
      kpiCycleService.getKpiCycleByYear(cycleYearNumFallback.value),
      loadKpiCategories(),
      loadCalculationReference(),
      loadKpiUnits(),
    ])
    realCycleId.value = cycleData.id
  } catch (e: unknown) {
    realCycleId.value = ''
    errorCycle.value = e instanceof Error ? e.message : 'Không lấy được thông tin chu kỳ KPI năm nay.'
  } finally {
    loadingCycle.value = false
  }
}

// ── Form state ──────────────────────────────────────────────────────────────────
const DEFAULT_CALCULATION_RULE_CODE = 802
const DEFAULT_CALCULATION_TYPE_CODE = 701
const perspective = ref('')
const kpiName = ref('')
const description = ref('')
const targetValue = ref<string>('')
const weightPct = ref<string>('')
const calculationRuleCode = ref(DEFAULT_CALCULATION_RULE_CODE)
const calculationTypeCode = ref<number | null>(DEFAULT_CALCULATION_TYPE_CODE)
const unit = ref('MM')

const typesForSelectedRule = computed(
  () =>
    calcRulesWithTypes.value.find((row) => row.code === calculationRuleCode.value)?.calcTypes ?? [],
)

const selectedFormulaExpression = computed(() => {
  const rule = calcRulesWithTypes.value.find((r) => r.code === calculationRuleCode.value)
  if (!rule) return ''
  if (typesForSelectedRule.value.length > 1) {
    const type = typesForSelectedRule.value.find((t) => t.code === calculationTypeCode.value)
    return (type as any).formula ?? rule.label ?? ''
  }
  return rule.label ?? ''
})

const isEditMode = computed(() => {
  const id = String(props.editItem?.kpiInformationId ?? '').trim()
  return id.length > 0
})

const editingKpiInformationId = computed(() =>
  String(props.editItem?.kpiInformationId ?? '').trim(),
)

// ── Lifecycle ───────────────────────────────────────────────────────────────────
watch(open, async (v) => {
  if (v) {
    resetForm()
    await loadFormMeta()
    hydrateFormForEdit()
  }
})

watch(calculationRuleCode, () => {
  const types = typesForSelectedRule.value
  if (!types.length) {
    calculationTypeCode.value = null
    return
  }
  if (!types.some((t) => t.code === calculationTypeCode.value)) {
    calculationTypeCode.value = types[0]?.code ?? null
  }
})

function resetForm() {
  perspective.value = ''
  kpiName.value = ''
  description.value = ''
  targetValue.value = ''
  weightPct.value = ''
  unit.value = 'MM'
  calculationRuleCode.value = DEFAULT_CALCULATION_RULE_CODE
  calculationTypeCode.value = DEFAULT_CALCULATION_TYPE_CODE
  realCycleId.value = ''
  clearFormErrors()
}

function findUnitOptionByAnyLabel(raw: string): string | null {
  const norm = raw.trim().toLowerCase()
  if (!norm) return null
  const hit = kpiUnitOptions.value.find((opt) => {
    const label = String(opt.label ?? '').trim().toLowerCase()
    const value = String(opt.value ?? '').trim().toLowerCase()
    return label === norm || value === norm
  })
  return hit?.value ?? null
}

function findPerspectiveOptionByName(raw: string): string | null {
  const norm = raw.trim().toLowerCase()
  if (!norm) return null
  const hit = perspectiveOptions.value.find((opt) => {
    const label = String(opt.label ?? '').trim().toLowerCase()
    const value = String(opt.value ?? '').trim().toLowerCase()
    return label === norm || value === norm
  })
  return hit?.value ?? null
}

function hydrateFormForEdit() {
  const item = props.editItem
  if (!item || !isEditMode.value) return
  const mappedPerspectiveByName = findPerspectiveOptionByName(String(item.categoryName ?? ''))
  const categoryIdRaw = String(item.categoryId ?? '').trim()
  perspective.value = categoryIdRaw || mappedPerspectiveByName || (perspectiveOptions.value[0]?.value ?? '')
  kpiName.value = String(item.name ?? '').trim()
  targetValue.value = String(item.assignmentTargetValue ?? item.kpiTemplateTargetValue ?? '')
  weightPct.value = String(item.weight ?? '')
  calculationRuleCode.value = Number(item.calculationRuleCode ?? DEFAULT_CALCULATION_RULE_CODE)
  calculationTypeCode.value = Number(item.calculationTypeCode ?? DEFAULT_CALCULATION_TYPE_CODE)
  const rawRules =
    extractRawInputFromApiTargetDescription(item.targetDescription ?? '')
    || extractRawInputFromApiTargetDescription(item.target ?? '')
  description.value = rawRules
  const mappedUnit = findUnitOptionByAnyLabel(String(item.unitName ?? ''))
  unit.value = mappedUnit ?? 'MM'
}

function close() {
  open.value = false
}

// ── Validation & Save ───────────────────────────────────────────────────────────
const saving = ref(false)
const formErrors = ref<Record<string, string>>({})
const errorBannerRef = ref<HTMLElement | null>(null)

function clearFormErrors() {
  formErrors.value = {}
}

function validateForm(): boolean {
  clearFormErrors()
  const err: Record<string, string> = {}

  if (!perspective.value.trim()) {
    err.perspective = 'Chọn nhóm KPI (kpi_categories).'
  }
  if (!kpiName.value.trim()) {
    err.kpiName = 'Vui lòng nhập tên KPI.'
  }

  const tvRaw = targetValue.value
  const tvStr = String(tvRaw ?? '').trim()
  if (tvStr === '' || Number.isNaN(Number(tvRaw))) {
    err.targetValue = 'Nhập mục tiêu (số).'
  } else if (Number(tvRaw) < 0) {
    err.targetValue = 'Mục tiêu phải >= 0.'
  }

  const wStr = String(weightPct.value).trim()
  const wNum = Number.parseFloat(wStr)
  if (!wStr) {
    err.weightPct = 'Nhập trọng số (%).'
  } else if (!Number.isFinite(wNum) || wNum <= 0 || wNum > 100) {
    err.weightPct = 'Trọng số phải từ 1 đến 100.'
  }

  if (!realCycleId.value.trim()) {
    err.formCycleId = 'Không tìm thấy ID chu kỳ KPI hợp lệ.'
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

  const scoringTrim = description.value.trim()
  if (!scoringTrim) {
    err.scoringRules = 'Vui lòng nhập quy tắc chấm điểm (đủ các mức 1–5 theo cú pháp).'
  } else {
    const vr = validateScoringRulesDsl(description.value)
    if (!vr.ok) err.scoringRules = vr.errors.join(' ')
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
  try {
    let existingMemberIds: string[] = []
    if (isEditMode.value) {
      const existing = await gmKpiService.getStrategicKpiForEdit(editingKpiInformationId.value)
      existingMemberIds = Array.isArray(existing.memberIds)
        ? existing.memberIds.map((x) => String(x))
        : []
    }
    const payload = {
      cycleId: realCycleId.value,
      typeCode: Number(props.editItem?.group === 'P' ? 103 : 101),
      perspective: perspective.value,
      kpiName: kpiName.value.trim(),
      targetDescription: buildScoringRulesPayload(description.value),
      targetValue: Number.parseFloat(String(targetValue.value).trim()),
      unit: unit.value,
      unitCode: kpiFormUnitToUnitCode(unit.value),
      weightPct: Number.parseFloat(String(weightPct.value).trim()),
      calculationMethod: persistedCalculationMethodFromTypeAndRule(
        calculationTypeCode.value,
        calculationRuleCode.value,
      ),
      isImportant: false,
      memberIds: isEditMode.value ? existingMemberIds : [],
      editingKpiInformationId: editingKpiInformationId.value || null,
    }
    const response = isEditMode.value
      ? await gmKpiService.updateStrategicKpi(editingKpiInformationId.value, payload)
      : await gmKpiService.createStrategicKpi(payload)
    emit('saved', response)
    open.value = false
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
      (e instanceof Error ? e.message : 'Có lỗi xảy ra khi tạo KPI trên máy chủ.')
    formErrors.value = { apiError: msg }
    await nextTick()
    errorBannerRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="gm-kpi-drawer">
      <div
        v-if="open"
        class="fixed inset-0 z-[100]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-ind-create-kpi-title"
      >
        <div
          class="gm-kpi-drawer-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
          @click="close"
        />

        <div
          class="gm-kpi-drawer-panel absolute bottom-0 right-0 top-0 flex w-full max-w-full flex-col border-l border-slate-200 bg-slate-50 shadow-2xl md:max-w-[700px] lg:max-w-[800px]"
        >
          <!-- Header -->
          <div
            class="z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white p-5 shadow-sm"
          >
            <div>
              <h2
                id="member-ind-create-kpi-title"
                class="flex items-center gap-2 text-lg font-bold text-slate-800"
              >
                <span class="rounded-lg bg-blue-100 p-1.5 text-blue-700 shadow-sm">
                  <i class="fas fa-bullseye text-sm" aria-hidden="true" />
                </span>
                {{ isEditMode ? 'Chỉnh sửa KPI cá nhân' : 'Tạo KPI cá nhân' }}
              </h2>
              <p class="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {{ isEditMode ? 'Cập nhật KPI tự tạo bị từ chối để submit lại' : 'Đề xuất mục tiêu cá nhân — chờ PM / quản lý xác nhận' }}
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

          <!-- Body -->
          <div class="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-6">
            <!-- Error banner -->
            <div
              v-if="metaLoadError"
              class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900"
              role="alert"
            >
              {{ metaLoadError }}
            </div>

            <div
              v-if="Object.keys(formErrors).length > 0"
              id="member-ind-create-kpi-errors"
              ref="errorBannerRef"
              class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900 shadow-sm"
              role="alert"
            >
              <p class="mb-2 flex items-center gap-2 font-bold">
                <i class="fas fa-circle-exclamation text-rose-600" aria-hidden="true" />
                Vui lòng sửa các lỗi sau trước khi {{ isEditMode ? 'cập nhật KPI' : 'tạo KPI' }}.
              </p>
              <ul class="list-inside list-disc space-y-0.5 text-[11px] font-semibold text-rose-800">
                <li v-for="(msg, key) in formErrors" :key="key">{{ msg }}</li>
              </ul>
            </div>

            <!-- Card: Thông tin cơ bản & phân loại -->
            <div class="gm-kpi-section-card rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <label
                class="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-800"
              >
                <span class="rounded-lg bg-slate-100 p-1.5 text-indigo-600">
                  <i class="fas fa-file-lines text-sm" aria-hidden="true" />
                </span>
                Thông tin cơ bản &amp; phân loại
              </label>

              <div class="space-y-4">
                <!-- Row 1: Nhóm KPI + KPI Name -->
                <div class="flex flex-col gap-3 sm:flex-row">
                  <div class="sm:w-1/3">
                    <label
                      class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      Nhóm KPI (kpi_categories) <span class="text-rose-500">*</span>
                    </label>
                    <p
                      v-if="kpiCategoriesError"
                      class="mb-1 text-[10px] font-semibold text-rose-600"
                    >
                      {{ kpiCategoriesError }}
                    </p>
                    <div class="relative">
                      <select
                        v-model="perspective"
                        :disabled="kpiCategoriesLoading"
                        class="input-required w-full cursor-pointer appearance-none rounded-md py-2 pl-3 pr-8 text-xs font-bold text-slate-800 outline-none transition-all disabled:cursor-not-allowed disabled:opacity-60"
                        :class="formErrors.perspective ? '!border-rose-400 !bg-rose-50/50' : ''"
                      >
                        <option value="" disabled>
                          {{ kpiCategoriesLoading ? 'Đang tải…' : '— Chọn nhóm —' }}
                        </option>
                        <option
                          v-for="o in perspectiveOptions"
                          :key="o.value"
                          :value="o.value"
                        >
                          {{ o.label }}
                        </option>
                      </select>
                      <i
                        class="fas fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                        aria-hidden="true"
                      />
                    </div>
                    <p
                      v-if="formErrors.perspective"
                      class="mt-1 text-[10px] font-semibold text-rose-600"
                    >
                      {{ formErrors.perspective }}
                    </p>
                  </div>

                  <div class="min-w-0 sm:flex-1">
                    <label
                      class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      KPI Name <span class="text-rose-500">*</span>
                    </label>
                    <input
                      v-model="kpiName"
                      type="text"
                      placeholder="e.g. Hoàn thành khóa đào tạo nội bộ"
                      class="input-required w-full rounded-md px-3 py-2 text-xs font-bold text-slate-800 outline-none transition-all"
                      :class="formErrors.kpiName ? '!border-rose-400 !bg-rose-50/50' : ''"
                    />
                    <p
                      v-if="formErrors.kpiName"
                      class="mt-1 text-[10px] font-semibold text-rose-600"
                    >
                      {{ formErrors.kpiName }}
                    </p>
                  </div>
                </div>

                <!-- Row 2: Target + Trọng số + Unit -->
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-x-6">
                  <div class="min-w-0">
                    <label
                      class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
                    >
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
                    <p
                      v-if="formErrors.targetValue"
                      class="mt-1 text-[10px] font-semibold text-rose-600"
                    >
                      {{ formErrors.targetValue }}
                    </p>
                  </div>

                  <div class="min-w-0">
                    <label
                      class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
                    >
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
                      >
                        %
                      </span>
                    </div>
                    <p
                      v-if="formErrors.weightPct"
                      class="mt-1 text-[10px] font-semibold text-rose-600"
                    >
                      {{ formErrors.weightPct }}
                    </p>
                  </div>

                  <div class="min-w-0">
                    <label
                      class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      Unit <span class="text-rose-500">*</span>
                    </label>
                    <div class="relative">
                      <select
                        v-model="unit"
                        class="input-required min-h-[38px] w-full cursor-pointer appearance-none rounded-md py-2 pl-2.5 pr-7 text-xs font-bold text-slate-800 outline-none transition-all disabled:opacity-60"
                        :disabled="isLoadingMeta"
                      >
                        <option v-for="u in kpiUnitOptions" :key="u.value" :value="u.value">{{ u.label }}</option>
                      </select>
                      <i
                        class="fas fa-chevron-down pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                        aria-hidden="true"
                      />
                    </div>
                    <p
                      v-if="formErrors.formCycleId"
                      class="mt-1 text-[10px] font-semibold text-rose-600"
                    >
                      {{ formErrors.formCycleId }}
                    </p>
                  </div>
                </div>

                <!-- Row 3: Phân loại cách tính -->
                <div>
                  <p
                    v-if="calcRefError"
                    class="mb-1 text-[10px] font-semibold text-amber-700"
                  >
                    {{ calcRefError }}
                  </p>
                  <div class="mb-1.5 flex items-center gap-1.5">
                    <label
                      class="block flex-1 text-[10px] font-bold uppercase tracking-wider text-slate-500"
                    >
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
                          name="member-ind-kpi-calc-type"
                          :value="t.code"
                          class="h-3.5 w-3.5 border-slate-300 text-slate-700 focus:ring-slate-400/40"
                        />
                        {{ t.label }}
                      </label>
                    </div>
                  </div>

                  <p
                    v-if="formErrors.calculationMethod"
                    class="mt-1 text-[10px] font-semibold text-rose-600"
                  >
                    {{ formErrors.calculationMethod }}
                  </p>
                </div>

                <p class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
                  Năm đánh giá KPI:
                  <span class="font-bold text-slate-800">{{ cycleYearNumFallback }}</span>
                  (theo năm đang chọn trên dashboard)
                </p>

                <!-- Row 4: Quy tắc chấm điểm -->
                <div>
                  <div class="mb-1.5 flex items-center gap-1.5">
                    <label class="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Quy tắc chấm điểm <span class="text-rose-500">*</span>
                    </label>
                    <ScoringRulesHelpTooltip aria-label="Ví dụ cú pháp quy tắc chấm điểm" />
                  </div>
                  
                  <textarea
                    v-model="description"
                    rows="6"
                    placeholder="1: <50&#10;2: 50-70&#10;3: 71-85&#10;4: 86-99&#10;5: >=100"
                    class="custom-scrollbar min-h-[7.5rem] w-full resize-y rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none transition-all focus:ring-2"
                    :class="formErrors.scoringRules ? '!border-rose-400 !bg-rose-50/70 focus:border-rose-400 focus:ring-rose-100' : 'input-required focus:border-blue-400 focus:ring-blue-100'"
                  />
                  <p v-if="formErrors.scoringRules" class="mt-1 text-[10px] font-semibold text-rose-600">
                    {{ formErrors.scoringRules }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div
            class="z-10 flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white p-5 shadow-sm"
          >
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
              :disabled="saving || isLoadingMeta || !kpiCategories.length"
              @click="save"
            >
              <i
                v-if="saving"
                class="fas fa-spinner fa-spin text-sm"
                aria-hidden="true"
              />
              <i v-else class="fas fa-save text-sm" aria-hidden="true" />
              {{ saving ? 'Đang lưu...' : (isEditMode ? 'Cập nhật KPI' : 'Tạo KPI') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Dùng chung tên class transition với GmCreateStrategicKpiModal */
.gm-kpi-drawer-enter-active,
.gm-kpi-drawer-leave-active {
  transition-duration: 0.28s;
}
.gm-kpi-drawer-enter-active .gm-kpi-drawer-backdrop,
.gm-kpi-drawer-leave-active .gm-kpi-drawer-backdrop {
  transition: opacity 0.28s ease;
}
.gm-kpi-drawer-enter-active .gm-kpi-drawer-panel,
.gm-kpi-drawer-leave-active .gm-kpi-drawer-panel {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.gm-kpi-drawer-enter-from .gm-kpi-drawer-backdrop,
.gm-kpi-drawer-leave-to .gm-kpi-drawer-backdrop {
  opacity: 0;
}
.gm-kpi-drawer-enter-to .gm-kpi-drawer-backdrop,
.gm-kpi-drawer-leave-from .gm-kpi-drawer-backdrop {
  opacity: 1;
}
.gm-kpi-drawer-enter-from .gm-kpi-drawer-panel,
.gm-kpi-drawer-leave-to .gm-kpi-drawer-panel {
  transform: translateX(100%);
}
.gm-kpi-drawer-enter-to .gm-kpi-drawer-panel,
.gm-kpi-drawer-leave-from .gm-kpi-drawer-panel {
  transform: translateX(0);
}

@media (prefers-reduced-motion: reduce) {
  .gm-kpi-drawer-enter-active,
  .gm-kpi-drawer-leave-active,
  .gm-kpi-drawer-enter-active .gm-kpi-drawer-backdrop,
  .gm-kpi-drawer-leave-active .gm-kpi-drawer-backdrop,
  .gm-kpi-drawer-enter-active .gm-kpi-drawer-panel,
  .gm-kpi-drawer-leave-active .gm-kpi-drawer-panel {
    transition-duration: 0.01ms !important;
  }
  .gm-kpi-drawer-enter-from .gm-kpi-drawer-panel,
  .gm-kpi-drawer-leave-to .gm-kpi-drawer-panel {
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
.input-required:disabled {
  cursor: not-allowed;
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
