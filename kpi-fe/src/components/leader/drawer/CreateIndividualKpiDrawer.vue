<script setup lang="ts">
import {computed, nextTick, ref, watch} from 'vue'
import type { LeaderKpiAssignment } from '@/types/kpi'
import {gmKpiService} from '@/services/modules/kpi-gm.service'
import {kpiCycleService} from '@/services/shared/kpi-cycle.service'
import {useGmKpiCategoryOptions} from '@/composables/useGmKpiCategoryOptions'
import {useKpiCalculationReference} from '@/composables/useKpiCalculationReference'
import {useKpiUnitOptions} from '@/composables/useKpiUnitOptions'
import {persistedCalculationMethodFromTypeAndRule} from '@/utils/kpiCalculationCodes'
import {kpiFormUnitToUnitCode} from '@/utils/kpiUnitCodes'
import ScoringRulesHelpTooltip from '@/components/kpi/ScoringRulesHelpTooltip.vue'
import {
  buildScoringRulesPayload,
  extractRawInputFromApiTargetDescription,
  validateScoringRulesDsl,
} from '@/utils/kpiScoringRulesDsl'

const open = defineModel<boolean>({default: false})

const props = withDefaults(
    defineProps<{
      cycleYear: string
      editItem?: LeaderKpiAssignment | null
    }>(),
    {
      cycleYear: '',
      editItem: null,
    },
)

const emit = defineEmits<{
  saved: [response: any]
}>()

const {
  categories: kpiCategories,
  loading: loadingCategories,
  error: errorCategories,
  load: loadKpiCategories
} = useGmKpiCategoryOptions()
const {
  calcRulesWithTypes,
  loading: loadingRules,
  error: errorRules,
  load: loadCalculationReference
} = useKpiCalculationReference()
const {options: kpiUnitOptions, loading: loadingUnits, error: errorUnits, load: loadKpiUnits} = useKpiUnitOptions()

// --- State mới để lưu ID chu kỳ từ API ---
const realCycleId = ref<string>('')
const loadingCycle = ref(false)
const errorCycle = ref<string | null>(null)

const isLoadingMeta = computed(() => loadingCategories.value || loadingRules.value || loadingUnits.value || loadingCycle.value)
const metaLoadError = computed(() => {
  const errs = [errorCategories.value, errorRules.value, errorUnits.value, errorCycle.value].filter(Boolean)
  return errs.length > 0 ? errs.join(' | ') : null
})

const categoryId = ref<string>('')
const kpiName = ref('')
const description = ref('')
const targetInput = ref<string>('')
const weightInput = ref<string>('')
const unit = ref<string>('MM')

const calculationRuleCode = ref<number>(802)
const calculationTypeCode = ref<number | null>(701)
const isEditMode = computed(() => String(props.editItem?.kpiInformationId ?? '').trim().length > 0)
const editingKpiInformationId = computed(() => String(props.editItem?.kpiInformationId ?? '').trim())

const typesForSelectedRule = computed(() =>
    calcRulesWithTypes.value.find((row) => row.code === calculationRuleCode.value)?.calcTypes ?? []
)

function clampCalculationTypeToRule() {
  const types = typesForSelectedRule.value
  if (!types.length) {
    calculationTypeCode.value = null
    return
  }
  const cur = calculationTypeCode.value
  if (cur != null && types.some((t) => t.code === cur)) return
  calculationTypeCode.value = types[0]!.code
}

watch(calculationRuleCode, () => clampCalculationTypeToRule())

watch(calcRulesWithTypes, (rows) => {
  if (!rows.length) return
  if (!rows.some((r) => r.code === calculationRuleCode.value)) {
    calculationRuleCode.value = rows[0]!.code
  }
  clampCalculationTypeToRule()
}, {deep: true})

const cycleYearNumFallback = computed(() => {
  const n = Number.parseInt(props.cycleYear, 10)
  return Number.isFinite(n) ? n : new Date().getFullYear()
})

async function loadFormMeta() {
  loadingCycle.value = true
  errorCycle.value = null

  try {
    const [cycleData] = await Promise.all([
      kpiCycleService.getKpiCycleByYear(cycleYearNumFallback.value), // Gọi API truyền năm
      loadKpiCategories(),
      loadCalculationReference(),
      loadKpiUnits()
    ])
    realCycleId.value = cycleData.id // Lưu trữ UUID của cycle
  } catch (err: any) {
    console.error('Lỗi khi lấy thông tin chu kỳ KPI:', err)
    errorCycle.value = 'Không lấy được thông tin chu kỳ KPI năm nay.'
    realCycleId.value = ''
  } finally {
    loadingCycle.value = false
  }

  if (!categoryId.value && kpiCategories.value.length) {
    categoryId.value = kpiCategories.value[0].id
  }
}

