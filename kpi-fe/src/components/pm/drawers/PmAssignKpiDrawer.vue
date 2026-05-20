<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { KpiPmService } from '@/services/modules/kpi-pm.service'
import { gmKpiService } from '@/services/modules/kpi-gm.service'
import type { PmMemberOption, SysStatusCode, KpiCycle } from '@/types/kpi'
import { generateInitials } from '@/utils/common'
import { KPI_TYPE, KPI_STATUS, CALC_RULE, CALC_TYPE } from '@/config/constants'
import { persistedCalculationMethodFromTypeAndRule } from '@/utils/kpiCalculationCodes'
import {
  buildScoringRulesPayload,
  extractRawInputFromApiTargetDescription,
  validateScoringRulesDsl,
} from '@/utils/kpiScoringRulesDsl'
import ScoringRulesHelpTooltip from '@/components/kpi/ScoringRulesHelpTooltip.vue'
import { getApiErrorMessage } from '@/utils/apiErrorMessage'
import {
  parseTrimmedTargetNumber,
  targetRowHasValidationIssue,
  validateNonNegativeTargetBatch,
  validateNonNegativeTargetValue,
  validateWeightPctValue,
} from '@/utils/kpiTargetValidation'
import { useAuthStore } from '@/stores/auth.store'

// --- INTERFACES ---
interface KpiCategory {
  id: string;
  name: string;
}

// --- PROPS & EMITS ---
const props = defineProps({
  open: { type: Boolean, default: false },
  kpi: { type: Object, default: null }, // Mapped từ kpiLibrary
  mode: { type: String, default: 'assign' }, // 'assign' | 'create'
  readonly: { type: Boolean, default: false },
  /** Assignment member đang 407 — khi lưu phân bổ gọi API accept-with-cascade (một transaction). */
  pendingMemberFeedbackAssignmentId: { type: String, default: undefined },
})

const emit = defineEmits(['close', 'save', 'refresh'])
const authStore = useAuthStore()

// --- COMPUTED STATES ---
const isCreate = computed(() => props.mode === 'create')
const isRejectedSelfCreatedEdit = computed(
  () => !isCreate.value && Boolean(props.kpi?.isSelfCreated) && Number(props.kpi?.statusCode) === 406,
)
const canEditKpiDefinition = computed(() => isCreate.value || isRejectedSelfCreatedEdit.value)

const completingMemberFeedbackAllocation = computed(() => {
  const id = props.pendingMemberFeedbackAssignmentId
  return typeof id === 'string' && id.trim() !== ''
})

/** User id của member đang gửi feedback (407) — drawer chỉ hiển thị member này. */
const feedbackMemberUserId = computed(() => {
  if (!completingMemberFeedbackAllocation.value) return ''
  const feedbackAid = String(props.pendingMemberFeedbackAssignmentId ?? '').trim()
  if (!feedbackAid) return ''
  const feedbackChild = findPortfolioChildByAssignmentId(
    props.kpi as Record<string, unknown>,
    feedbackAid,
  )
  return String(feedbackChild?.userId ?? '').trim()
})

/** Danh sách member hiển thị trong drawer phân bổ khi duyệt feedback — chỉ 1 member. */
const visibleSelectedMembers = computed(() => {
  if (!completingMemberFeedbackAllocation.value) {
    return selectedMembers.value
  }
  const uid = feedbackMemberUserId.value
  if (!uid) return []
  return selectedMembers.value.filter(
    (id) => normalizeMemberId(id) === normalizeMemberId(uid),
  )
})

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
/** Thành viên thuộc phòng ban của PM (registration init → BE findMembersByPmDepartment). */
const allocationMemberPool = computed<PmMemberOption[]>(() => memberOptions.value)

const showTeamAssignPoolEmpty = computed(
  () =>
    !isCreate.value &&
    typeCode.value === KPI_TYPE.TEAM &&
    memberOptions.value.length === 0,
)

function hasMemberSubmittedActualForPmReview(kpi: Record<string, unknown> | null | undefined): boolean {
  if (!isPortfolioTeamKpi(kpi)) return false
  const children = Array.isArray(kpi?.children) ? kpi.children : []
  return children.some((child) => {
    const uid = String(child?.userId ?? '').trim()
    if (uid && uid === pmUserId.value) return false
    const sc = Number(child?.statusCode)
    return Number.isFinite(sc) && sc >= 501
  })
}

const allocationSaveBlockedReason = computed(() => {
  if (isCreate.value) return null
  if (hasMemberSubmittedActualForPmReview(props.kpi as Record<string, unknown> | null | undefined)) {
    return 'Cannot save allocation because the member has submitted actuals for PM approval.'
  }
  return null
})

function normalizeMemberId(id: string): string {
  return String(id ?? '').trim().toLowerCase()
}

/** Pool phòng ban + thành viên cascade đã giao (kể cả đã khóa chỉnh sửa) để luôn hiển thị tên, không rơi về UUID. */
const memberMap = computed(() => {
  const map = new Map<string, PmMemberOption>()
  const put = (member: PmMemberOption) => {
    const key = normalizeMemberId(member.id)
    if (key) map.set(key, member)
  }
  for (const member of allocationMemberPool.value) {
    put(member)
  }
  const kpi = props.kpi as Record<string, unknown> | null | undefined
  if (isPortfolioTeamKpi(kpi)) {
    const children = (kpi as { children?: Array<Record<string, unknown>> }).children
    if (Array.isArray(children)) {
      for (const c of children) {
        const uid = String(c.userId ?? '').trim()
        if (!uid || map.has(normalizeMemberId(uid))) continue
        const name = String(c.name ?? '').trim()
        if (!name) continue
        put({
          id: uid,
          shortName: name.split(/\s+/).filter(Boolean)[0] ?? name,
          fullName: name,
          departmentName: String(c.role ?? '').trim(),
          rankCode: '',
        })
      }
    }
  }
  return map
})

const filteredMemberOptions = computed(() => {
  let pool = allocationMemberPool.value
  if (completingMemberFeedbackAllocation.value) {
    const uid = feedbackMemberUserId.value
    if (!uid) return []
    pool = pool.filter((m) => normalizeMemberId(m.id) === normalizeMemberId(uid))
    if (pool.length === 0) {
      const label = getMemberLabel(uid)
      pool = [
        {
          id: uid,
          shortName: label.split(/\s+/).filter(Boolean)[0] ?? label,
          fullName: label,
          departmentName: '',
          rankCode: '',
        },
      ]
    }
  }
  const query = memberAssignSearch.value.trim().toLowerCase()
  if (!query) return pool

  return pool.filter((m) =>
    `${m.shortName} ${m.departmentName} ${m.rankCode} ${m.fullName}`.toLowerCase().includes(query),
  )
})

