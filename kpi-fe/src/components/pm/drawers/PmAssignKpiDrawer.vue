<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { KpiPmService } from '@/services/modules/kpi-pm.service'
import { gmKpiService } from '@/services/modules/kpi-gm.service'
import type { PmMemberOption, SysStatusCode, KpiCycle } from '@/types/kpi'
import { generateInitials } from '@/utils/common'
import { KPI_TYPE, CALC_RULE, CALC_TYPE } from '@/config/constants'
import { persistedCalculationMethodFromTypeAndRule } from '@/utils/kpiCalculationCodes'

// --- INTERFACES ---
interface KpiCategory {
  id: string;
  name: string;
}

// --- PROPS & EMITS ---
const props = defineProps({
  open: { type: Boolean, default: false },
  kpi: { type: Object, default: null }, // Mapped từ kpiLibrary
  mode: { type: String, default: 'assign' } // 'assign' | 'create'
})

const emit = defineEmits(['close', 'save', 'refresh'])

// --- COMPUTED STATES ---
const isCreate = computed(() => props.mode === 'create')

// --- API DATA STATES ---
const isLoadingInit = ref(false)
const initData = ref<any>(null)
const memberOptions = ref<PmMemberOption[]>([])
const unitOptions = ref<SysStatusCode[]>([])
const calcRuleOptions = ref<SysStatusCode[]>([])
const kpiTypeOptions = ref<SysStatusCode[]>([])
const calcTypeOptions = ref<SysStatusCode[]>([])
const categoryOptions = ref<KpiCategory[]>([])
const activeCycle = ref<KpiCycle | null>(null)

// --- FORM STATES (Mapped to DB) ---
const categoryId = ref<string>('') 
const typeCode = ref<number>(KPI_TYPE.INDIVIDUAL)
const kpiName = ref('')
const description = ref('')
const targetValue = ref('')
const weightPct = ref('')
const unitCode = ref<number | null>(null)
const formCycleId = ref<string>('') 
const isImportantKpi = ref(false)
const calculationRuleCode = ref<number | null>(null)
const calculationTypeCode = ref<number | null>(null)

// --- ASSIGN STATES (PM's Members) ---
const assignDropdown = ref<'member' | null>(null)
const assignMemberSurfaceRef = ref<HTMLElement | null>(null)
const memberAssignSearch = ref('')
const selectedMembers = ref<string[]>([])
const memberTargets = ref<Record<string, string>>({})

// --- COMPUTEDS FOR UI & PERFORMANCE ---
// Use Map for O(1) lookups instead of repeated Array.find()
const memberMap = computed(() => {
  return memberOptions.value.reduce((map, member) => {
    map.set(member.id, member)
    return map
  }, new Map<string, PmMemberOption>())
})

const filteredMemberOptions = computed(() => {
  const query = memberAssignSearch.value.trim().toLowerCase()
  if (!query) return memberOptions.value
  
  return memberOptions.value.filter((m) => 
    `${m.shortName} ${m.departmentName} ${m.rankCode} ${m.fullName}`.toLowerCase().includes(query)
  )
})

const getMemberShort = (id: string) => memberMap.value.get(id)?.shortName ?? id
const getMemberLabel = (id: string) => memberMap.value.get(id)?.fullName ?? id

// --- CSS CLASS COMPUTEDS ---
const inputBaseClasses = 'w-full rounded-md outline-none transition-all text-xs font-bold'
const inputStateClasses = computed(() => 
  isCreate.value 
    ? 'input-required text-slate-800' 
    : 'bg-slate-100 border border-slate-200 text-slate-600 cursor-not-allowed'
)

const typeCardClass = (code: number) => {
  const isSelected = typeCode.value === code
  const isPromotion = code === KPI_TYPE.PROMOTION
  
  const baseClasses = 'relative flex flex-col items-start p-3 rounded-lg border text-left transition-all'
  const cursorClasses = isCreate.value ? 'cursor-pointer hover:border-blue-300' : 'cursor-not-allowed opacity-60'
  
  if (isSelected) {
    const selectedColorClass = isPromotion ? 'border-purple-500 bg-purple-50' : 'border-blue-500 bg-blue-50'
    return `${baseClasses} ${cursorClasses} ${selectedColorClass}`
  }
  
  return `${baseClasses} ${cursorClasses} border-slate-200 bg-white`
}