watch(open, (v) => {
  if (v) {
    resetForm()
    loadFormMeta().then(() => hydrateFormForEdit())
  }
})

watch(() => props.cycleYear, () => {
  if (open.value) resetForm()
})

function resetForm() {
  kpiName.value = ''
  description.value = ''
  targetInput.value = ''
  weightInput.value = ''
  categoryId.value = ''
  unit.value = 'MM'
  calculationRuleCode.value = 802
  calculationTypeCode.value = 701
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
  const hit = kpiCategories.value.find((opt) => {
    const label = String(opt.name ?? '').trim().toLowerCase()
    const value = String(opt.id ?? '').trim().toLowerCase()
    return label === norm || value === norm
  })
  return hit?.id ?? null
}

function hydrateFormForEdit() {
  const item = props.editItem
  if (!item || !isEditMode.value) return
  const mappedPerspectiveByName = findPerspectiveOptionByName(String(item.categoryName ?? ''))
  const categoryIdRaw = String(item.categoryId ?? '').trim()
  categoryId.value = categoryIdRaw || mappedPerspectiveByName || (kpiCategories.value[0]?.id ?? '')
  kpiName.value = String(item.kpiName ?? '').trim()
  targetInput.value = String(item.targetValue ?? '')
  weightInput.value = String(item.weight ?? '')
  calculationRuleCode.value = Number(item.calculationRuleCode ?? 802)
  calculationTypeCode.value = Number(item.calculationTypeCode ?? 701)
  const rawRules = extractRawInputFromApiTargetDescription(item.targetDescription ?? '')
  description.value = rawRules
  const mappedUnit = findUnitOptionByAnyLabel(String(item.unitName ?? ''))
  unit.value = mappedUnit ?? 'MM'
}

function close() {
  open.value = false
}

const saving = ref(false)
const formErrors = ref<Record<string, string>>({})
const errorBannerRef = ref<HTMLElement | null>(null)

function clearFormErrors() {
  formErrors.value = {}
}