const getMemberShort = (id: string) => {
  if (normalizeMemberId(id) === normalizeMemberId(pmUserId.value)) return 'Me'
  return memberMap.value.get(normalizeMemberId(id))?.shortName ?? id
}
const getMemberLabel = (id: string) => {
  if (normalizeMemberId(id) === normalizeMemberId(pmUserId.value)) {
    return authStore.user?.fullName?.trim() || authStore.user?.name || 'Me'
  }
  return memberMap.value.get(normalizeMemberId(id))?.fullName ?? id
}

function parseTargetInput(raw: string | null | undefined): number {
  const n = parseTrimmedTargetNumber(raw)
  return n != null && n >= 0 ? n : 0
}

function parseOptionalMemberTarget(raw: string | null | undefined): number | null {
  const n = parseTrimmedTargetNumber(raw)
  return n != null && n >= 0 ? n : null
}

const pmUserId = computed(() => String(authStore.user?.id ?? '').trim())

const canShowAssignToMe = computed(
  () => !isCreate.value && typeCode.value === KPI_TYPE.TEAM && pmUserId.value !== '',
)

const showsPmTargetField = computed(
  () =>
    typeCode.value === KPI_TYPE.TEAM ||
    typeCode.value === KPI_TYPE.INDIVIDUAL ||
    (!isCreate.value && typeCode.value === KPI_TYPE.PROMOTION),
)

const pmTargetFieldLabel = computed(() => {
  if (typeCode.value === KPI_TYPE.TEAM) return 'Target (Team)'
  if (typeCode.value === KPI_TYPE.PROMOTION) return 'Target (Promotion)'
  return 'Target (Individual)'
})

/** KPI Team & Individual: ô chỉ placeholder + dropdown; danh sách đã chọn & Xóa ở khối dưới (không chip trong ô). Promotion: chip trong ô. */
const useMemberAssignListBelow = computed(
  () => typeCode.value === KPI_TYPE.TEAM || typeCode.value === KPI_TYPE.INDIVIDUAL,
)

const teamTargetValueNum = computed(() => {
  const n = Number(targetValue.value)
  return Number.isFinite(n) ? n : 0
})

const selectedTargetsTotal = computed(() =>
  selectedMembers.value.reduce((sum, id) => sum + parseTargetInput(memberTargets.value[id]), 0),
)

const remainingTargetForPm = computed(() => {
  const remaining = teamTargetValueNum.value - selectedTargetsTotal.value
  return remaining > 0 ? remaining : 0
})

const overAssignedTarget = computed(() => {
  const over = selectedTargetsTotal.value - teamTargetValueNum.value
  return over > 0 ? over : 0
})

// --- CSS CLASS COMPUTEDS ---
const inputBaseClasses = 'w-full rounded-md outline-none transition-all text-xs font-bold'
const inputStateClasses = computed(() => 
  canEditKpiDefinition.value 
    ? 'input-required text-slate-800' 
    : 'bg-slate-100 border border-slate-200 text-slate-600 cursor-not-allowed'
)

const typeCardClass = (code: number) => {
  const isSelected = typeCode.value === code
  const isPromotion = code === KPI_TYPE.PROMOTION
  
  const baseClasses = 'relative flex flex-col items-start p-3 rounded-lg border text-left transition-all'
  const cursorClasses = canEditKpiDefinition.value ? 'cursor-pointer hover:border-blue-300' : 'cursor-not-allowed opacity-60'
  
  if (isSelected) {
    const selectedColorClass = isPromotion ? 'border-purple-500 bg-purple-50' : 'border-blue-500 bg-blue-50'
    return `${baseClasses} ${cursorClasses} ${selectedColorClass}`
  }
  
  return `${baseClasses} ${cursorClasses} border-slate-200 bg-white`
}

// --- METHODS ---
/** Target hiển thị trên portfolio (đã ưu tiên assignment PM) — dùng cho KPI Team thay cho target catalog từ GET strategic. */
function portfolioPmTargetForDisplay(kpi: Record<string, unknown> | null | undefined): string {
  if (!kpi) return ''
  const s = String(kpi.target ?? '').trim()
  if (!s || s === '-') return ''
  return s
}

function isPortfolioTeamKpi(kpi: Record<string, unknown> | null | undefined): boolean {
  if (!kpi) return false
  if (Number(kpi.typeCode) === KPI_TYPE.TEAM) return true
  return kpi.kpiType === 'cascading'
}

/** Dòng cascade portfolio theo `userId` (assignment con). */
function findPortfolioChildForUser(
  kpi: Record<string, unknown> | null | undefined,
  userId: string,
): Record<string, unknown> | null {
  if (!kpi || !isPortfolioTeamKpi(kpi)) return null
  const ch = (kpi as { children?: unknown[] }).children
  if (!Array.isArray(ch)) return null
  const uid = String(userId ?? '').trim()
  if (!uid) return null
  const row = ch.find((c) => String((c as Record<string, unknown>)?.userId ?? '').trim() === uid)
  return row ? (row as Record<string, unknown>) : null
}

/** Dòng cascade portfolio theo assignment id (child.id). */
function findPortfolioChildByAssignmentId(
  kpi: Record<string, unknown> | null | undefined,
  assignmentId: string,
): Record<string, unknown> | null {
  if (!kpi || !isPortfolioTeamKpi(kpi)) return null
  const ch = (kpi as { children?: unknown[] }).children
  if (!Array.isArray(ch)) return null
  const aid = String(assignmentId ?? '').trim()
  if (!aid) return null
  const row = ch.find((c) => String((c as Record<string, unknown>)?.id ?? '').trim() === aid)
  return row ? (row as Record<string, unknown>) : null
}

/** Member đang 407 — PM mở drawer «Chấp nhận và phân bổ» sau khi duyệt feedback. */
function isMemberInFeedbackAllocationReview(userId: string): boolean {
  if (!completingMemberFeedbackAllocation.value) return false
  const feedbackAid = String(props.pendingMemberFeedbackAssignmentId ?? '').trim()
  if (!feedbackAid) return false
  const feedbackChild = findPortfolioChildByAssignmentId(props.kpi as Record<string, unknown>, feedbackAid)
  return String(feedbackChild?.userId ?? '').trim() === String(userId ?? '').trim()
}

/** Highlight UI — cùng member với {@link isMemberInFeedbackAllocationReview}. */
function isFeedbackAssignee(userId: string): boolean {
  return isMemberInFeedbackAllocationReview(userId)
}

/**
 * KPI Team (chỉnh sửa phân bổ): member đã không còn 404 (đã Accept / chờ PM–GM / feedback / …)
 * thì khóa checkbox & nút gỡ khỏi danh sách.
 */
function isMemberAllocationSelectionLocked(userId: string): boolean {
  if (isCreate.value) return false
  if (!isPortfolioTeamKpi(props.kpi as Record<string, unknown> | null | undefined)) return false
  if (typeCode.value !== KPI_TYPE.TEAM) return false
  const child = findPortfolioChildForUser(props.kpi as Record<string, unknown>, userId)
  if (!child) return false
  const sc = Number(child.statusCode)
  if (!Number.isFinite(sc)) return false
  // 406 (từ chối KPI GM queue) — PM chỉnh phân bổ giống 404
  return (
    sc !== KPI_STATUS.PENDING_ACCEPTANCE && sc !== KPI_STATUS.REJECTED
  )
}