// --- METHODS ---
const toggleMember = (id: string) => {
  const index = selectedMembers.value.indexOf(id)
  if (index === -1) {
    selectedMembers.value.push(id)
    if (!(id in memberTargets.value)) memberTargets.value[id] = ''
  } else {
    selectedMembers.value.splice(index, 1)
    delete memberTargets.value[id]
  }
}

const fetchInitData = async () => {
  try {
    isLoadingInit.value = true
    const data: any = await KpiPmService.getRegistrationInitData()
    initData.value = data
    
    categoryOptions.value = data.categories || []
    kpiTypeOptions.value = data.kpiTypes || []
    calcRuleOptions.value = data.calcRules || []
    unitOptions.value = data.units || []
    calcTypeOptions.value = data.calcTypes || []
    
    activeCycle.value = data.activeCycle || null
    if (activeCycle.value) formCycleId.value = activeCycle.value.id
    
    memberOptions.value = data.teamMembers || []

    // Set defaults if form is empty
    if (categoryOptions.value.length && !categoryId.value) categoryId.value = categoryOptions.value[0].id
    if (calcRuleOptions.value.length && !calculationRuleCode.value) calculationRuleCode.value = calcRuleOptions.value[0].code
    if (unitOptions.value.length && !unitCode.value) unitCode.value = unitOptions.value[0].code
  } catch (error) {
    console.error('Lỗi tải dữ liệu khởi tạo', error)
  } finally {
    isLoadingInit.value = false
  }
}

const resetFormFields = () => {
  if (isCreate.value) {
    categoryId.value = categoryOptions.value[0]?.id ?? ''
    typeCode.value = KPI_TYPE.TEAM
    kpiName.value = ''
    weightPct.value = ''
    targetValue.value = ''
    description.value = ''
    isImportantKpi.value = false
    unitCode.value = unitOptions.value[0]?.code ?? null
    calculationRuleCode.value = calcRuleOptions.value[0]?.code ?? null
  } else if (props.kpi) {
    categoryId.value = props.kpi.categoryId || ''
    typeCode.value = props.kpi.typeCode || KPI_TYPE.INDIVIDUAL
    kpiName.value = props.kpi.name || ''
    weightPct.value = props.kpi.weight || ''
    targetValue.value = props.kpi.targetValue || ''
    description.value = props.kpi.description || ''
    isImportantKpi.value = props.kpi.isImportant || false
    unitCode.value = props.kpi.unitCode || null
    calculationRuleCode.value = props.kpi.calculationRuleCode || null
  }
  
  selectedMembers.value = []
  memberTargets.value = {}
  formErrors.value = {}
}

const onDocClick = (e: MouseEvent) => {
  const target = e.target as Node
  if (assignDropdown.value === 'member' && assignMemberSurfaceRef.value && !assignMemberSurfaceRef.value.contains(target)) {
    assignDropdown.value = null
  }
}

const fetchKpiDetail = async (kpiId: string) => {
  try {
    isLoadingInit.value = true
    const detailData = await KpiPmService.getKpiDetail(kpiId)
    
    // Fill vào các Form States
    categoryId.value = detailData.perspective || ''
    typeCode.value = detailData.typeCode || KPI_TYPE.INDIVIDUAL
    kpiName.value = detailData.kpiName || ''
    description.value = detailData.targetDescription || ''
    
    targetValue.value = detailData.targetValue != null ? String(detailData.targetValue) : ''
    weightPct.value = detailData.weightPct != null ? String(detailData.weightPct) : ''
    
    unitCode.value = detailData.unitCode || null
    isImportantKpi.value = detailData.isImportant || false

    // Phân giải calculationMethod ra Code
    if (detailData.calculationMethod) {
      switch (detailData.calculationMethod) {
        case "manual_member_input": calculationRuleCode.value = 803; calculationTypeCode.value = 703; break;
        case "mean_actual_plan": calculationRuleCode.value = 802; calculationTypeCode.value = 701; break;
        case "mean_plan_actual": calculationRuleCode.value = 802; calculationTypeCode.value = 702; break;
        case "mean_plan_actual_sum": calculationRuleCode.value = 801; calculationTypeCode.value = null; break;
        default: calculationRuleCode.value = 802; calculationTypeCode.value = 701; break;
      }
    }

    selectedMembers.value = detailData.memberIds || []
    memberTargets.value = detailData.memberTargets || {}
    formErrors.value = {}
  } catch (error) {
    console.error('Error when getting KPI detail:', error)
    resetFormFields()
  } finally {
    isLoadingInit.value = false
  }
}