function validateForm(): boolean {
  clearFormErrors()
  const err: Record<string, string> = {}

  if (!realCycleId.value) {
    err.apiError = 'Không tìm thấy ID của chu kỳ đánh giá hợp lệ. Vui lòng thử lại sau.'
  }

  if (!kpiName.value.trim()) {
    err.kpiName = 'Vui lòng nhập tên KPI.'
  }

  const tvRaw = targetInput.value
  const tvStr = String(tvRaw ?? '').trim()
  if (tvStr === '' || Number.isNaN(Number(tvRaw))) {
    err.targetInput = 'Nhập mục tiêu (số).'
  } else if (Number(tvRaw) < 0) {
    err.targetInput = 'Mục tiêu phải >= 0.'
  }

  const wStr = String(weightInput.value).trim()
  const wNum = Number.parseFloat(wStr)
  if (!wStr) {
    err.weightInput = 'Nhập trọng số (W).'
  } else if (!Number.isFinite(wNum) || wNum <= 0 || wNum > 100) {
    err.weightInput = 'Trọng số phải lớn hơn 0 và tối đa 100.'
  }

  if (!categoryId.value.trim()) {
    err.categoryId = 'Chọn Perspective (nhóm KPI).'
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
    errorBannerRef.value?.scrollIntoView({behavior: 'smooth', block: 'nearest'})
    return
  }

  saving.value = true
  try {
    const wNum = Number.parseFloat(String(weightInput.value).trim())
    let existingMemberIds: string[] = []
    if (isEditMode.value) {
      const existing = await gmKpiService.getStrategicKpiForEdit(editingKpiInformationId.value)
      existingMemberIds = Array.isArray(existing.memberIds)
        ? existing.memberIds.map((x) => String(x))
        : []
    }

    const requestBody = {
      cycleId: realCycleId.value, // <--- Dùng ID thật lấy từ API
      typeCode: Number(props.editItem?.typeCode ?? 101),
      perspective: categoryId.value.trim(),
      kpiName: kpiName.value.trim(),
      targetDescription: buildScoringRulesPayload(description.value),
      targetValue: Number.parseFloat(String(targetInput.value).trim()),
      unit: unit.value,
      unitCode: kpiFormUnitToUnitCode(unit.value),
      weightPct: wNum,
      calculationMethod: persistedCalculationMethodFromTypeAndRule(calculationTypeCode.value, calculationRuleCode.value),
      isImportant: false,
      assignPMs: [],
      pmTargets: {},
      memberIds: isEditMode.value ? existingMemberIds : [],
      editingKpiInformationId: editingKpiInformationId.value || null
    };

    const response = isEditMode.value
      ? await gmKpiService.updateStrategicKpi(editingKpiInformationId.value, requestBody)
      : await gmKpiService.createStrategicKpi(requestBody)

    emit('saved', response)
    open.value = false
  } catch (e: any) {
    formErrors.value = {apiError: e?.response?.data?.message || 'Có lỗi xảy ra khi tạo KPI trên máy chủ.'}
    await nextTick()
    errorBannerRef.value?.scrollIntoView({behavior: 'smooth', block: 'nearest'})
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="ind-kpi-drawer">
      <div v-if="open" class="fixed inset-0 z-[100]" role="dialog" aria-modal="true"
           aria-labelledby="ind-create-kpi-title">
        <div class="ind-kpi-drawer-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
             @click="close"/>

        <div
            class="ind-kpi-drawer-panel absolute bottom-0 right-0 top-0 flex w-full max-w-full flex-col border-l border-slate-200 bg-slate-50 shadow-2xl md:max-w-[700px] lg:max-w-[800px]">
          <div class="z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 id="ind-create-kpi-title" class="flex items-center gap-2 text-lg font-bold text-slate-800">
                <span class="rounded-lg bg-blue-100 p-1.5 text-blue-700 shadow-sm"><i class="fas fa-crosshairs text-sm"
                                                                                      aria-hidden="true"/></span> Tạo
                {{ isEditMode ? 'Chỉnh sửa KPI' : 'Tạo KPI' }}
              </h2>
            </div>
            <button type="button"
                    class="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
                    aria-label="Đóng" @click="close">
              <i class="fas fa-times text-base" aria-hidden="true"/>
            </button>
          </div>

          <div class="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-6">
            <div v-if="metaLoadError"
                 class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900" role="alert">
              {{ metaLoadError }}
            </div>

            <div v-if="Object.keys(formErrors).length > 0" id="ind-create-kpi-errors" ref="errorBannerRef"
                 class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900 shadow-sm"
                 role="alert">
              <p class="mb-2 flex items-center gap-2 font-bold">
                <i class="fas fa-circle-exclamation text-rose-600" aria-hidden="true"/> Vui lòng sửa các lỗi sau trước
                khi {{ isEditMode ? 'cập nhật KPI' : 'tạo KPI' }}.
              </p>
              <ul class="list-inside list-disc space-y-0.5 text-[11px] font-semibold text-rose-800">
                <li v-for="(msg, key) in formErrors" :key="key">{{ msg }}</li>
              </ul>
            </div>

            <div class="ind-kpi-section-card rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <label class="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-800">
                <span class="rounded-lg bg-slate-100 p-1.5 text-indigo-600"><i class="fas fa-file-lines text-sm"
                                                                               aria-hidden="true"/></span> Thông tin cơ
                bản &amp; phân loại
              </label>

              <div class="space-y-4">
                <div class="flex flex-col gap-3 sm:flex-row">
                  <div class="sm:w-2/5">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Perspective
                      (BSC) <span class="text-rose-500">*</span></label>
                    <div class="relative">
                      <select v-model="categoryId"
                              class="input-required w-full cursor-pointer appearance-none rounded-md py-2 pl-3 pr-8 text-xs font-bold text-slate-800 outline-none transition-all disabled:opacity-60"
                              :disabled="isLoadingMeta || !kpiCategories.length">
                        <option value="" disabled>- Chọn nhóm -</option>
                        <option v-for="c in kpiCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
                      </select>
                      <i class="fas fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                         aria-hidden="true"/>
                    </div>
                    <p v-if="formErrors.categoryId" class="mt-1 text-[10px] font-semibold text-rose-600">
                      {{ formErrors.categoryId }}</p>
                  </div>
                  <div class="min-w-0 sm:flex-1">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">KPI Name
                      <span class="text-rose-500">*</span></label>
                    <input v-model="kpiName" type="text" placeholder="Ví dụ: Hoàn thành khóa đào tạo nội bộ"
                           class="input-required w-full rounded-md px-3 py-2 text-xs font-bold text-slate-800 outline-none transition-all"
                           :class="formErrors.kpiName ? '!border-rose-400 !bg-rose-50/50' : ''"/>
                    <p v-if="formErrors.kpiName" class="mt-1 text-[10px] font-semibold text-rose-600">
                      {{ formErrors.kpiName }}</p>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-x-6">
                  <div class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Target <span class="text-rose-500">*</span></label>
                    <input
                      v-model="targetInput"
                      type="number"
                      placeholder="95"
                      min="0"
                      class="input-required min-h-[38px] w-full rounded-md px-2.5 py-2 text-xs font-bold text-slate-800 outline-none transition-all"
                      :class="formErrors.targetInput ? '!border-rose-400 !bg-rose-50/50' : ''"
                    />
                    <p v-if="formErrors.targetInput" class="mt-1 text-[10px] font-semibold text-rose-600">
                      {{ formErrors.targetInput }}</p>
                  </div>

                  <div class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Trọng số
                      (W) <span class="text-rose-500">*</span></label>
                    <div class="relative">
                      <input v-model="weightInput" type="number" placeholder="10" min="0" max="100" step="1"
                             class="input-required min-h-[38px] w-full rounded-md py-2 pl-2.5 pr-8 text-xs font-bold text-slate-800 outline-none transition-all"
                             :class="formErrors.weightInput ? '!border-rose-400 !bg-rose-50/50' : ''"/>
                      <span
                          class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-blue-400">%</span>
                    </div>
                    <p v-if="formErrors.weightInput" class="mt-1 text-[10px] font-semibold text-rose-600">
                      {{ formErrors.weightInput }}</p>
                  </div>
                  <div class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Unit <span
                        class="text-rose-500">*</span></label>
                    <div class="relative">
                      <select v-model="unit"
                              class="input-required min-h-[38px] w-full cursor-pointer appearance-none rounded-md py-2 pl-2.5 pr-7 text-xs font-bold text-slate-800 outline-none transition-all disabled:opacity-60"
                              :disabled="isLoadingMeta">
                        <option v-for="u in kpiUnitOptions" :key="u.value" :value="u.value">{{ u.label }}</option>
                      </select>
                      <i class="fas fa-chevron-down pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                         aria-hidden="true"/>
                    </div>
                  </div>
                </div>

                <div>
                  <div class="mb-1.5 flex items-center gap-1.5">
                    <label class="block flex-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Phân loại cách tính <span class="text-rose-500">*</span>
                    </label>
                  </div>
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
                    <div class="relative min-w-0 w-full sm:flex-[1.35]">
                      <select
                          v-model.number="calculationRuleCode"
                          class="input-required min-h-[38px] w-full cursor-pointer appearance-none rounded-md py-2 pr-7 text-xs font-bold text-slate-800 outline-none transition-all disabled:opacity-60"
                          :class="[typesForSelectedRule.length > 1 ? 'pl-8' : 'pl-2.5', formErrors.calculationMethod ? '!border-rose-400 !bg-rose-50/50' : '']"
                          :disabled="isLoadingMeta"
                      >
                        <option v-for="row in calcRulesWithTypes" :key="row.code" :value="row.code" :title="row.label">
                          {{ row.label }}
                        </option>
                      </select>
                      <i v-if="typesForSelectedRule.length > 1"
                         class="fas fa-calculator pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                         aria-hidden="true"/>
                      <i class="fas fa-chevron-down pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                         aria-hidden="true"/>
                    </div>
                    <div v-if="typesForSelectedRule.length > 1"
                         class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-slate-200/90 bg-slate-50/70 px-2.5 py-2">
                      <label v-for="t in typesForSelectedRule" :key="t.code"
                             class="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                        <input v-model.number="calculationTypeCode" type="radio" :value="t.code"
                               class="h-3.5 w-3.5 border-slate-300 text-slate-700 focus:ring-slate-400/40"/>
                        {{ t.label }}
                      </label>
                    </div>
                  </div>
                  <p v-if="formErrors.calculationMethod" class="mt-1 text-[10px] font-semibold text-rose-600">
                    {{ formErrors.calculationMethod }}</p>
                </div>

                <p class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
                  Năm đánh giá KPI:
                  <span class="font-bold text-slate-800">{{ cycleYearNumFallback }}</span>
                  (theo năm đang chọn trên dashboard)
                </p>

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

          <div class="z-10 flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white p-5 shadow-sm">
            <button type="button"
                    class="rounded-lg border border-slate-200 bg-white px-5 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-100"
                    @click="close">Hủy
            </button>
            <button type="button"
                    class="flex items-center gap-1.5 rounded-lg bg-blue-600 px-6 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
                    :disabled="saving || isLoadingMeta || !kpiCategories.length" @click="save">
              <i v-if="saving" class="fas fa-spinner fa-spin text-sm" aria-hidden="true"/>
              <i v-else class="fas fa-save text-sm" aria-hidden="true"/>
              {{ saving ? 'Đang lưu...' : (isEditMode ? 'Cập nhật KPI' : 'Tạo KPI') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Giữ nguyên toàn bộ CSS cũ */
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
  transition: border-color 0.15s ease,
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