/** Khóa ô target — trừ member đang được PM chỉnh khi duyệt feedback (407). */
function isMemberAllocationTargetLocked(userId: string): boolean {
  if (isMemberInFeedbackAllocationReview(userId)) return false
  return isMemberAllocationSelectionLocked(userId)
}

function applyTeamTargetFromPortfolioRow() {
  if (!isPortfolioTeamKpi(props.kpi as Record<string, unknown>)) return
  const t = portfolioPmTargetForDisplay(props.kpi as Record<string, unknown>)
  if (t) targetValue.value = t
}

/**
 * Nếu portfolio có bản ghi cascade (children): đồng bộ chọn & target từ đó.
 * Nếu chưa có children: giữ nguyên selection đã load từ getKpiDetail (không xóa pool department).
 */
function applyPortfolioChildrenToAssignSelection() {
  if (!isPortfolioTeamKpi(props.kpi as Record<string, unknown>)) return
  const kpi = props.kpi as { children?: Array<Record<string, unknown>> }
  const ch = kpi?.children
  if (!Array.isArray(ch) || ch.length === 0) {
    return
  }
  const rows = ch.filter((c) => c.userId != null && String(c.userId).trim() !== '')
  selectedMembers.value = rows.map((c) => String(c.userId).trim())
  const mt: Record<string, string> = {}
  for (const c of rows) {
    const uid = String(c.userId).trim()
    const tv =
      c.targetValue != null && c.targetValue !== ''
        ? String(c.targetValue)
        : String(c.target ?? '').trim()
    mt[uid] = tv
  }
  memberTargets.value = mt
}

/** PM chấp nhận feedback member: chỉ load member gửi feedback, không hiện các member khác đã assign. */
function applyFeedbackMemberOnlyToAssignSelection() {
  if (!completingMemberFeedbackAllocation.value) return
  const feedbackAid = String(props.pendingMemberFeedbackAssignmentId ?? '').trim()
  if (!feedbackAid) return
  const feedbackChild = findPortfolioChildByAssignmentId(
    props.kpi as Record<string, unknown>,
    feedbackAid,
  )
  if (!feedbackChild) return
  const uid = String(feedbackChild.userId ?? '').trim()
  if (!uid) return
  selectedMembers.value = [uid]
  const tv =
    feedbackChild.targetValue != null && feedbackChild.targetValue !== ''
      ? String(feedbackChild.targetValue)
      : String(feedbackChild.target ?? '').trim()
  memberTargets.value = { [uid]: tv }
  assignDropdown.value = null
}

const toggleMember = (id: string) => {
  if (completingMemberFeedbackAllocation.value) {
    return
  }
  const index = selectedMembers.value.indexOf(id)
  if (index !== -1 && isMemberAllocationSelectionLocked(id)) {
    return
  }
  if (index === -1) {
    selectedMembers.value.push(id)
    if (
      (typeCode.value === KPI_TYPE.TEAM || typeCode.value === KPI_TYPE.PROMOTION) &&
      !(id in memberTargets.value)
    ) {
      memberTargets.value[id] = ''
    }
  } else {
    selectedMembers.value.splice(index, 1)
    delete memberTargets.value[id]
  }
}

const assignRemainingToMe = () => {
  if (!canShowAssignToMe.value || remainingTargetForPm.value <= 0) return
  const me = pmUserId.value
  if (isMemberAllocationSelectionLocked(me)) return
  if (!selectedMembers.value.includes(me)) {
    selectedMembers.value.push(me)
  }
  const cur = parseTargetInput(memberTargets.value[me])
  memberTargets.value[me] = String(cur + remainingTargetForPm.value)
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
    console.error('Initialization data load error', error)
  } finally {
    isLoadingInit.value = false
  }
}

const resetFormFields = () => {
  if (canEditKpiDefinition.value) {
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
    targetValue.value = isPortfolioTeamKpi(props.kpi as Record<string, unknown>)
      ? portfolioPmTargetForDisplay(props.kpi as Record<string, unknown>)
      : String(props.kpi.targetValue ?? '').trim()
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
    /** Portfolio row `kpi.id` = assignment của PM — BE lọc memberIds chỉ còn cascade con, không lẫn PM do GM giao. */
    const parentAssignmentId =
      !isCreate.value && props.kpi?.id ? String(props.kpi.id) : undefined
    const detailData = await KpiPmService.getKpiDetail(kpiId, parentAssignmentId)
    
    // Fill vào các Form States
    categoryId.value = detailData.perspective || ''
    typeCode.value = detailData.typeCode || KPI_TYPE.INDIVIDUAL
    kpiName.value = detailData.kpiName || ''
    description.value = extractRawInputFromApiTargetDescription(detailData.targetDescription)
    
    targetValue.value = detailData.targetValue != null ? String(detailData.targetValue) : ''
    weightPct.value = detailData.weightPct != null ? String(detailData.weightPct) : ''
    
    unitCode.value = detailData.unitCode || null
    isImportantKpi.value = detailData.isImportant || false

    // Phân giải calculationMethod ra Code
    if (detailData.calculationMethod) {
      switch (detailData.calculationMethod) {
        case "manual_member_input": calculationRuleCode.value = 803; calculationTypeCode.value = null; break;
        case "mean_actual_plan": calculationRuleCode.value = 802; calculationTypeCode.value = 701; break;
        case "mean_plan_actual": calculationRuleCode.value = 802; calculationTypeCode.value = 702; break;
        case "mean_plan_actual_sum": calculationRuleCode.value = 801; calculationTypeCode.value = null; break;
        default: calculationRuleCode.value = 802; calculationTypeCode.value = 701; break;
      }
    }

    const rawIds = detailData.memberIds || []
    selectedMembers.value = rawIds.map((x: unknown) => String(x))
    const mt = (detailData.memberTargets ?? {}) as Record<string, unknown>
    // Individual: một Target chung — không giữ map target từng member trên form.
    if (Number(detailData.typeCode) === KPI_TYPE.INDIVIDUAL) {
      memberTargets.value = {}
    } else {
      memberTargets.value = Object.fromEntries(
        Object.entries(mt).map(([k, v]) => [String(k), v == null ? '' : String(v)]),
      )
    }
    if (completingMemberFeedbackAllocation.value) {
      applyFeedbackMemberOnlyToAssignSelection()
    }
    formErrors.value = {}
  } catch (error) {
    console.error('Error when getting KPI detail:', error)
    resetFormFields()
    if (!isCreate.value && isPortfolioTeamKpi(props.kpi as Record<string, unknown>)) {
      applyTeamTargetFromPortfolioRow()
      if (completingMemberFeedbackAllocation.value) {
        applyFeedbackMemberOnlyToAssignSelection()
      } else {
        applyPortfolioChildrenToAssignSelection()
      }
    }
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

    if (!isCreate.value && isPortfolioTeamKpi(props.kpi as Record<string, unknown>)) {
      applyTeamTargetFromPortfolioRow()
      if (completingMemberFeedbackAllocation.value) {
        applyFeedbackMemberOnlyToAssignSelection()
      } else {
        applyPortfolioChildrenToAssignSelection()
      }
    }

    window.addEventListener('click', onDocClick)
  } else {
    window.removeEventListener('click', onDocClick)
  }
  document.body.style.overflow = isOpen ? 'hidden' : ''
}, { immediate: true })