// --- WATCHERS ---
watch(assignDropdown, (val) => { 
  if (val !== 'member') memberAssignSearch.value = '' 
})

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    await fetchInitData()

    if (!isCreate.value && props.kpi?.id) {
      await fetchKpiDetail(props.kpi.infoId)
    } else {
      resetFormFields()
    }

    window.addEventListener('click', onDocClick)
  } else {
    window.removeEventListener('click', onDocClick)
  }
  document.body.style.overflow = isOpen ? 'hidden' : ''
}, { immediate: true })

watch(typeCode, (newVal) => {
  if (newVal !== KPI_TYPE.TEAM) targetValue.value = ''
})

watch(calculationRuleCode, (newVal) => {
  if (newVal !== CALC_RULE.AVERAGE) {
    calculationTypeCode.value = null
  } else if (!calculationTypeCode.value && calcTypeOptions.value.length > 0) {
    calculationTypeCode.value = calcTypeOptions.value[0].code
  }
})

// --- LIFECYCLE ---
onUnmounted(() => { 
  window.removeEventListener('click', onDocClick)
  document.body.style.overflow = '' 
})

// --- VALIDATION & SUBMIT ---
const saving = ref(false)
const formErrors = ref<Record<string, string>>({})
const errorBannerRef = ref<HTMLElement | null>(null)

const validateForm = (): boolean => {
  formErrors.value = {}

  if (isCreate.value) {
    if (!kpiName.value.trim()) formErrors.value.kpiName = 'Vui lòng nhập tên KPI.'
    if (!weightPct.value) formErrors.value.weightPct = 'Vui lòng nhập trọng số.'
    if (typeCode.value === KPI_TYPE.TEAM && !targetValue.value) formErrors.value.targetValue = 'Vui lòng nhập chỉ tiêu tổng (Team Target).'
    if (!unitCode.value) formErrors.value.unitCode = 'Vui lòng chọn đơn vị tính.'
    if (!calculationRuleCode.value) formErrors.value.calculationRuleCode = 'Vui lòng chọn quy tắc tính toán.'
    
    if (calculationRuleCode.value === CALC_RULE.AVERAGE && !calculationTypeCode.value) {
      formErrors.value.calculationTypeCode = 'Vui lòng chọn chiều hướng tính toán (Actual/Plan hay Plan/Actual).'
    }
  }

  return Object.keys(formErrors.value).length === 0
}

const registerKPI = async () => {
  const unitName = unitOptions.value.find(u => u.code === unitCode.value)?.name || 'MM'
    
  const payload: Record<string, unknown> = {
    typeCode: typeCode.value,
    perspective: categoryId.value,
    kpiName: isCreate.value ? kpiName.value : (props.kpi?.name || ''),
    targetDescription: description.value,
    targetValue: targetValue.value ? Number(targetValue.value) : null,
    unit: unitName,
    unitCode: unitCode.value,
    weightPct: String(weightPct.value),
    cycleId: formCycleId.value,
    calculationMethod: persistedCalculationMethodFromTypeAndRule(calculationTypeCode.value, calculationRuleCode.value),
    isImportant: isImportantKpi.value,
  }

  if (typeCode.value === KPI_TYPE.TEAM) {
    payload.assignPMs = selectedMembers.value
    payload.pmTargets = Object.fromEntries(
      Object.entries(memberTargets.value).map(([k, v]) => [k, String(v)])
    )
  } else if (typeCode.value === KPI_TYPE.INDIVIDUAL) {
    payload.memberIds = selectedMembers.value
    payload.ranks = []
    payload.rankMemberIds = {}
  } else {
    payload.memberIds = selectedMembers.value
  }

  if (!isCreate.value && props.kpi) {
    payload.editingKpiId = props.kpi.id
  }

  await gmKpiService.createStrategicKpi(payload as unknown as Record<string, unknown>)
}

const handleAssignMember = async () => {
  const cascadePayload = {
    kpiInformationId: props.kpi.infoId,
    cycleId: formCycleId.value,
    parentAssignmentId: props.kpi.id || null, // ID assignment của phòng ban (nếu có truyền từ Dashboard)
    memberTargets: {} as Record<string, number|null>
  }

  if (typeCode.value === KPI_TYPE.TEAM) {
    // Đối với KPI Team phân rã, mỗi người có 1 số target riêng
    cascadePayload.memberTargets = Object.fromEntries(
      Object.entries(memberTargets.value).map(([memberId, val]) => [memberId, Number(val)])
    )
  } else {
    const targetNum = null
    selectedMembers.value.forEach(mem => {
      cascadePayload.memberTargets[mem] = targetNum
    })
  }
  
  await KpiPmService.cascadeKpi(cascadePayload)
}

