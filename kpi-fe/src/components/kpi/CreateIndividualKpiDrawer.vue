<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { memberKpiService } from '@/services/modules/kpi-member.service'
import type { MemberKpiFormMeta } from '@/types/kpi'

/** Payload gửi parent → POST /kpi/member/individual-kpi */
export interface CreateIndividualKpiPayload {
  cycleYear: number
  kpiName: string
  description: string
  weight: number
  categoryId: string
  calculationRuleCode: number
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

const meta = ref<MemberKpiFormMeta | null>(null)
const metaLoadError = ref<string | null>(null)
const loadingMeta = ref(false)

const categoryId = ref<string>('')
/** CALC_RULE 801–804 — gán sau khi load meta */
const calculationRuleCode = ref<number>(801)
const kpiName = ref('')
const description = ref('')
const weightInput = ref<string>('')

const cycleYearNum = computed(() => {
  const n = Number.parseInt(String(props.cycleId).trim(), 10)
  return Number.isFinite(n) ? n : new Date().getFullYear()
})

const calcRuleOptions = computed(() => meta.value?.calcRules ?? [])

async function loadFormMeta() {
  loadingMeta.value = true
  metaLoadError.value = null
  try {
    meta.value = await memberKpiService.getFormMeta()
    const cats = meta.value.kpiCategories ?? []
    const rules = meta.value.calcRules ?? []
    if (!categoryId.value && cats.length) categoryId.value = cats[0].id
    if (rules.length) calculationRuleCode.value = rules[0].code
  } catch (e: unknown) {
    metaLoadError.value = e instanceof Error ? e.message : 'Không tải được danh mục KPI.'
    meta.value = null
  } finally {
    loadingMeta.value = false
  }
}

watch(open, (v) => {
  if (v) {
    resetForm()
    loadFormMeta()
  }
})

watch(
  () => props.cycleId,
  () => {
    if (open.value) resetForm()
  },
)

function resetForm() {
  kpiName.value = ''
  description.value = ''
  weightInput.value = ''
  categoryId.value = ''
  calculationRuleCode.value = 801
  clearFormErrors()
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

  if (!categoryId.value.trim()) {
    err.categoryId = 'Chọn Perspective (nhóm KPI).'
  }
  if (![801, 802, 803, 804].includes(calculationRuleCode.value)) {
    err.calculationRuleCode = 'Chọn phân loại cách tính.'
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
    const wNum = Number.parseFloat(String(weightInput.value).trim())
    const payload: CreateIndividualKpiPayload = {
      cycleYear: cycleYearNum.value,
      kpiName: kpiName.value.trim(),
      description: description.value.trim(),
      weight: wNum,
      categoryId: categoryId.value.trim(),
      calculationRuleCode: calculationRuleCode.value,
    }
    emit('saved', payload)
    open.value = false
  } finally {
    saving.value = false
  }
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
              v-if="metaLoadError"
              class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900"
              role="alert"
            >
              {{ metaLoadError }}
            </div>

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
                  <div class="sm:w-2/5">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Perspective (BSC) <span class="text-rose-500">*</span>
                    </label>
                    <div class="relative">
                      <select
                        v-model="categoryId"
                        class="input-required w-full cursor-pointer appearance-none rounded-md py-2 pl-3 pr-8 text-xs font-bold text-slate-800 outline-none transition-all disabled:opacity-60"
                        :disabled="loadingMeta || !(meta?.kpiCategories?.length)"
                      >
                        <option value="" disabled>— Chọn nhóm —</option>
                        <option
                          v-for="c in meta?.kpiCategories ?? []"
                          :key="c.id"
                          :value="c.id"
                        >
                          {{ c.name }}
                        </option>
                      </select>
                      <i
                        class="fas fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                        aria-hidden="true"
                      />
                    </div>
                    <p v-if="formErrors.categoryId" class="mt-1 text-[10px] font-semibold text-rose-600">
                      {{ formErrors.categoryId }}
                    </p>
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
                      Phân loại cách tính <span class="text-rose-500">*</span>
                    </label>
                    <div class="relative">
                      <select
                        v-model.number="calculationRuleCode"
                        class="input-required min-h-[38px] w-full cursor-pointer appearance-none rounded-md py-2 pl-2.5 pr-7 text-xs font-bold text-slate-800 outline-none transition-all disabled:opacity-60"
                        :disabled="loadingMeta || !calcRuleOptions.length"
                      >
                        <option
                          v-for="r in calcRuleOptions"
                          :key="r.code"
                          :value="r.code"
                          :title="r.description ?? r.name"
                        >
                          {{ r.code }} · {{ r.description ?? r.name }}
                        </option>
                      </select>
                      <i
                        class="fas fa-chevron-down pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                        aria-hidden="true"
                      />
                    </div>
                    <p v-if="formErrors.calculationRuleCode" class="mt-1 text-[10px] font-semibold text-rose-600">
                      {{ formErrors.calculationRuleCode }}
                    </p>
                  </div>
                </div>

                <p class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
                  Năm đánh giá KPI:
                  <span class="font-bold text-slate-800">{{ cycleYearNum }}</span>
                  (theo năm đang chọn trên dashboard)
                </p>

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
              :disabled="saving || loadingMeta || !meta?.kpiCategories?.length"
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