/** Đổi giữa KPI Team ↔ Individual: reset target; đồng bộ memberTargets (Individual không có target từng người). */
watch(typeCode, (newVal, oldVal) => {
  if (oldVal === undefined) return
  const wasTeam = oldVal === KPI_TYPE.TEAM
  const isTeam = newVal === KPI_TYPE.TEAM
  if (wasTeam !== isTeam) targetValue.value = ''

  if (newVal === KPI_TYPE.INDIVIDUAL && (wasTeam || oldVal === KPI_TYPE.PROMOTION)) {
    memberTargets.value = {}
  }
  if (newVal === KPI_TYPE.TEAM && oldVal === KPI_TYPE.INDIVIDUAL) {
    const next: Record<string, string> = { ...memberTargets.value }
    for (const id of selectedMembers.value) {
      if (!(id in next)) next[id] = ''
    }
    memberTargets.value = next
  }
  if (newVal === KPI_TYPE.PROMOTION && oldVal === KPI_TYPE.INDIVIDUAL) {
    memberTargets.value = Object.fromEntries(selectedMembers.value.map((id) => [id, '']))
  }
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

function memberTargetRowHasValidationIssue(memberId: string): boolean {
  if (!formErrors.value.memberTargets) return false
  const needsTarget =
    typeCode.value === KPI_TYPE.TEAM || typeCode.value === KPI_TYPE.PROMOTION
  if (!needsTarget) return false
  return targetRowHasValidationIssue(memberTargets.value[memberId], { required: true })
}

const validateForm = (): boolean => {
  formErrors.value = {}

  const needsMemberAllocationTargets =
    typeCode.value === KPI_TYPE.TEAM || typeCode.value === KPI_TYPE.PROMOTION

  if (canEditKpiDefinition.value) {
    if (!kpiName.value.trim()) formErrors.value.kpiName = 'Enter a KPI name.'
    const weightErr = validateWeightPctValue(weightPct.value, { required: true })
    if (weightErr) formErrors.value.weightPct = weightErr
    if (showsPmTargetField.value) {
      const targetErr = validateNonNegativeTargetValue(targetValue.value, { required: true })
      if (targetErr) {
        formErrors.value.targetValue =
          typeCode.value === KPI_TYPE.TEAM && targetErr.includes('numeric')
            ? 'Enter a total target (Team Target).'
            : targetErr
      }
    }
    if (!unitCode.value) formErrors.value.unitCode = 'Select a unit.'
    if (!calculationRuleCode.value) formErrors.value.calculationRuleCode = 'Select a calculation rule.'
    
    if (calculationRuleCode.value === CALC_RULE.AVERAGE && !calculationTypeCode.value) {
      formErrors.value.calculationTypeCode = 'Select a calculation direction (Actual/Plan or Plan/Actual).'
    }

    const dv = description.value.trim()
    if (!dv) {
      formErrors.value.scoringRules =
        'Enter scoring rules for levels 1-5 using the required syntax.'
    } else {
      const vr = validateScoringRulesDsl(description.value)
      if (!vr.ok) {
        formErrors.value.scoringRules = vr.errors.join(' ')
      }
    }

  }

  if (isCreate.value && needsMemberAllocationTargets && selectedMembers.value.length > 0) {
    const batchErr = validateNonNegativeTargetBatch(
      selectedMembers.value.map((memberId) => ({
        raw: memberTargets.value[memberId],
        label: getMemberLabel(memberId),
      })),
      { requireAllFilled: true },
    )
    if (batchErr) formErrors.value.memberTargets = batchErr
  }

  if (!isCreate.value && needsMemberAllocationTargets) {
    const membersToValidate = completingMemberFeedbackAllocation.value
      ? visibleSelectedMembers.value
      : selectedMembers.value
    if (membersToValidate.length > 0) {
      const batchErr = validateNonNegativeTargetBatch(
        membersToValidate.map((memberId) => ({
          raw: memberTargets.value[memberId],
          label: getMemberLabel(memberId),
        })),
        { requireAllFilled: true },
      )
      if (batchErr) formErrors.value.memberTargets = batchErr
    }
  }

  return Object.keys(formErrors.value).length === 0
}

function buildStrategicKpiPayload(): Record<string, unknown> {
  const unitName = unitOptions.value.find(u => u.code === unitCode.value)?.name || 'MM'
    
  const payload: Record<string, unknown> = {
    typeCode: typeCode.value,
    perspective: categoryId.value,
    kpiName: canEditKpiDefinition.value ? kpiName.value : (props.kpi?.name || ''),
    targetDescription: description.value.trim()
      ? buildScoringRulesPayload(description.value)
      : null,
    targetValue: targetValue.value ? Number(targetValue.value) : null,
    unit: unitName,
    unitCode: unitCode.value,
    weightPct: String(weightPct.value),
    cycleId: formCycleId.value,
    calculationMethod: persistedCalculationMethodFromTypeAndRule(
      calculationTypeCode.value,
      calculationRuleCode.value ?? CALC_RULE.AVERAGE,
    ),
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

  return payload
}

const registerKPI = async () => {
  await gmKpiService.createStrategicKpi(buildStrategicKpiPayload())
}

const updateRejectedKpiAndResubmit = async () => {
  const infoId = String(props.kpi?.infoId ?? '').trim()
  if (!infoId) {
    throw new Error('Missing KPI information id to resubmit KPI.')
  }
  await gmKpiService.updateStrategicKpi(infoId, buildStrategicKpiPayload())
}

function buildCascadePayloadFromForm(): {
  kpiInformationId: string
  cycleId: string
  parentAssignmentId: string | null
  memberTargets: Record<string, number | null>
} {
  const cascadePayload = {
    kpiInformationId: String(props.kpi?.infoId ?? '').trim(),
    cycleId: formCycleId.value,
    parentAssignmentId: (props.kpi?.id != null && String(props.kpi.id).trim() !== ''
      ? String(props.kpi.id).trim()
      : null) as string | null,
    memberTargets: {} as Record<string, number | null>,
  }

  if (typeCode.value === KPI_TYPE.TEAM) {
    const membersForPayload = completingMemberFeedbackAllocation.value
      ? visibleSelectedMembers.value
      : selectedMembers.value
    cascadePayload.memberTargets = Object.fromEntries(
      membersForPayload.map((memberId) => [
        memberId,
        parseOptionalMemberTarget(memberTargets.value[memberId]),
      ]),
    )
  } else {
    const targetNum = null
    selectedMembers.value.forEach((mem) => {
      cascadePayload.memberTargets[mem] = targetNum
    })
  }
  return cascadePayload
}

const handleAssignMember = async () => {
  await KpiPmService.cascadeKpi(buildCascadePayloadFromForm())
}

const handleSave = async () => {
  if (props.readonly) {
    return
  }
  if (allocationSaveBlockedReason.value) {
    return
  }
  if (!validateForm()) {
    await nextTick()
    errorBannerRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    return
  }

  saving.value = true

  try {
    if (isCreate.value) {
      await registerKPI()
    } else if (isRejectedSelfCreatedEdit.value) {
      await updateRejectedKpiAndResubmit()
    } else if (completingMemberFeedbackAllocation.value) {
      const fid = String(props.pendingMemberFeedbackAssignmentId ?? '').trim()
      const y = activeCycle.value?.year
      if (!Number.isFinite(Number(y))) {
        formErrors.value = {
          api: 'Could not determine the cycle year to approve feedback and save allocation.',
        }
        await nextTick()
        errorBannerRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        return
      }
      const c = buildCascadePayloadFromForm()
      await KpiPmService.acceptMemberFeedbackWithCascade({
        year: Number(y),
        memberFeedbackAssignmentId: fid,
        kpiInformationId: c.kpiInformationId,
        cycleId: c.cycleId,
        parentAssignmentId: c.parentAssignmentId,
        memberTargets: c.memberTargets,
      })
    } else {
      await handleAssignMember()
    }

    emit('refresh')
    emit('close')
  } catch (error) {
    console.error('Error while saving KPI:', error)
    formErrors.value.api = getApiErrorMessage(error, 'An error occurred while saving KPI. Please try again.')
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
        <aside class="gm-kpi-drawer-panel will-change-transform absolute top-0 right-0 bottom-0 flex flex-col w-full max-w-full md:max-w-[700px] lg:max-w-[800px] bg-slate-50 border-l border-slate-200 shadow-2xl">
          
          <!-- Header -->
          <div class="z-10 flex shrink-0 items-center justify-between p-5 bg-white border-b border-slate-200 shadow-sm">
            <div>
              <h2 class="flex items-center gap-2 text-lg font-bold text-slate-800">
                <span class="p-1.5 rounded-lg bg-blue-100 text-blue-700 shadow-sm">
                  <i class="fas" :class="isCreate ? 'fa-plus' : 'fa-sliders-h'" />
                </span>
                {{ isCreate ? 'Create KPI' : isRejectedSelfCreatedEdit ? 'Edit rejected KPI' : 'Allocate KPI' }}
              </h2>
              <p class="mt-1 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                {{ isCreate ? 'Define a new KPI for your team' : isRejectedSelfCreatedEdit ? 'Edit KPI information and resubmit to GM' : 'Edit or add assignees and targets' }}
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
            <p class="text-sm font-semibold text-slate-600">Loading configuration data...</p>
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
                <i class="fas fa-circle-exclamation text-rose-600" /> Please fix the following errors before continuing.
              </p>
              <ul class="list-inside list-disc space-y-0.5 text-[11px] font-semibold text-rose-800">
                <li v-for="(msg, key) in formErrors" :key="key">{{ msg }}</li>
              </ul>
            </div>

            <!-- Basic Info Section -->
            <div 
              class="gm-kpi-section-card p-5 rounded-xl border border-slate-200 shadow-sm transition-all" 
              :class="canEditKpiDefinition ? 'bg-white' : 'bg-slate-50/70 pointer-events-none opacity-90'"
            >
              <label class="mb-4 flex items-center gap-2 text-xs font-bold tracking-wide text-slate-800 uppercase">
                <span class="p-1.5 rounded-lg" :class="canEditKpiDefinition ? 'bg-slate-100 text-indigo-600' : 'bg-slate-200 text-slate-500'">
                  <i class="fas fa-file-lines text-sm" />
                </span>
                Basic Information &amp; Classification
              </label>
              
              <div class="space-y-4">
                <!-- Category & Name -->
                <div class="flex flex-col gap-3 sm:flex-row">
                  <div class="sm:w-1/3">
                    <label class="mb-1.5 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      Perspective (Category) <span v-if="canEditKpiDefinition" class="text-rose-500">*</span>
                    </label>
                    <div class="relative">
                      <select 
                        v-model="categoryId" 
                        :disabled="!canEditKpiDefinition" 
                        class="min-h-[38px] py-2 pl-3 pr-8 appearance-none"
                        :class="[inputBaseClasses, inputStateClasses, canEditKpiDefinition ? 'cursor-pointer' : '']"
                      >
                        <option v-for="cat in categoryOptions" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
                      </select>
                      <i class="fas fa-chevron-down absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div class="min-w-0 sm:flex-1">
                    <label class="mb-1.5 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      KPI Name <span v-if="canEditKpiDefinition" class="text-rose-500">*</span>
                    </label>
                    <input 
                      v-model="kpiName" 
                      type="text" 
                      :disabled="!canEditKpiDefinition" 
                      placeholder="e.g. Optimize source code" 
                      class="px-3 py-2 min-h-[38px]"
                      :class="[inputBaseClasses, inputStateClasses, formErrors.kpiName ? '!bg-rose-50/50 !border-rose-400' : '']" 
                    />
                  </div>
                </div>

                <!-- KPI Type Selection -->
                <div>
                  <label class="mb-2 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                    KPI Type (assignment method) <span v-if="canEditKpiDefinition" class="text-rose-500">*</span>
                  </label>
                  <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <!-- Team -->
                    <button type="button" :class="typeCardClass(KPI_TYPE.TEAM)" @click="canEditKpiDefinition ? typeCode = KPI_TYPE.TEAM : null">
                      <div class="mb-1.5 flex items-center gap-2">
                        <span class="p-1 rounded bg-slate-50 border border-slate-100"><i class="fas fa-code-branch text-xs text-blue-600" /></span>
                        <span class="text-xs font-bold text-slate-800">Team / Cascading</span>
                      </div>
                      <p class="text-[11px] font-medium leading-tight text-slate-500">Assign to subordinates for cascading.</p>
                    </button>
                    <!-- Individual -->
                    <button type="button" :class="typeCardClass(KPI_TYPE.INDIVIDUAL)" @click="canEditKpiDefinition ? typeCode = KPI_TYPE.INDIVIDUAL : null">
                      <div class="mb-1.5 flex items-center gap-2">
                        <span class="p-1 rounded bg-slate-50 border border-slate-100"><i class="fas fa-crosshairs text-xs text-slate-600" /></span>
                        <span class="text-xs font-bold text-slate-800">Individual KPI</span>
                      </div>
                      <p class="text-[11px] font-medium leading-tight text-slate-500">Bulk assign by rank.</p>
                    </button>
                  </div>
                  <p
                    v-if="!isCreate && typeCode === KPI_TYPE.PROMOTION"
                    class="mt-2 rounded-lg border border-purple-200 bg-purple-50/80 px-3 py-2 text-[11px] font-semibold text-purple-900"
                  >
                    KPI Type: Promotion - allocation only; PM cannot create Promotion KPIs from this drawer.
                  </p>
                </div>

                <!-- Important KPI Checkbox -->
                <div class="flex items-center gap-2 mb-2 px-2.5 py-1.5 w-max rounded-md border border-slate-200/90" :class="canEditKpiDefinition ? 'bg-slate-50/60' : 'bg-slate-100'">
                  <input 
                    id="pm-kpi-important" 
                    v-model="isImportantKpi" 
                    :disabled="!canEditKpiDefinition" 
                    type="checkbox" 
                    class="w-3.5 h-3.5 shrink-0 rounded border-slate-300 text-amber-500 focus:ring-amber-400/50 disabled:cursor-not-allowed disabled:opacity-60" 
                  />
                  <label for="pm-kpi-important" class="text-[11px] font-semibold text-slate-600" :class="canEditKpiDefinition ? 'cursor-pointer' : 'cursor-not-allowed'">
                    Important KPI
                  </label>
                </div>

                <!-- Target & Weight -->
                <div class="grid grid-cols-1 gap-4" :class="showsPmTargetField ? 'sm:grid-cols-2 sm:gap-x-6' : ''">
                  <div v-if="showsPmTargetField" class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      {{ pmTargetFieldLabel }} <span v-if="canEditKpiDefinition" class="text-rose-500">*</span>
                    </label>
                    <input 
                      v-model="targetValue" 
                      :disabled="!canEditKpiDefinition" 
                      type="number" 
                      min="0"
                      step="any"
                      placeholder="e.g. 100" 
                      class="px-3 py-2 min-h-[38px]"
                      :class="[inputBaseClasses, inputStateClasses, formErrors.targetValue ? '!bg-rose-50/50 !border-rose-400' : '']" 
                    />
                    <p
                      v-if="formErrors.targetValue"
                      class="mt-1 text-[10px] font-semibold text-rose-600"
                    >
                      {{ formErrors.targetValue }}
                    </p>
                  </div>
                  <div class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      Weight <span v-if="canEditKpiDefinition" class="text-rose-500">*</span>
                    </label>
                    <div class="relative">
                      <input 
                        v-model="weightPct" 
                        :disabled="!canEditKpiDefinition" 
                        type="number" 
                        min="1"
                        max="100"
                        placeholder="20" 
                        class="py-2 pl-3 pr-8 min-h-[38px]"
                        :class="[inputBaseClasses, inputStateClasses, formErrors.weightPct ? '!bg-rose-50/50 !border-rose-400' : '']" 
                      />
                      <span class="absolute top-1/2 right-3 -translate-y-1/2 text-[10px] font-bold text-blue-400 pointer-events-none">%</span>
                    </div>
                    <p
                      v-if="formErrors.weightPct"
                      class="mt-1 text-[10px] font-semibold text-rose-600"
                    >
                      {{ formErrors.weightPct }}
                    </p>
                  </div>
                </div>

                <!-- Unit & Cycle -->
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-6">
                  <div class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      Unit <span v-if="canEditKpiDefinition" class="text-rose-500">*</span>
                    </label>
                    <div class="relative">
                      <select 
                        v-model="unitCode" 
                        :disabled="!canEditKpiDefinition" 
                        class="py-2 pl-3 pr-8 min-h-[38px] appearance-none"
                        :class="[inputBaseClasses, inputStateClasses, canEditKpiDefinition ? 'cursor-pointer' : '', formErrors.unitCode ? '!border-rose-400' : '']"
                      >
                        <option v-for="u in unitOptions" :key="u.code" :value="u.code">{{ u.name }}</option>
                      </select>
                      <i class="fas fa-chevron-down absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  
                  <div class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      Evaluation Year (Cycle) <span class="text-rose-500">*</span>
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
                      Calculation Method <span v-if="canEditKpiDefinition" class="text-rose-500">*</span>
                    </label>
                  </div>

                  <div class="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
                    <div class="relative min-w-0 flex-1">
                      <select 
                        v-model="calculationRuleCode" 
                        :disabled="!canEditKpiDefinition" 
                        class="py-2 pl-8 pr-7 min-h-[38px] appearance-none"
                        :class="[inputBaseClasses, inputStateClasses, canEditKpiDefinition ? 'cursor-pointer' : '', formErrors.calculationRuleCode ? '!border-rose-400' : '']"
                      >
                        <option v-for="rule in calcRuleOptions" :key="rule.code" :value="rule.code" :title="rule.description || rule.name">{{ rule.description || rule.name }}</option>
                      </select>
                      <i class="fas fa-calculator absolute top-1/2 left-3 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none" />
                      <i class="fas fa-chevron-down absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none" />
                    </div>

                    <div 
                      v-if="calculationRuleCode === CALC_RULE.AVERAGE" 
                      class="flex flex-1 items-center gap-4 px-3 py-1.5 min-h-[38px] min-w-0 rounded-md border border-slate-200 transition-all" 
                      :class="[canEditKpiDefinition ? 'bg-white' : 'bg-slate-100', formErrors.calculationTypeCode ? '!border-rose-400' : '']"
                    >
                      <span class="text-[9px] font-bold tracking-wide text-slate-400 uppercase">Ratio</span>
                      
                      <label 
                        class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700" 
                        :class="canEditKpiDefinition ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'"
                      >
                        <input 
                          v-model="calculationTypeCode" 
                          :disabled="!canEditKpiDefinition" 
                          type="radio" 
                          :value="CALC_TYPE.ACTUAL_OVER_PLAN" 
                          class="w-3.5 h-3.5 border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60" 
                        />
                        Actual/Plan
                      </label>

                      <label 
                        class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700" 
                        :class="canEditKpiDefinition ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'"
                      >
                        <input 
                          v-model="calculationTypeCode" 
                          :disabled="!canEditKpiDefinition" 
                          type="radio" 
                          :value="CALC_TYPE.PLAN_OVER_ACTUAL" 
                          class="w-3.5 h-3.5 border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60" 
                        />
                        Plan/Actual
                      </label>
                    </div>
                  </div>
                </div>

                <!-- Scoring rules -->
                <div>
                  <div class="mb-1.5 flex items-center gap-1.5">
                    <label class="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Scoring Rules <span v-if="canEditKpiDefinition" class="text-rose-500">*</span>
                    </label>
                    <ScoringRulesHelpTooltip
                      v-if="canEditKpiDefinition"
                      aria-label="Scoring rule syntax examples"
                    />
                  </div>
                  <textarea 
                    v-model="description" 
                    :disabled="!canEditKpiDefinition" 
                    rows="5" 
                    placeholder="1: &lt;50&#10;2: 50-70&#10;3: 71-85&#10;4: 86-99&#10;5: &gt;=100" 
                    class="custom-scrollbar min-h-[7.5rem] w-full px-3 py-2 rounded-md text-xs font-medium resize-y outline-none transition-all focus:ring-1" 
                    :class="[
                      !canEditKpiDefinition
                        ? 'border border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed'
                        : formErrors.scoringRules
                          ? 'border !border-rose-400 !bg-rose-50/70 text-slate-800 focus:border-rose-400 focus:ring-rose-100'
                          : 'input-required text-slate-800 focus:border-blue-400 focus:ring-blue-100',
                    ]"
                  />
                  <p v-if="formErrors.scoringRules" class="mt-1 text-[10px] font-semibold text-rose-600">
                    {{ formErrors.scoringRules }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Assignment Section -->
            <div v-if="!(isCreate && typeCode === KPI_TYPE.INDIVIDUAL)" class="gm-kpi-section-card p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
              <label class="mb-4 flex items-center gap-2 text-xs font-bold tracking-wide text-slate-800 uppercase">
                <span class="p-1.5 rounded-lg bg-indigo-100 text-indigo-600">
                  <i class="fas fa-diagram-project text-sm" />
                </span>
                Allocation / Assignment
              </label>

              <div>
                <template v-if="!completingMemberFeedbackAllocation">
                  <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <label class="block min-w-0 flex-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Assign To Team Members <span class="text-rose-500">*</span>
                    </label>
                    <button
                      v-if="canShowAssignToMe"
                      type="button"
                      class="inline-flex shrink-0 items-center gap-1 rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-[10px] font-bold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="remainingTargetForPm <= 0"
                      @click="assignRemainingToMe"
                    >
                      <i class="fas fa-user-check text-[10px]" />
                      Assign to me
                    </button>
                  </div>
                  <p
                    v-if="canShowAssignToMe"
                    class="mb-2 text-[10px] font-semibold tabular-nums leading-snug text-slate-600"
                    title="Team target · Assigned to members · Remaining assigned to PM"
                  >
                    <span class="font-bold text-slate-800">{{ teamTargetValueNum }}</span>
                    <span class="mx-1 text-slate-300">/</span>
                    <span>{{ selectedTargetsTotal }} assigned</span>
                    <span class="mx-1 text-slate-300">·</span>
                    <span :class="remainingTargetForPm > 0 ? 'text-emerald-700' : 'text-slate-500'">
                      PM +{{ remainingTargetForPm }}
                    </span>
                  </p>

                  <!-- Team & Individual: placeholder trong ô; Promotion: chip trong ô. -->
                  <div
                    ref="assignMemberSurfaceRef"
                    class="relative"
                  >
                  <button 
                    type="button" 
                    class="input-optional relative flex w-full min-h-[38px] flex-wrap items-center gap-1.5 rounded-md py-1.5 pl-8 pr-7 text-left text-xs font-bold text-slate-700 transition-all" 
                    @click.stop="assignDropdown = assignDropdown === 'member' ? null : 'member'"
                  >
                    <template v-if="useMemberAssignListBelow">
                      <span class="w-full font-medium text-slate-400">{{
                        showTeamAssignPoolEmpty
                          ? 'No employees in the department you manage - check department assignment for the PM account.'
                          : selectedMembers.length === 0
                            ? 'Select members...'
                            : `${selectedMembers.length} members selected - click to add or remove in the list below`
                      }}</span>
                    </template>
                    <template v-else>
                      <span v-if="selectedMembers.length === 0" class="w-full font-medium text-slate-400">{{
                        showTeamAssignPoolEmpty
                          ? 'No employees in the department you manage - check department assignment for the PM account.'
                          : 'Search and select team members...'
                      }}</span>
                      <span 
                        v-for="id in selectedMembers" 
                        :key="id" 
                        class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap shadow-sm"
                        :class="
                          isFeedbackAssignee(id)
                            ? 'border-amber-300 bg-amber-100 text-amber-900'
                            : 'border-blue-200 bg-blue-100 text-blue-700'
                        "
                      >
                        {{ getMemberShort(id) }}
                        <i
                          v-if="isFeedbackAssignee(id)"
                          class="fas fa-comment-dots text-[8px] text-amber-700"
                          title="Member feedback"
                        />
                        <button 
                          type="button" 
                          class="rounded p-0.5 text-blue-600 transition hover:bg-blue-200/60" 
                          @click.stop="toggleMember(id)"
                        >
                          <i class="fas fa-times text-[9px]" />
                        </button>
                      </span>
                    </template>
                  </button>
                  <i class="fas fa-user-plus pointer-events-none absolute left-2.5 top-2.5 text-[10px] text-slate-400" />
                  <i class="fas fa-chevron-down pointer-events-none absolute right-2.5 top-2.5 text-[10px] text-slate-400" />

                  <!-- Dropdown List -->
                  <div 
                    v-show="assignDropdown === 'member'" 
                    class="absolute left-0 z-50 mt-1 flex max-h-72 w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl" 
                    @click.stop
                  >
                    <div class="sticky top-0 z-10 shrink-0 border-b border-slate-100 bg-slate-50 p-2" @click.stop>
                      <div class="relative">
                        <i class="fas fa-search pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400" />
                        <input 
                          v-model="memberAssignSearch" 
                          type="text" 
                          placeholder="Search by name, dept or rank..." 
                          class="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-xs font-medium text-slate-800 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                          @click.stop 
                        />
                      </div>
                    </div>
                    <div class="custom-scrollbar max-h-60 flex-1 overflow-y-auto p-1">
                      <template v-if="filteredMemberOptions.length > 0">
                        <label 
                          v-for="m in filteredMemberOptions" 
                          :key="m.id" 
                          class="group flex items-center rounded-md border-b border-slate-50 px-3 py-2 transition-colors last:border-0"
                          :class="
                            isFeedbackAssignee(m.id)
                              ? 'border-amber-200/80 bg-amber-50/90 ring-1 ring-amber-200'
                              : isMemberAllocationSelectionLocked(m.id)
                                ? 'cursor-not-allowed bg-slate-50/80'
                                : 'cursor-pointer hover:bg-slate-50'
                          "
                        >
                          <input 
                            type="checkbox" 
                            class="mt-0.5 mr-3 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            :class="isMemberAllocationSelectionLocked(m.id) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'"
                            :disabled="isMemberAllocationSelectionLocked(m.id)"
                            :checked="selectedMembers.includes(m.id)" 
                            @change="toggleMember(m.id)" 
                          />
                          <div class="flex min-w-0 flex-1 items-center gap-3">
                            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-bold uppercase text-slate-500">
                              {{ generateInitials(m.fullName) }}
                            </div>
                            <div class="flex min-w-0 flex-1 flex-col">
                              <span class="block text-sm font-bold leading-tight text-slate-700 group-hover:text-blue-600">{{ m.fullName }}</span>
                              <span class="mt-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {{ m.departmentName }} <span class="text-slate-400">•</span> <span class="text-indigo-500">{{ m.rankCode }}</span>
                              </span>
                            </div>
                            <span
                              v-if="isFeedbackAssignee(m.id)"
                              class="ml-1 inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800"
                              title="Member feedback — adjust target below"
                            >
                              <i class="fas fa-comment-dots text-[8px]" />
                              Feedback
                            </span>
                          </div>
                        </label>
                      </template>
                      <p v-else-if="showTeamAssignPoolEmpty" class="px-3 py-4 text-center text-xs font-medium text-slate-500">
                        The initialization API did not return department employees - make sure the PM is assigned to a department and there are active users in the same department.
                      </p>
                      <p v-else class="px-3 py-4 text-center text-xs font-medium text-slate-500">No members match the filter.</p>
                    </div>
                  </div>
                  </div>
                </template>

                <!-- Team: target từng thành viên + Xóa; Individual: chỉ danh sách + Xóa (target chung ở ô Target phía trên); Promotion: ô target từng dòng + chip trong trigger -->
                <div
                  v-if="visibleSelectedMembers.length > 0"
                  class="mt-4 space-y-2 rounded-xl border border-blue-100 bg-blue-50/50 p-4 shadow-inner"
                  :class="completingMemberFeedbackAllocation ? 'border-amber-200 bg-amber-50/40' : ''"
                >
                  <p class="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase text-blue-800">
                    <i class="fas fa-crosshairs text-[10px]" />
                    {{
                      completingMemberFeedbackAllocation
                        ? 'Member feedback — adjust target'
                        : typeCode === KPI_TYPE.TEAM
                          ? 'Selected list & target per member'
                          : typeCode === KPI_TYPE.INDIVIDUAL
                            ? 'Selected members'
                            : 'Set Specific Targets for Members'
                    }}
                  </p>
                  <p
                    v-if="formErrors.memberTargets"
                    class="mb-2 text-[11px] font-semibold leading-snug text-rose-600"
                  >
                    {{ formErrors.memberTargets }}
                  </p>
                  <div 
                    v-for="mem in visibleSelectedMembers" 
                    :key="mem" 
                    class="flex flex-col justify-between gap-2 rounded-lg border p-2.5 shadow-sm sm:flex-row sm:items-center sm:gap-3"
                    :class="
                      isFeedbackAssignee(mem)
                        ? 'border-amber-300 bg-amber-50 ring-1 ring-amber-200'
                        : 'border-slate-200 bg-white'
                    "
                  >
                    <span class="flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-slate-700 sm:min-w-[40%] sm:flex-1">
                      <i class="fas fa-user shrink-0 text-[10px] text-slate-400" />
                      <span class="truncate">{{ getMemberLabel(mem) }}</span>
                      <span
                        v-if="isFeedbackAssignee(mem)"
                        class="ml-1 inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800"
                        title="Member feedback — adjust target"
                      >
                        <i class="fas fa-comment-dots text-[8px]" />
                        Feedback
                      </span>
                    </span>
                    <div class="flex min-w-0 flex-1 items-center justify-end gap-2 sm:justify-end">
                      <input 
                        v-if="typeCode === KPI_TYPE.TEAM || typeCode === KPI_TYPE.PROMOTION"
                        v-model="memberTargets[mem]" 
                        type="number" 
                        min="0"
                        step="any"
                        placeholder="Enter target assigned to user..." 
                        :disabled="isMemberAllocationTargetLocked(mem)"
                        :title="
                          isMemberAllocationTargetLocked(mem)
                            ? 'Member has confirmed the KPI - allocation target cannot be edited.'
                            : undefined
                        "
                        class="min-w-0 flex-1 rounded-md border px-2 py-1.5 text-xs font-bold text-slate-800 outline-none transition-all focus:border-blue-400 focus:ring-1 focus:ring-blue-100 sm:max-w-[14rem]"
                        :class="
                          isMemberAllocationTargetLocked(mem)
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
                            : memberTargetRowHasValidationIssue(mem)
                              ? 'border-rose-400 bg-rose-50/50'
                              : 'border-slate-200 bg-white'
                        "
                      />
                      <button
                        v-if="useMemberAssignListBelow && !completingMemberFeedbackAllocation"
                        type="button"
                        :disabled="isMemberAllocationSelectionLocked(mem)"
                        :title="
                          isMemberAllocationSelectionLocked(mem)
                            ? 'Cannot remove a member who has confirmed / left pending Accept status.'
                            : undefined
                        "
                        class="shrink-0 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] font-bold text-rose-700 transition-colors hover:bg-rose-100"
                        :class="isMemberAllocationSelectionLocked(mem) ? 'cursor-not-allowed opacity-50 hover:bg-rose-50' : ''"
                        @click="toggleMember(mem)"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="completingMemberFeedbackAllocation && !isCreate"
            class="z-10 shrink-0 border-t border-violet-200 bg-violet-50 px-5 py-3 text-[11px] font-semibold leading-relaxed text-violet-900">
            <i class="fas fa-info-circle mr-1 text-violet-600" />
            Closing member feedback and saving allocation in one step. Review the list and targets, then confirm.
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
              :disabled="props.readonly || saving || !!allocationSaveBlockedReason" 
              :title="props.readonly ? 'Year is locked; data is read-only.' : allocationSaveBlockedReason || undefined"
              @click="handleSave"
            >
              <i v-if="saving" class="fas fa-spinner fa-spin text-sm" />
              <i v-else class="fas" :class="isCreate || isRejectedSelfCreatedEdit ? 'fa-paper-plane' : 'fa-save'" />
              {{
                saving
                  ? 'Saving…'
                  : isCreate
                    ? 'Create & Assign'
                    : isRejectedSelfCreatedEdit
                      ? 'Resubmit KPI'
                      : completingMemberFeedbackAllocation
                      ? 'Confirm allocation and close feedback'
                      : 'Save allocation'
              }}
            </button>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Drawer: backdrop fade + panel trượt từ phải (GPU-friendly) */
.gm-kpi-drawer-enter-active,
.gm-kpi-drawer-leave-active {
  transition-duration: 0.36s;
}
.gm-kpi-drawer-enter-active .gm-kpi-drawer-backdrop,
.gm-kpi-drawer-leave-active .gm-kpi-drawer-backdrop {
  transition: opacity 0.36s ease;
}
.gm-kpi-drawer-enter-active .gm-kpi-drawer-panel,
.gm-kpi-drawer-leave-active .gm-kpi-drawer-panel {
  transition: transform 0.36s cubic-bezier(0.16, 1, 0.3, 1);
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
  transform: translate3d(100%, 0, 0);
}
.gm-kpi-drawer-enter-to .gm-kpi-drawer-panel,
.gm-kpi-drawer-leave-from .gm-kpi-drawer-panel {
  transform: translate3d(0, 0, 0);
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