const handleSave = async () => {
  if (!validateForm()) {
    await nextTick()
    errorBannerRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    return
  }

  saving.value = true

  try {
    
    if (isCreate.value) {
      await registerKPI()
    } else {
      await handleAssignMember()
    }

    emit('refresh')
    emit('close')
  } catch (error) {
    console.error('Lỗi khi lưu KPI:', error)
    formErrors.value.api = 'Có lỗi xảy ra khi lưu KPI. Vui lòng thử lại.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="gm-kpi-drawer">
      <div v-if="open" class="fixed inset-0 z-[100]" role="dialog">
        <!-- Backdrop -->
        <div 
          class="gm-kpi-drawer-backdrop absolute inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer" 
          @click="$emit('close')" 
        />

        <!-- Drawer Panel -->
        <aside class="gm-kpi-drawer-panel absolute top-0 right-0 bottom-0 flex flex-col w-full max-w-full md:max-w-[700px] lg:max-w-[800px] bg-slate-50 border-l border-slate-200 shadow-2xl">
          
          <!-- Header -->
          <div class="z-10 flex shrink-0 items-center justify-between p-5 bg-white border-b border-slate-200 shadow-sm">
            <div>
              <h2 class="flex items-center gap-2 text-lg font-bold text-slate-800">
                <span class="p-1.5 rounded-lg bg-blue-100 text-blue-700 shadow-sm">
                  <i class="fas" :class="isCreate ? 'fa-plus' : 'fa-bullseye'" />
                </span>
                {{ isCreate ? 'Create Team KPI' : 'Assign KPI Target' }}
              </h2>
              <p class="mt-1 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                {{ isCreate ? 'Define a new KPI for your team' : 'Delegate to team members' }}
              </p>
            </div>
            <button 
              type="button" 
              class="p-2 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors" 
              @click="$emit('close')"
            >
              <i class="fas fa-times text-base" />
            </button>
          </div>

          <!-- Loading Overlay -->
          <div v-if="isLoadingInit" class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
            <i class="fas fa-spinner fa-spin mb-4 text-3xl text-blue-600" />
            <p class="text-sm font-semibold text-slate-600">Đang tải dữ liệu cấu hình...</p>
          </div>

          <!-- Content Body -->
          <div class="custom-scrollbar flex-1 p-6 space-y-6 overflow-y-auto" @click="assignDropdown = null">
            
            <!-- Error Banner -->
            <div 
              v-if="Object.keys(formErrors).length > 0" 
              ref="errorBannerRef" 
              class="px-4 py-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 shadow-sm"
            >
              <p class="mb-2 flex items-center gap-2 font-bold">
                <i class="fas fa-circle-exclamation text-rose-600" /> Vui lòng sửa các lỗi sau trước khi tiếp tục.
              </p>
              <ul class="list-inside list-disc space-y-0.5 text-[11px] font-semibold text-rose-800">
                <li v-for="(msg, key) in formErrors" :key="key">{{ msg }}</li>
              </ul>
            </div>

            <!-- Basic Info Section -->
            <div 
              class="gm-kpi-section-card p-5 rounded-xl border border-slate-200 shadow-sm transition-all" 
              :class="isCreate ? 'bg-white' : 'bg-slate-50/70 pointer-events-none opacity-90'"
            >
              <label class="mb-4 flex items-center gap-2 text-xs font-bold tracking-wide text-slate-800 uppercase">
                <span class="p-1.5 rounded-lg" :class="isCreate ? 'bg-slate-100 text-indigo-600' : 'bg-slate-200 text-slate-500'">
                  <i class="fas fa-file-lines text-sm" />
                </span>
                Thông tin cơ bản &amp; phân loại
              </label>
              
              <div class="space-y-4">
                <!-- Category & Name -->
                <div class="flex flex-col gap-3 sm:flex-row">
                  <div class="sm:w-1/3">
                    <label class="mb-1.5 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      Perspective (Danh mục) <span v-if="isCreate" class="text-rose-500">*</span>
                    </label>
                    <div class="relative">
                      <select 
                        v-model="categoryId" 
                        :disabled="!isCreate" 
                        class="min-h-[38px] py-2 pl-3 pr-8 appearance-none"
                        :class="[inputBaseClasses, inputStateClasses, isCreate ? 'cursor-pointer' : '']"
                      >
                        <option v-for="cat in categoryOptions" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
                      </select>
                      <i class="fas fa-chevron-down absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div class="min-w-0 sm:flex-1">
                    <label class="mb-1.5 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      KPI Name <span v-if="isCreate" class="text-rose-500">*</span>
                    </label>
                    <input 
                      v-model="kpiName" 
                      type="text" 
                      :disabled="!isCreate" 
                      placeholder="e.g. Tối ưu mã nguồn" 
                      class="px-3 py-2 min-h-[38px]"
                      :class="[inputBaseClasses, inputStateClasses, formErrors.kpiName ? '!bg-rose-50/50 !border-rose-400' : '']" 
                    />
                  </div>
                </div>

                <!-- KPI Type Selection -->
                <div>
                  <label class="mb-2 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                    Loại hình KPI (cách thức giao) <span v-if="isCreate" class="text-rose-500">*</span>
                  </label>
                  <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <!-- Team -->
                    <button type="button" :class="typeCardClass(KPI_TYPE.TEAM)" @click="isCreate ? typeCode = KPI_TYPE.TEAM : null">
                      <span class="absolute top-2.5 right-2.5 text-blue-600 transition-all" :class="typeCode === KPI_TYPE.TEAM ? 'scale-100 opacity-100' : 'scale-50 opacity-0'">
                        <i class="fas fa-check-circle text-base" />
                      </span>
                      <div class="mb-1.5 flex items-center gap-2">
                        <span class="p-1 rounded bg-slate-50 border border-slate-100"><i class="fas fa-code-branch text-xs text-blue-600" /></span>
                        <span class="text-xs font-bold text-slate-800">Team / Cascading</span>
                      </div>
                      <p class="text-[11px] font-medium leading-tight text-slate-500">Giao cho cấp dưới phân rã.</p>
                    </button>
                    <!-- Individual -->
                    <button type="button" :class="typeCardClass(KPI_TYPE.INDIVIDUAL)" @click="isCreate ? typeCode = KPI_TYPE.INDIVIDUAL : null">
                      <span class="absolute top-2.5 right-2.5 text-blue-600 transition-all" :class="typeCode === KPI_TYPE.INDIVIDUAL ? 'scale-100 opacity-100' : 'scale-50 opacity-0'">
                        <i class="fas fa-check-circle text-base" />
                      </span>
                      <div class="mb-1.5 flex items-center gap-2">
                        <span class="p-1 rounded bg-slate-50 border border-slate-100"><i class="fas fa-crosshairs text-xs text-slate-600" /></span>
                        <span class="text-xs font-bold text-slate-800">Individual KPI</span>
                      </div>
                      <p class="text-[11px] font-medium leading-tight text-slate-500">Giao hàng loạt cho Rank.</p>
                    </button>
                    <!-- Promotion -->
                    <button type="button" :class="typeCardClass(KPI_TYPE.PROMOTION)" @click="isCreate ? typeCode = KPI_TYPE.PROMOTION : null">
                      <span class="absolute top-2.5 right-2.5 text-purple-600 transition-all" :class="typeCode === KPI_TYPE.PROMOTION ? 'scale-100 opacity-100' : 'scale-50 opacity-0'">
                        <i class="fas fa-check-circle text-base" />
                      </span>
                      <div class="mb-1.5 flex items-center gap-2">
                        <span class="p-1 rounded bg-slate-50 border border-slate-100 shadow-sm"><i class="fas fa-user-plus text-xs text-purple-600" /></span>
                        <span class="text-xs font-bold text-slate-800">Promotion KPI</span>
                      </div>
                      <p class="text-[11px] font-medium leading-tight text-slate-500">Giao đích danh cá nhân.</p>
                    </button>
                  </div>
                </div>

                <!-- Important KPI Checkbox -->
                <div class="flex items-center gap-2 mb-2 px-2.5 py-1.5 w-max rounded-md border border-slate-200/90" :class="isCreate ? 'bg-slate-50/60' : 'bg-slate-100'">
                  <input 
                    id="pm-kpi-important" 
                    v-model="isImportantKpi" 
                    :disabled="!isCreate" 
                    type="checkbox" 
                    class="w-3.5 h-3.5 shrink-0 rounded border-slate-300 text-amber-500 focus:ring-amber-400/50 disabled:cursor-not-allowed disabled:opacity-60" 
                  />
                  <label for="pm-kpi-important" class="text-[11px] font-semibold text-slate-600" :class="isCreate ? 'cursor-pointer' : 'cursor-not-allowed'">
                    KPI quan trọng
                  </label>
                </div>

                <!-- Target & Weight -->
                <div class="grid grid-cols-1 gap-4" :class="typeCode === KPI_TYPE.TEAM ? 'sm:grid-cols-2 sm:gap-x-6' : ''">
                  <div v-if="typeCode === KPI_TYPE.TEAM" class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      Target (Team) <span v-if="isCreate" class="text-rose-500">*</span>
                    </label>
                    <input 
                      v-model="targetValue" 
                      :disabled="!isCreate" 
                      type="number" 
                      placeholder="e.g. 100" 
                      class="px-3 py-2 min-h-[38px]"
                      :class="[inputBaseClasses, inputStateClasses, formErrors.targetValue ? '!bg-rose-50/50 !border-rose-400' : '']" 
                    />
                  </div>
                  <div class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      Trọng số (Weight) <span v-if="isCreate" class="text-rose-500">*</span>
                    </label>
                    <div class="relative">
                      <input 
                        v-model="weightPct" 
                        :disabled="!isCreate" 
                        type="number" 
                        placeholder="20" 
                        class="py-2 pl-3 pr-8 min-h-[38px]"
                        :class="[inputBaseClasses, inputStateClasses, formErrors.weightPct ? '!bg-rose-50/50 !border-rose-400' : '']" 
                      />
                      <span class="absolute top-1/2 right-3 -translate-y-1/2 text-[10px] font-bold text-blue-400 pointer-events-none">%</span>
                    </div>
                  </div>
                </div>

                <!-- Unit & Cycle -->
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-6">
                  <div class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      Unit (Đơn vị) <span v-if="isCreate" class="text-rose-500">*</span>
                    </label>
                    <div class="relative">
                      <select 
                        v-model="unitCode" 
                        :disabled="!isCreate" 
                        class="py-2 pl-3 pr-8 min-h-[38px] appearance-none"
                        :class="[inputBaseClasses, inputStateClasses, isCreate ? 'cursor-pointer' : '', formErrors.unitCode ? '!border-rose-400' : '']"
                      >
                        <option v-for="u in unitOptions" :key="u.code" :value="u.code">{{ u.name }}</option>
                      </select>
                      <i class="fas fa-chevron-down absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  
                  <div class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      Năm đánh giá (Chu kỳ) <span class="text-rose-500">*</span>
                    </label>
                    <div class="relative w-full">
                      <input 
                        type="text" 
                        :value="activeCycle?.name || formCycleId" 
                        disabled 
                        class="w-full min-h-[38px] py-2 pl-3 pr-8 rounded-md bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600 appearance-none cursor-not-allowed outline-none transition-all" 
                      />
                      <i class="fas fa-lock absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <!-- Calculation Rule -->
                <div>
                  <div class="mb-1.5 flex items-center gap-1.5">
                    <label class="block flex-1 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      Quy tắc tổng hợp điểm <span v-if="isCreate" class="text-rose-500">*</span>
                    </label>
                  </div>

                  <div class="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
                    <div class="relative min-w-0 flex-1">
                      <select 
                        v-model="calculationRuleCode" 
                        :disabled="!isCreate" 
                        class="py-2 pl-8 pr-7 min-h-[38px] appearance-none"
                        :class="[inputBaseClasses, inputStateClasses, isCreate ? 'cursor-pointer' : '', formErrors.calculationRuleCode ? '!border-rose-400' : '']"
                      >
                        <option v-for="rule in calcRuleOptions" :key="rule.code" :value="rule.code" :title="rule.description">{{ rule.name }}</option>
                      </select>
                      <i class="fas fa-calculator absolute top-1/2 left-3 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none" />
                      <i class="fas fa-chevron-down absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none" />
                    </div>

                    <div 
                      v-if="calculationRuleCode === CALC_RULE.AVERAGE" 
                      class="flex flex-1 items-center gap-4 px-3 py-1.5 min-h-[38px] min-w-0 rounded-md border border-slate-200 transition-all" 
                      :class="[isCreate ? 'bg-white' : 'bg-slate-100', formErrors.calculationTypeCode ? '!border-rose-400' : '']"
                    >
                      <span class="text-[9px] font-bold tracking-wide text-slate-400 uppercase">Tỉ lệ</span>
                      
                      <label 
                        class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700" 
                        :class="isCreate ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'"
                      >
                        <input 
                          v-model="calculationTypeCode" 
                          :disabled="!isCreate" 
                          type="radio" 
                          :value="CALC_TYPE.ACTUAL_OVER_PLAN" 
                          class="w-3.5 h-3.5 border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60" 
                        />
                        Actual/Plan
                      </label>

                      <label 
                        class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700" 
                        :class="isCreate ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'"
                      >
                        <input 
                          v-model="calculationTypeCode" 
                          :disabled="!isCreate" 
                          type="radio" 
                          :value="CALC_TYPE.PLAN_OVER_ACTUAL" 
                          class="w-3.5 h-3.5 border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60" 
                        />
                        Plan/Actual
                      </label>
                    </div>
                  </div>
                </div>

                <!-- Description -->
                <div>
                  <label class="mb-1.5 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">Description</label>
                  <textarea 
                    v-model="description" 
                    :disabled="!isCreate" 
                    rows="2" 
                    placeholder="Ghi chú chi tiết mục tiêu..." 
                    class="custom-scrollbar w-full px-3 py-2 rounded-md border text-xs font-medium resize-none outline-none transition-all focus:ring-1" 
                    :class="isCreate ? 'bg-white border-slate-200 text-slate-800 focus:border-blue-400 focus:ring-blue-100' : 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'"
                  />
                </div>
              </div>
            </div>

            <!-- Assignment Section -->
            <div class="gm-kpi-section-card p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
              <label class="mb-4 flex items-center gap-2 text-xs font-bold tracking-wide text-slate-800 uppercase">
                <span class="p-1.5 rounded-lg bg-indigo-100 text-indigo-600">
                  <i class="fas fa-diagram-project text-sm" />
                </span>
                Phân bổ / Giao việc
              </label>

              <div>
                <label class="mb-2 block text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                  Assign To Team Members <span class="text-rose-500">*</span>
                </label>

                <!-- Custom Select Dropdown -->
                <div ref="assignMemberSurfaceRef" class="relative">
                  <button 
                    type="button" 
                    class="input-optional relative flex flex-wrap items-center gap-1.5 w-full min-h-[38px] py-1.5 pl-8 pr-7 rounded-md text-left text-xs font-bold text-slate-700 transition-all" 
                    @click.stop="assignDropdown = assignDropdown === 'member' ? null : 'member'"
                  >
                    <span v-if="selectedMembers.length === 0" class="w-full font-medium text-slate-400">Tìm và chọn thành viên trong Team...</span>
                    <span 
                      v-for="id in selectedMembers" 
                      :key="id" 
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 border border-blue-200 whitespace-nowrap text-[10px] font-bold text-blue-700 shadow-sm"
                    >
                      {{ getMemberShort(id) }}
                      <button 
                        type="button" 
                        class="p-0.5 rounded text-blue-600 hover:bg-blue-200/60 transition" 
                        @click.stop="toggleMember(id)"
                      >
                        <i class="fas fa-times text-[9px]" />
                      </button>
                    </span>
                  </button>
                  <i class="fas fa-user-plus absolute top-2.5 left-2.5 text-[10px] text-slate-400 pointer-events-none" />
                  <i class="fas fa-chevron-down absolute top-2.5 right-2.5 text-[10px] text-slate-400 pointer-events-none" />

                  <!-- Dropdown List -->
                  <div 
                    v-show="assignDropdown === 'member'" 
                    class="absolute left-0 z-50 mt-1 flex flex-col w-full max-h-72 rounded-lg bg-white border border-slate-200 shadow-xl overflow-hidden" 
                    @click.stop
                  >
                    <div class="sticky top-0 z-10 shrink-0 p-2 bg-slate-50 border-b border-slate-100" @click.stop>
                      <div class="relative">
                        <i class="fas fa-search absolute top-1/2 left-2.5 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none" />
                        <input 
                          v-model="memberAssignSearch" 
                          type="text" 
                          placeholder="Search by name, dept or rank..." 
                          class="w-full py-1.5 pl-8 pr-2 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-800 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                          @click.stop 
                        />
                      </div>
                    </div>
                    <div class="custom-scrollbar flex-1 p-1 overflow-y-auto">
                      <template v-if="filteredMemberOptions.length > 0">
                        <label 
                          v-for="m in filteredMemberOptions" 
                          :key="m.id" 
                          class="group flex items-center px-3 py-2 rounded-md border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <input 
                            type="checkbox" 
                            class="w-4 h-4 mt-0.5 mr-3 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                            :checked="selectedMembers.includes(m.id)" 
                            @change="toggleMember(m.id)" 
                          />
                          <div class="flex flex-1 items-center gap-3 min-w-0">
                            <div class="flex items-center justify-center w-8 h-8 shrink-0 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                              {{ generateInitials(m.fullName) }}
                            </div>
                            <div class="flex flex-col flex-1 min-w-0">
                              <span class="block text-sm font-bold leading-tight text-slate-700 group-hover:text-blue-600">{{ m.fullName }}</span>
                              <span class="mt-0.5 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                                {{ m.departmentName }} <span class="text-slate-400">•</span> <span class="text-indigo-500">{{ m.rankCode }}</span>
                              </span>
                            </div>
                          </div>
                        </label>
                      </template>
                      <p v-else class="px-3 py-4 text-center text-xs font-medium text-slate-500">Không có thành viên khớp bộ lọc.</p>
                    </div>
                  </div>
                </div>

                <!-- Specific Targets per Member -->
                <div v-if="selectedMembers.length > 0" class="mt-4 p-4 space-y-2 rounded-xl bg-blue-50/50 border border-blue-100 shadow-inner">
                  <p class="mb-2 flex items-center gap-1.5 text-[10px] font-bold text-blue-800 uppercase">
                    <i class="fas fa-crosshairs text-[10px]" /> Set Specific Targets for Members
                  </p>
                  <div 
                    v-for="mem in selectedMembers" 
                    :key="mem" 
                    class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 p-2.5 rounded-lg bg-white border border-slate-200 shadow-sm"
                  >
                    <span class="flex items-center gap-1.5 sm:w-1/2 text-[11px] font-bold text-slate-700 truncate">
                      <i class="fas fa-user text-[10px] text-slate-400" />
                      {{ getMemberLabel(mem) }}
                    </span>
                    <div class="flex items-center gap-2 sm:w-1/2">
                      <input 
                        v-model="memberTargets[mem]" 
                        type="number" 
                        placeholder="Nhập target giao cho user..." 
                        class="w-full px-2 py-1.5 rounded-md bg-white border border-slate-200 text-xs font-bold text-slate-800 outline-none transition-all focus:border-blue-400 focus:ring-1 focus:ring-blue-100" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="z-10 flex shrink-0 justify-end gap-3 p-5 bg-white border-t border-slate-200 shadow-sm">
            <button 
              type="button" 
              class="px-5 py-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-100 transition-colors" 
              @click="$emit('close')"
            >
              Cancel
            </button>
            <button 
              type="button" 
              class="flex items-center gap-1.5 px-6 py-2 rounded-lg bg-blue-600 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 transition-colors" 
              :disabled="saving" 
              @click="handleSave"
            >
              <i v-if="saving" class="fas fa-spinner fa-spin text-sm" />
              <i v-else class="fas" :class="isCreate ? 'fa-check' : 'fa-save'" />
              {{ saving ? 'Saving...' : (isCreate ? 'Create & Assign' : 'Assign KPI') }}
            </button>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* (Giữ nguyên các style cũ của bạn) */
.gm-kpi-drawer-enter-active, .gm-kpi-drawer-leave-active { transition-duration: 0.28s; }
.gm-kpi-drawer-enter-active .gm-kpi-drawer-backdrop, .gm-kpi-drawer-leave-active .gm-kpi-drawer-backdrop { transition: opacity 0.28s ease; }
.gm-kpi-drawer-enter-active .gm-kpi-drawer-panel, .gm-kpi-drawer-leave-active .gm-kpi-drawer-panel { transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1); }
.gm-kpi-drawer-enter-from .gm-kpi-drawer-backdrop, .gm-kpi-drawer-leave-to .gm-kpi-drawer-backdrop { opacity: 0; }
.gm-kpi-drawer-enter-from .gm-kpi-drawer-panel, .gm-kpi-drawer-leave-to .gm-kpi-drawer-panel { transform: translateX(100%); }
.input-required { background-color: rgba(239, 246, 255, 0.6); border: 1px solid #bfdbfe; }
.input-required:focus, .input-required:focus-within { background-color: #ffffff; border-color: #3b82f6; }
.input-optional { border: 1px solid #e2e8f0; background-color: #f8fafc; }
.input-optional:hover { border-color: #cbd5e1; background-color: #ffffff; }
.input-optional:focus-within { border-color: #3b82f6; background-color: #ffffff; }
.gm-kpi-section-card { transition: border-color 0.15s ease, box-shadow 0.15s ease; }
.gm-kpi-section-card:focus-within { border-color: #bfdbfe; box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.12); }
.custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
</style>
