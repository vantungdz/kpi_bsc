<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { pmKpiService } from '@/services/modules/kpi-pm.service'
import { memberKpiService } from '@/services/modules/kpi-member.service'
import type { UpdateMemberSheetItemBody } from '@/services/modules/kpi-member.service'
import EvaluationCommentBlock from '@/components/evaluation/EvaluationCommentBlock.vue'
import EvaluationEvidenceDrawer from '@/components/evaluation/EvaluationEvidenceDrawer.vue'
import GmStrategicKpiTypeTag from '@/components/gm/GmStrategicKpiTypeTag.vue'
import { getPmPortfolioSubmitButtonState } from '@/utils/common'
import { KPI_STATUS, KPI_TYPE } from '@/config/constants'
import {
  formatPmPortfolioActualCell,
  parseNumericFromField,
  CALC_RULE_AVERAGE,
  type PmPortfolioActualDisplayMode,
} from '@/utils/memberKpiHelpers'
import { useToast } from 'vue-toastification'
import { fileService } from '@/services/modules/file.service'
import { useAuthStore } from '@/stores/auth.store'
import { formatKpiTargetWithUnit } from '@/utils/kpiUnitCodes'

const props = withDefaults(
  defineProps<{
    /** Tab KPI Portfolio (individual + team) hoặc chỉ KPI Promotion. */
    portfolioScope?: 'portfolio' | 'promotion'
  }>(),
  { portfolioScope: 'portfolio' },
)

const toast = useToast()
const authStore = useAuthStore()
const removingChildAssignmentIds = ref<Set<string>>(new Set())
const sendingPmFeedbackIds = ref<Set<string>>(new Set())
const decidingMemberFeedbackIds = ref<Set<string>>(new Set())
const currentPmUserId = computed(() => String(authStore.user?.id ?? '').trim())

function formatTargetCell(v: unknown): string {
  if (v == null) return '-'
  const s = String(v).trim()
  return s === '' ? '-' : s
}

function formatTargetCellWithUnit(target: unknown, unitCode?: number | null): string {
  return formatKpiTargetWithUnit(formatTargetCell(target), unitCode)
}

/** Cột Thực tế: ghép đơn vị KPI (cùng rule cột Chỉ tiêu); hỗ trợ nhiều mục «a · b». */
function formatPmActualCellWithUnit(display: string, unitCode: unknown): string {
  const u = coercePortfolioUnitCode(unitCode)
  const s = String(display ?? '').trim()
  if (!s) return ''
  if (s.includes(' · ')) {
    const parts = s
      .split(' · ')
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length === 0) return ''
    return parts.map((part) => formatKpiTargetWithUnit(part, u)).join(' · ')
  }
  const withUnit = formatKpiTargetWithUnit(s, u)
  return withUnit === '-' ? '' : withUnit
}

function formatCompactNumericDisplay(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const rounded = Math.round(n * 100) / 100
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toFixed(2).replace(/\.?0+$/, '')
}

function coercePortfolioUnitCode(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

function parseTargetNumber(v: unknown): number {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : 0
}

type PmTargetBalance = 'short' | 'excess' | 'ok' | null

function normalizeNumericTarget(v: unknown): number | null {
  const s = String(v ?? '').trim()
  if (!s || s === '-') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function pmTargetPillClass(balance: PmTargetBalance): string {
  const base =
    'inline-block min-w-[2.25rem] rounded-md px-2 py-1 text-xs font-semibold tabular-nums leading-tight'
  if (balance === 'short') return `${base} border border-rose-200 bg-rose-50 text-rose-800`
  if (balance === 'excess') return `${base} border border-amber-200 bg-amber-50 text-amber-900`
  if (balance === 'ok') return `${base} border border-emerald-200 bg-emerald-50 text-emerald-800`
  return `${base} bg-slate-100 text-slate-700`
}

function pmParentTargetBalance(item: any): PmTargetBalance {
  if (!item?.isTree || !Array.isArray(item.children) || item.children.length === 0) return null
  /** Chỉ KPI Team (cascading): cha có target tổng, con là phân bổ — so khớp tổng con vs cha. Individual/Promotion: mỗi người cùng target gốc, không so theo kiểu cộng dồn. */
  if (!isTeamTreeKpi(item)) return null
  const parent = normalizeNumericTarget(item.target)
  if (parent == null) return null
  const childNums = item.children
    .map((c: any) => normalizeNumericTarget(c?.target))
    .filter((n: number | null): n is number => n != null)
  if (childNums.length === 0) return null
  const assigned = childNums.reduce((s: number, n: number) => s + n, 0)
  const diff = assigned - parent
  if (Math.abs(diff) < 1e-9) return 'ok'
  return diff > 0 ? 'excess' : 'short'
}

function pmParentTargetTitle(item: any): string | undefined {
  const balance = pmParentTargetBalance(item)
  if (balance === 'short') return 'Tổng target đã phân bổ cho members đang thấp hơn target KPI của PM.'
  if (balance === 'excess') return 'Tổng target đã phân bổ cho members đang vượt target KPI của PM.'
  if (balance === 'ok') return 'Tổng target đã phân bổ cho members khớp target KPI của PM.'
  return undefined
}

/** 802 (plan/actual nhiều dòng) → TB %; 803 và khác → một ô / nối tóm tắt theo helper. */
function pmPortfolioActualDisplayMode(calculationRuleCode: unknown): PmPortfolioActualDisplayMode {
  return Number(calculationRuleCode) === CALC_RULE_AVERAGE ? 'mean' : 'list'
}

/** Mọi % trong một ô Actual đã format (vd một dòng KPI có nhiều record). */
function extractPercentsFromFormattedActual(s: string): number[] {
  const out: number[] = []
  const re = /(\d+(?:\.\d+)?)\s*%/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    const n = Number(m[1])
    if (Number.isFinite(n)) out.push(n)
  }
  return out
}

/** Giá trị số (từ ô Actual đã format) để gộp lên cha; thiếu / không đọc được → 0. */
function numericActualValueForTeamChild(child: any, parentItem: any): number {
  const calc = parentItem.calculationTypeCode
  const mode = pmPortfolioActualDisplayMode(parentItem.calculationRuleCode)
  const formatted = formatPmPortfolioActualCell(child.actualResult, calc, mode).trim()
  if (!formatted) return 0

  const percents = extractPercentsFromFormattedActual(formatted)
  if (percents.length > 0) {
    const avg = percents.reduce((a, b) => a + b, 0) / percents.length
    return Number.isFinite(avg) ? Math.max(0, avg) : 0
  }

  const n = parseNumericFromField(formatted)
  if (n != null && Number.isFinite(n) && n >= 0) return n

  return 0
}

/**
 * KPI Team (cascading): cha không nhập Actual — lấy tổng giá trị số từ Actual của các node con trực tiếp,
 * rồi hiển thị cùng đơn vị KPI (`unitCode`). Con chưa có Actual → 0 trong phép cộng.
 */
function formatPmTeamParentActualCell(item: any): string {
  const calc = item.calculationTypeCode
  const mode = pmPortfolioActualDisplayMode(item.calculationRuleCode)

  if (!item?.isTree || !Array.isArray(item.children) || item.children.length === 0) {
    return formatPmActualCellWithUnit(
      formatPmPortfolioActualCell(item.actualResult, calc, mode).trim(),
      item.unitCode,
    )
  }

  const children = item.children as any[]
  const scores = children.map((c) => numericActualValueForTeamChild(c, item))
  const total = scores.reduce((a, b) => a + b, 0)
  const safe = Number.isFinite(total) ? Math.max(0, total) : 0
  return formatPmActualCellWithUnit(formatCompactNumericDisplay(safe), item.unitCode)
}

const emit = defineEmits([
  'open-assign',
  'open-assign-after-member-feedback',
  'open-member-detail',
  'feedback-pending-count',
  'timeline-refresh',
])

/**
 * Dòng KPI không phải cây Team: Individual (tab Portfolio) hoặc Promotion (tab KPI Promotion).
 * Chưa Accept (404) thì khóa nút Edit minh chứng — cùng rule với Individual.
 */
function isPmDirectAssignmentEditLockedBeforeAccept(item: any): boolean {
  if (!item || item.isTree) return false
  if (Number(item.statusCode) === KPI_STATUS.FEEDBACK_IN_PROGRESS) return true
  if (Number(item.statusCode) !== KPI_STATUS.PENDING_ACCEPTANCE) return false

  if (props.portfolioScope === 'portfolio') {
    return Number(item.typeCode) === KPI_TYPE.INDIVIDUAL || item.kpiType === 'individual'
  }
  return Number(item.typeCode) === KPI_TYPE.PROMOTION || item.kpiType === 'promotion'
}

function pmDirectAssignmentEditLockReason(item: any): string | undefined {
  if (Number(item?.statusCode) === KPI_STATUS.FEEDBACK_IN_PROGRESS) {
    return 'KPI đang chờ GM xử lý feedback.'
  }
  if (isPmDirectAssignmentEditLockedBeforeAccept(item)) {
    return 'Vui lòng chấp nhận KPI trước khi chỉnh sửa.'
  }
  return undefined
}

/** KPI Team — dòng cascade của chính PM: chỉ Edit Actual sau khi PM đã Accept KPI (assignment cha ≥405). */
function isPmTeamSelfRowActualEditLockedBeforeAccept(parentItem: any): boolean {
  if (!parentItem?.isTree) return false
  return (
    Number(parentItem.statusCode) === KPI_STATUS.PENDING_ACCEPTANCE ||
    Number(parentItem.statusCode) === KPI_STATUS.FEEDBACK_IN_PROGRESS
  )
}

function pmTeamSelfRowLockReason(parentItem: any): string | undefined {
  if (Number(parentItem?.statusCode) === KPI_STATUS.FEEDBACK_IN_PROGRESS) {
    return 'KPI đang chờ GM xử lý feedback.'
  }
  if (Number(parentItem?.statusCode) === KPI_STATUS.PENDING_ACCEPTANCE) {
    return 'Vui lòng chấp nhận KPI trước khi chỉnh sửa.'
  }
  return undefined
}

function isPmGmFeedbackPending(item: any): boolean {
  return Number(item?.statusCode) === KPI_STATUS.FEEDBACK_IN_PROGRESS
}

function pmFeedbackPendingRowClass(item: any): string {
  if (!isPmGmFeedbackPending(item)) return ''
  return 'bg-violet-100/70 border-y border-violet-300'
}

function isSendingPmFeedback(assignmentId: unknown): boolean {
  return sendingPmFeedbackIds.value.has(String(assignmentId ?? ''))
}

const personalKpisRaw = ref<any[]>([])
const kpiCycleInfo = ref<any>(null)

async function loadPmPortfolio(cycleId?: string) {
  try {
    const data:any = await pmKpiService.getInitialization(cycleId)
    
    // Map backend Enums sang UI String
    const typeMap: Record<number, string> = { 101: 'individual', 102: 'cascading', 103: 'promotion' }
    const statusMap: Record<number, string> = { 401: 'draft', 402: 'pending_approval', 403: 'pending_approval', 404: 'pending_approval', 405: 'approved', 407: 'pending_approval' }

    // Map KpiGroupDto -> UI shape
    personalKpisRaw.value = (data.kpis ?? []).map((kpi: any) => ({
      id: String(kpi.id),
      infoId: String(kpi.infoId),
      group: kpi.group || 'Khác', // Dùng luôn tên group BE trả về (vd: "A - Hiệu quả công việc...")
      code: kpi.code,
      /** Mã loại BE (101/102/103) — drawer Assign dùng để phân biệt Team vs catalog target. */
      typeCode: typeof kpi.kpiType === 'number' ? kpi.kpiType : undefined,
      kpiType: typeMap[kpi.kpiType] || 'individual',
      isImportant: kpi.isImportant,
      // Lấy tạm status của con đầu tiên làm status cha để phục vụ filter
      status: kpi.children?.length ? (statusMap[kpi.children[0].statusCode] || 'pending_approval') : 'pending_approval',
      name: kpi.name,
      target: kpi.target,
      actualResult: kpi.actualResult != null ? String(kpi.actualResult) : '',
      weight: kpi.weight,
      statusCode: kpi.statusCode,
      feedbackNote: kpi.feedbackNote ?? '',
      selfScore: kpi.selfScore != null ? Number(kpi.selfScore) : null,
      pmScore: kpi.pmScore != null ? Number(kpi.pmScore) : null,
      calculationRuleCode:
        kpi.calculationRuleCode != null ? Number(kpi.calculationRuleCode) : undefined,
      calculationTypeCode:
        kpi.calculationTypeCode != null ? Number(kpi.calculationTypeCode) : undefined,
      unitCode: coercePortfolioUnitCode(kpi.unitCode ?? kpi.unit_code),
      targetDescription:
        kpi.targetDescriptionJson != null && String(kpi.targetDescriptionJson).trim() !== ''
          ? String(kpi.targetDescriptionJson)
          : '',
      isTree: kpi.isTree,
      expanded: kpi.expanded !== undefined ? kpi.expanded : true,
      isSelfCreated: Boolean(kpi.isSelfCreated),
      children: (kpi.children || []).map((c: any) => ({
        id: String(c.id),
        userId: c.userId != null ? String(c.userId) : undefined,
        name: c.name,
        role: c.role || 'Member',
        // Tự động generate Avatar từ 2 chữ cái đầu của tên
        avatar: c.name ? c.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'U',
        target: c.targetValue != null ? String(c.targetValue) : '',
        actualResult: c.actualResult || '',
        feedbackNote: c.feedbackNote ?? '',
        feedbackTargetRoleCode:
          c.feedbackTargetRoleCode != null && String(c.feedbackTargetRoleCode).trim() !== ''
            ? String(c.feedbackTargetRoleCode).trim().toUpperCase()
            : undefined,
        selfScore: c.selfScore != null ? Number(c.selfScore) : null,
        pmScore: c.pmScore != null ? Number(c.pmScore) : null,
        statusCode: c.statusCode,
        status: statusMap[c.statusCode] || 'pending_approval',
      }))
    }))
    
    kpiCycleInfo.value = data.kpiCycle
  } catch (err) {
    console.error('Failed to load PM portfolio', err)
  }
}

// --- LOGIC FILTER ---
const filterMember = ref('')
const filterImportant = ref<'' | 'yes' | 'no'>('')
const filterStatus = ref('')
const draftMember = ref('')
const draftImportant = ref<'' | 'yes' | 'no'>('')
const draftStatus = ref('')

const filterPopoverOpen = ref(false)
const filterPopoverWrapRef = ref<HTMLElement | null>(null)
const filterPanelFixedStyle = ref<Record<string, string>>({})

const currentStatusCode = computed(() => {
  const rows = scopedPersonalKpisRaw.value
  if (!rows.length) return KPI_STATUS.COMPLETED
  const firstKpi = rows[0]?.statusCode
  return firstKpi ?? KPI_STATUS.INACTIVE
})

const buttonState = computed(() => {
  if (!kpiCycleInfo.value) {
    return {
      show: false,
      disabled: true,
      text: '',
      actionType: 'COMPLETED' as const,
    }
  }

  const base = getPmPortfolioSubmitButtonState(
    kpiCycleInfo.value,
    Number(currentStatusCode.value),
  )
  if (
    base.actionType === 'GOAL_SETTING'
    && Number(currentStatusCode.value) === KPI_STATUS.PENDING_ACCEPTANCE
    && base.show
  ) {
    const blockReason = pmTeamAcceptKpiBlockedReason(scopedPersonalKpisRaw.value)
    if (blockReason) {
      return { ...base, disabled: true, reason: blockReason }
    }
  }
  return base
})

const diagnosticsMemberOptions = computed(() => {
  const set = new Set<string>()
  scopedPersonalKpisRaw.value.forEach(kpi => kpi.children?.forEach((c: any) => set.add(c.name)))
  return [...set].sort((a, b) => a.localeCompare(b, 'vi'))
})

function updateFilterPanelPosition() {
  const wrap = filterPopoverWrapRef.value
  if (!wrap) return
  const r = wrap.getBoundingClientRect()
  const w = 320
  filterPanelFixedStyle.value = { top: `${r.bottom + 8}px`, left: `${Math.max(8, r.right - w)}px`, width: `${w}px` }
}

async function toggleFilterPopover() {
  if (filterPopoverOpen.value) { filterPopoverOpen.value = false } 
  else {
    draftMember.value = filterMember.value; draftImportant.value = filterImportant.value; draftStatus.value = filterStatus.value;
    filterPopoverOpen.value = true; await nextTick(); updateFilterPanelPosition()
  }
}

function applyPopoverFilters() { filterMember.value = draftMember.value; filterImportant.value = draftImportant.value; filterStatus.value = draftStatus.value; filterPopoverOpen.value = false; }
function cancelFilterPopover() { filterPopoverOpen.value = false }
function resetAllDiagnosticFilters() { filterMember.value = ''; filterImportant.value = ''; filterStatus.value = ''; filterPopoverOpen.value = false }

const activeFilterChips = computed(() => {
  const chips = []
  if (filterMember.value) chips.push({ key: 'member', label: `Thành viên: ${filterMember.value}` })
  if (filterImportant.value === 'yes') chips.push({ key: 'important', label: 'KPI quan trọng' })
  if (filterImportant.value === 'no') chips.push({ key: 'important', label: 'Không gắn sao' })
  if (filterStatus.value) chips.push({ key: 'status', label: `Trạng thái: ${filterStatus.value === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'}` })
  return chips
})

function removeAppliedFilterChip(key: string) {
  if (key === 'member') filterMember.value = ''
  else if (key === 'important') filterImportant.value = ''
  else filterStatus.value = ''
}

onMounted(() => { window.addEventListener('resize', updateFilterPanelPosition); window.addEventListener('scroll', updateFilterPanelPosition, true) })
onUnmounted(() => {
  window.removeEventListener('resize', updateFilterPanelPosition)
  window.removeEventListener('scroll', updateFilterPanelPosition, true)
  document.body.style.overflow = ''
})

onMounted(() => { loadPmPortfolio(String(new Date().getFullYear())) })

const scopedPersonalKpisRaw = computed(() => {
  const rows = personalKpisRaw.value
  if (props.portfolioScope === 'promotion') {
    return rows.filter((kpi) => kpi.kpiType === 'promotion')
  }
  return rows.filter((kpi) => kpi.kpiType !== 'promotion')
})

const pendingFeedbackKpiCount = computed(() => {
  return scopedPersonalKpisRaw.value.filter(
    (kpi) => Array.isArray(kpi.children) && kpi.children.some((child: any) => isMemberFeedbackPendingForPm(child)),
  ).length
})

watch(
  [pendingFeedbackKpiCount, () => props.portfolioScope],
  ([count, scope]) => {
    emit('feedback-pending-count', { scope, count })
  },
  { immediate: true },
)

const sectionHeading = computed(() =>
  props.portfolioScope === 'promotion' ? 'KPI Promotion' : 'KPI Portfolio',
)

const employeeCommentAnchorId = computed(() =>
  props.portfolioScope === 'promotion' ? 'pm-promotion-my-comment' : 'pm-portfolio-my-comment',
)

const groupedPersonalKpis = computed(() => {
  const filtered = scopedPersonalKpisRaw.value.filter(kpi => {
    if (filterImportant.value === 'yes' && !kpi.isImportant) return false
    if (filterImportant.value === 'no' && kpi.isImportant) return false
    if (filterStatus.value && kpi.status !== filterStatus.value) return false
    if (filterMember.value && !kpi.children?.some((c: any) => c.name === filterMember.value)) return false
    return true
  })
  
  // Tự động gom nhóm dựa trên key "group" (vd: "A - Hiệu quả công việc...")
  const groups = filtered.reduce((acc: any, item: any) => { 
    (acc[item.group] ??= []).push(item); 
    return acc; 
  }, {});
  
  // Sắp xếp tự động để A nằm trước B, B nằm trước C
  return Object.keys(groups).sort().map(key => ({ 
    key, 
    label: key, // Dùng luôn tên làm label
    items: groups[key] || [] 
  }));
})

function visibleChildrenForItem(item: any): any[] {
  const all = Array.isArray(item?.children) ? item.children : []
  if (!filterMember.value) return all
  return all.filter((c: any) => c?.name === filterMember.value)
}

/** Tổng trọng số (%) của các KPI cha đang hiển thị (đã áp dụng bộ lọc); không cộng dòng con. */
const totalPortfolioWeight = computed(() => {
  let sum = 0
  for (const g of groupedPersonalKpis.value) {
    for (const item of g.items) {
      const w = item.weight
      if (w == null || w === '') continue
      const n = typeof w === 'number' ? w : Number(w)
      if (Number.isFinite(n)) sum += n
    }
  }
  return sum
})

const totalPortfolioWeightDisplay = computed(() => {
  const s = totalPortfolioWeight.value
  if (!Number.isFinite(s) || s === 0) return '0'
  return Number.isInteger(s) ? String(s) : s.toFixed(1).replace(/\.?0+$/, '')
})

function formatWeightedTotalDisplay(sum: number): string {
  const rounded = Math.round(sum * 100) / 100
  if (rounded % 1 === 0) return String(rounded)
  return String(rounded.toFixed(2).replace(/\.?0+$/, ''))
}

function isTeamTreeKpi(item: any): boolean {
  if (!item?.isTree) return false
  if (item.typeCode === KPI_TYPE.TEAM) return true
  return item.kpiType === 'cascading'
}

/**
 * Accept KPI (404→405): mỗi KPI Team phải có ít nhất một assignment con;
 * mọi thành viên được phân bổ (không tính dòng «dư target» của chính PM, trùng user PM) phải ≥405.
 */
function pmTeamAcceptKpiBlockedReason(rows: any[]): string | null {
  const pmUid = currentPmUserId.value.trim()
  for (const item of rows) {
    if (!isTeamTreeKpi(item)) continue
    const children = Array.isArray(item.children) ? item.children : []
    if (children.length === 0) {
      return 'Cần phân bổ KPI Team cho ít nhất một thành viên trước khi chấp nhận KPI.'
    }
    const others = pmUid
      ? children.filter((c: any) => String(c?.userId ?? '').trim() !== pmUid)
      : children
    if (others.length === 0) continue
    if (others.some((c: any) => Number(c.statusCode) < KPI_STATUS.ACCEPTED)) {
      return 'Vui lòng chờ tất cả thành viên được phân bổ xác nhận KPI trước.'
    }
  }
  return null
}

function averageOfNumericList(values: unknown[]): number | null {
  const nums: number[] = []
  for (const v of values) {
    if (v == null || v === '') continue
    const n = typeof v === 'number' ? v : Number(v)
    if (Number.isFinite(n)) nums.push(n)
  }
  if (nums.length === 0) return null
  let s = 0
  for (const n of nums) s += n
  return s / nums.length
}

/**
 * Self score dùng cho dòng KPI cha và tổng có trọng số: KPI Team = trung bình self
 * do từng thành viên gửi; KPI khác dùng self trên assignment cha.
 */
function effectiveSelfScoreForParent(item: any): number | null {
  if (isTeamTreeKpi(item) && Array.isArray(item.children) && item.children.length > 0) {
    return averageOfNumericList(item.children.map((c: any) => c.selfScore))
  }
  const raw = item.selfScore
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : null
}

function formatSelfScoreCell(item: any): string {
  const v = effectiveSelfScoreForParent(item)
  if (v == null) return '-'
  return formatWeightedTotalDisplay(v)
}

function collectPortfolioParentRows(): any[] {
  const rows: any[] = []
  for (const g of groupedPersonalKpis.value) {
    for (const item of g.items) rows.push(item)
  }
  return rows
}

/** Một vòng lặp: tổng (điểm × trọng số) Self / Supervisor và số dòng góp phần. */
const portfolioWeightedTotals = computed(() => {
  const rows = collectPortfolioParentRows()
  let selfSum = 0
  let pmSum = 0
  let selfContributed = 0
  let pmContributed = 0
  for (const item of rows) {
    const rawW = item.weight
    if (rawW === null || rawW === undefined || rawW === '') continue
    const weightNum = typeof rawW === 'number' ? rawW : Number(rawW)
    if (!Number.isFinite(weightNum)) continue

    const selfNum = effectiveSelfScoreForParent(item)
    if (selfNum != null && Number.isFinite(selfNum)) {
      selfSum += selfNum * weightNum
      selfContributed += 1
    }
    const rawP = item.pmScore
    if (rawP !== null && rawP !== undefined && rawP !== '') {
      const pmNum = typeof rawP === 'number' ? rawP : Number(rawP)
      if (Number.isFinite(pmNum)) {
        pmSum += pmNum * weightNum
        pmContributed += 1
      }
    }
  }
  return { selfSum, pmSum, selfContributed, pmContributed }
})

/**
 * Tổng Σ(selfScore × weight) trên các KPI cha đang hiển thị (cùng bộ lọc).
 * Chỉ cộng dòng đã có đủ self score và trọng số; dòng chưa nhập bỏ qua.
 * Không có dòng nào đủ dữ liệu → "-".
 */
const totalWeightedSelfScoreDisplay = computed((): string => {
  const { selfSum, selfContributed } = portfolioWeightedTotals.value
  if (selfContributed === 0 || !Number.isFinite(selfSum)) return '-'
  return formatWeightedTotalDisplay(selfSum)
})

/**
 * Tổng Σ(Supervisor score × weight) — cùng logic với Self, dùng {@code pmScore} trên dòng cha.
 */
const totalWeightedPmScoreDisplay = computed((): string => {
  const { pmSum, pmContributed } = portfolioWeightedTotals.value
  if (pmContributed === 0 || !Number.isFinite(pmSum)) return '-'
  return formatWeightedTotalDisplay(pmSum)
})

/** Điểm trung bình Self = (tổng cột Self total) / (tổng trọng số cột Weight). */
const averageSelfScoreDisplay = computed((): string => {
  const tw = totalPortfolioWeight.value
  const { selfSum, selfContributed } = portfolioWeightedTotals.value
  if (!Number.isFinite(tw) || tw <= 0 || selfContributed === 0 || !Number.isFinite(selfSum)) return '-'
  return formatWeightedTotalDisplay(selfSum / tw)
})

/** Điểm trung bình Supervisor = (tổng cột Supervisor total) / (tổng trọng số cột Weight). */
const averagePmScoreDisplay = computed((): string => {
  const tw = totalPortfolioWeight.value
  const { pmSum, pmContributed } = portfolioWeightedTotals.value
  if (!Number.isFinite(tw) || tw <= 0 || pmContributed === 0 || !Number.isFinite(pmSum)) return '-'
  return formatWeightedTotalDisplay(pmSum / tw)
})

const pmComments = ref({ selfComment: '', supervisorComment: '' })
const evidencePanelOpen = ref(false)
const selectedKpiItem = ref<any>(null)
const feedbackDrawerOpen = ref(false)
const feedbackDrawerAssignment = ref<any | null>(null)
const feedbackDraftText = ref('')

const openEvidenceDrawer = (item: any) => { selectedKpiItem.value = item; evidencePanelOpen.value = true; }


function isChildOwnedByCurrentPm(child: any): boolean {
  const uid = String(child?.userId ?? '').trim()
  return uid !== '' && uid === currentPmUserId.value
}

function isMemberFeedbackPendingForPm(child: any): boolean {
  const role = String(child?.feedbackTargetRoleCode ?? '').trim().toUpperCase()
  return (
    !isChildOwnedByCurrentPm(child) &&
    Number(child?.statusCode) === KPI_STATUS.FEEDBACK_IN_PROGRESS &&
    String(child?.id ?? '').trim() !== '' &&
    role === 'PM'
  )
}

const memberFeedbackReviewDrawerOpen = ref(false)
const memberFeedbackReviewTarget = ref<any | null>(null)

function openMemberFeedbackReviewDrawer(child: any, parent: any) {
  const assignmentId = String(child?.id ?? '').trim()
  if (!assignmentId) return
  memberFeedbackReviewTarget.value = {
    assignmentId,
    parentItem: parent,
    memberName: String(child?.name ?? '').trim() || 'Member',
    role: String(child?.role ?? '').trim() || 'Member',
    note: String(child?.feedbackNote ?? '').trim() || 'Không có nội dung feedback.',
    parentName: String(parent?.name ?? '').trim() || 'KPI',
    parentTarget: parent?.target,
    parentUnitCode: parent?.unitCode,
    parentWeight: parent?.weight,
    parentKpiType: parent?.kpiType,
  }
  memberFeedbackReviewDrawerOpen.value = true
}

/** KPI Team: chấp nhận → drawer phân bổ + API accept-with-cascade khi xác nhận. Không phải Team: duyệt feedback ngay (407→404). */
function acceptMemberFeedbackFromDrawer() {
  const target = memberFeedbackReviewTarget.value
  const assignmentId = String(target?.assignmentId ?? '').trim()
  const parent = target?.parentItem
  if (!assignmentId || !target || !parent) return
  if (!isTeamTreeKpi(parent)) {
    void decideMemberFeedbackFromDrawer(true)
    return
  }
  emit('open-assign-after-member-feedback', { parentKpi: parent, feedbackAssignmentId: assignmentId })
  closeMemberFeedbackReviewDrawer()
}

function closeMemberFeedbackReviewDrawer() {
  memberFeedbackReviewDrawerOpen.value = false
  memberFeedbackReviewTarget.value = null
}

function isDecidingMemberFeedback(assignmentId: unknown): boolean {
  return decidingMemberFeedbackIds.value.has(String(assignmentId ?? '').trim())
}

async function decideMemberFeedbackFromDrawer(approve: boolean) {
  const target = memberFeedbackReviewTarget.value
  const assignmentId = String(target?.assignmentId ?? '').trim()
  if (!assignmentId || isDecidingMemberFeedback(assignmentId)) return
  const year = Number(currentPortfolioYearParam())
  if (!Number.isFinite(year)) {
    toast.error('Không xác định được năm chu kỳ để xử lý feedback.')
    return
  }
  decidingMemberFeedbackIds.value = new Set(decidingMemberFeedbackIds.value).add(assignmentId)
  try {
    await pmKpiService.decideMemberFeedback({ year, assignmentId, approve })
    toast.success(approve ? 'Đã duyệt feedback của member.' : 'Đã từ chối feedback của member.')
    closeMemberFeedbackReviewDrawer()
    await loadPmPortfolio(currentPortfolioYearParam())
    emit('timeline-refresh')
  } catch (err: unknown) {
    toast.error(sheetUpdateErrorMessage(err))
  } finally {
    const next = new Set(decidingMemberFeedbackIds.value)
    next.delete(assignmentId)
    decidingMemberFeedbackIds.value = next
  }
}

function openChildEvidenceDrawer(child: any, parent: any) {
  openEvidenceDrawer({
    id: child?.id != null ? String(child.id) : undefined,
    name: `${parent?.name ?? 'KPI'} · ${child?.name ?? 'PM'}`,
    target: child?.target ?? '-',
    actualResult: child?.actualResult ?? '',
    selfScore: child?.selfScore ?? null,
    statusCode: child?.statusCode,
    calculationRuleCode: parent?.calculationRuleCode,
    calculationTypeCode: parent?.calculationTypeCode,
    targetDescription: parent?.targetDescription ?? '',
  })
}


function currentPortfolioYearParam(): string {
  const y = Number(kpiCycleInfo.value?.year)
  if (Number.isFinite(y) && y > 0) return String(y)
  return String(new Date().getFullYear())
}

function openFeedbackDrawer(item: any) {
  feedbackDrawerAssignment.value = item
  feedbackDraftText.value = isPmGmFeedbackPending(item) ? String(item?.feedbackNote ?? '').trim() : ''
  feedbackDrawerOpen.value = true
}

function closeFeedbackDrawer() {
  feedbackDrawerOpen.value = false
  feedbackDrawerAssignment.value = null
  feedbackDraftText.value = ''
}

async function sendFeedbackToGmForAssignment(item: any) {
  const assignmentId = String(item?.id ?? '').trim()
  if (!assignmentId) return
  if (Number(item?.statusCode) !== KPI_STATUS.PENDING_ACCEPTANCE) {
    toast.info('Chỉ gửi feedback khi KPI đang ở trạng thái chờ chấp nhận (404).')
    return
  }
  const feedbackNote = feedbackDraftText.value.trim()
  if (!feedbackNote) {
    toast.error('Vui lòng nhập nội dung feedback.')
    return
  }
  if (isSendingPmFeedback(assignmentId)) return

  const year = Number(currentPortfolioYearParam())
  if (!Number.isFinite(year)) {
    toast.error('Không xác định được năm chu kỳ để gửi feedback.')
    return
  }

  sendingPmFeedbackIds.value = new Set(sendingPmFeedbackIds.value).add(assignmentId)
  try {
    await pmKpiService.submitFeedbackToGm({
      year,
      assignmentId,
      feedbackNote,
    })
    feedbackDraftText.value = ''
    toast.success('Đã gửi feedback cho GM.')
    closeFeedbackDrawer()
    await loadPmPortfolio(currentPortfolioYearParam())
    emit('timeline-refresh')
  } catch (err: unknown) {
    toast.error(sheetUpdateErrorMessage(err))
  } finally {
    const next = new Set(sendingPmFeedbackIds.value)
    next.delete(assignmentId)
    sendingPmFeedbackIds.value = next
  }
}

function isPmFeedbackDrawerReadonly(): boolean {
  return Number(feedbackDrawerAssignment.value?.statusCode) === KPI_STATUS.FEEDBACK_IN_PROGRESS
}

watch([feedbackDrawerOpen, memberFeedbackReviewDrawerOpen], ([gmDrawerOpen, memberDrawerOpen]) => {
  document.body.style.overflow = gmDrawerOpen || memberDrawerOpen ? 'hidden' : ''
})

function isRemovingChildAssignment(assignmentId: string): boolean {
  return removingChildAssignmentIds.value.has(String(assignmentId))
}

async function removeAssignedMemberFromTeamKpi(parent: any, child: any) {
  if (!parent?.id || !parent?.infoId || !kpiCycleInfo.value?.id) {
    toast.error('Thiếu dữ liệu KPI để xóa phân bổ.')
    return
  }
  if (!child?.id || !child?.userId) {
    toast.error('Không xác định được thành viên cần xóa.')
    return
  }
  const ok = window.confirm(`Xóa phân bổ của ${child.name ?? 'thành viên này'} khỏi KPI này?`)
  if (!ok) return

  const rid = String(child.id)
  removingChildAssignmentIds.value = new Set(removingChildAssignmentIds.value).add(rid)
  try {
    const memberTargets: Record<string, number> = {}
    for (const c of parent.children ?? []) {
      if (String(c?.id ?? '') === rid) continue
      const uid = String(c?.userId ?? '').trim()
      if (!uid) continue
      memberTargets[uid] = parseTargetNumber(c?.target)
    }

    await pmKpiService.cascadeKpi({
      kpiInformationId: parent.infoId,
      cycleId: kpiCycleInfo.value.id,
      parentAssignmentId: parent.id,
      memberTargets,
    })
    toast.success('Đã xóa phân bổ thành viên.')
    await loadPmPortfolio(currentPortfolioYearParam())
    emit('timeline-refresh')
  } catch (err) {
    console.error('Failed to remove assigned member from team KPI', err)
    toast.error('Không thể xóa phân bổ. Vui lòng thử lại.')
  } finally {
    const next = new Set(removingChildAssignmentIds.value)
    next.delete(rid)
    removingChildAssignmentIds.value = next
  }
}

const deletingSelfCreatedKpiIds = ref<Set<string>>(new Set())

const deleteConfirmModalOpen = ref(false)
const deleteConfirmItem = ref<any>(null)

function promptDeleteSelfCreatedPmKpi(item: any) {
  deleteConfirmItem.value = item
  deleteConfirmModalOpen.value = true
}

function closeDeleteConfirmModal() {
  deleteConfirmModalOpen.value = false
  deleteConfirmItem.value = null
}

async function executeDeleteSelfCreatedPmKpi() {
  const item = deleteConfirmItem.value
  if (!item?.id) return

  const assignmentId = String(item.id)
  deletingSelfCreatedKpiIds.value = new Set(deletingSelfCreatedKpiIds.value).add(assignmentId)

  try {
    closeDeleteConfirmModal()
    // Calling the new backend endpoint
    await pmKpiService.deleteSelfCreatedPmKpi(assignmentId)
    toast.success('Đã xóa KPI thành công.')
    await loadPmPortfolio(currentPortfolioYearParam())
    emit('timeline-refresh')
  } catch (err: unknown) {
    toast.error(sheetUpdateErrorMessage(err))
  } finally {
    const next = new Set(deletingSelfCreatedKpiIds.value)
    next.delete(assignmentId)
    deletingSelfCreatedKpiIds.value = next
  }
}

function sheetUpdateErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const ax = err as { response?: { data?: { message?: string | null } } }
    const m = ax.response?.data?.message
    if (m != null && String(m).trim() !== '') return String(m)
  }
  if (err instanceof Error) return err.message
  return 'Không lưu được — vui lòng thử lại'
}

/**
 * Lưu self score + evidences vào DB qua API member (PM có quyền PUT /kpi/member/sheet/:assignmentId cho assignment của chính PM).
 */
async function saveEvidenceData(data: {
  id?: string
  actualResult: string
  selfScore: number | null
  files?: { id: string; file: File }[]
  urls?: { id: string; url: string; name?: string }[]
}) {
  const assignmentId = data.id
  if (!assignmentId) {
    evidencePanelOpen.value = false
    return
  }

  const finalUrls = [...(data.urls ?? [])]
  if (data.files && data.files.length > 0) {
    try {
      toast.info('Đang tải file lên...')
      for (const item of data.files) {
        const res = await fileService.uploadFile(item.file)
        finalUrls.push({ id: Math.random().toString(), url: res.url, name: res.name })
      }
    } catch (e) {
      toast.error('Lỗi khi tải file lên')
      return
    }
  }

  const body: UpdateMemberSheetItemBody = {}
  if (data.selfScore != null) {
    const n = typeof data.selfScore === 'number' ? data.selfScore : Number(data.selfScore)
    if (Number.isFinite(n)) body.selfScore = Math.round(n)
  }

  let evJson: Record<string, any> = {}
  if (typeof data.actualResult === 'string' && data.actualResult.trim() !== '') {
    try {
      evJson = JSON.parse(data.actualResult)
    } catch (e) {}
  }
  if (finalUrls.length > 0) {
    // Đồng bộ với member (`useMemberEvidenceDrawer`) và leader (`EvidenceDrawer`): key `files`
    delete evJson.urls
    delete evJson.evd
    evJson.files = finalUrls.map(u => ({ url: u.url, name: u.name || '' }))
  }

  const finalActualResult = Object.keys(evJson).length > 0 ? JSON.stringify(evJson) : ''
  if (finalActualResult !== '') body.evidences = finalActualResult

  try {
    await memberKpiService.updateSheetItem(assignmentId, body)
    toast.success('Đã lưu minh chứng và điểm tự đánh giá.')
    evidencePanelOpen.value = false
    await loadPmPortfolio(String(new Date().getFullYear()))
  } catch (err: unknown) {
    toast.error(sheetUpdateErrorMessage(err))
  }
}

/** Self score hợp lệ cho gửi Send Review (1–5). */
function isValidSelfScore(v: unknown): boolean {
  if (v == null || v === '') return false
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n >= 1 && n <= 5
}

/** Validation Send Review: tô khung đỏ ô thiếu (Self score = cột dòng KPI cha; KPI Team cũng tô ở dòng cha). */
const sendReviewErrorComment = ref(false)
/** Dòng KPI cha thiếu self score hoặc (KPI Team) còn member thiếu self score. */
const sendReviewErrorParentIds = ref<Set<string>>(new Set())

function clearSendReviewFieldHighlights() {
  sendReviewErrorComment.value = false
  sendReviewErrorParentIds.value = new Set()
}

watch(
  () => pmComments.value.selfComment,
  (v) => {
    if (sendReviewErrorComment.value && String(v ?? '').trim()) {
      sendReviewErrorComment.value = false
    }
  },
)

function expandParentsWithChildSelfErrors() {
  for (const item of scopedPersonalKpisRaw.value) {
    if (!isTeamTreeKpi(item) || !item.children?.length) continue
    const anyChildBad = item.children.some((c: any) => !isValidSelfScore(c.selfScore))
    if (anyChildBad) item.expanded = true
  }
}

/**
 * Send Review (405/503): kiểm tra My Comment + Self score mọi KPI / từng member Team.
 * @returns true nếu hợp lệ
 */
function runSendReviewFieldValidation(): boolean {
  sendReviewErrorComment.value = !pmComments.value.selfComment?.trim()

  const badParents = new Set<string>()

  for (const item of scopedPersonalKpisRaw.value) {
    const pid = String(item.id)
    if (isTeamTreeKpi(item) && item.children?.length) {
      const anyMemberMissing = item.children.some((c: any) => !isValidSelfScore(c.selfScore))
      if (anyMemberMissing) badParents.add(pid)
    } else if (!isValidSelfScore(item.selfScore)) {
      badParents.add(pid)
    }
  }

  sendReviewErrorParentIds.value = badParents

  const ok = !sendReviewErrorComment.value && badParents.size === 0
  if (!ok) {
    expandParentsWithChildSelfErrors()
    scrollToFirstSendReviewFieldError()
  }
  return ok
}

function scrollToFirstSendReviewFieldError() {
  nextTick(() => {
    if (sendReviewErrorComment.value) {
      document
        .getElementById(employeeCommentAnchorId.value)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    const firstParent = [...sendReviewErrorParentIds.value].sort()[0]
    if (firstParent) {
      document
        .getElementById(`pm-kpi-parent-${firstParent}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

const handleSubmitClick = async () => {
  if (buttonState.value.disabled || !kpiCycleInfo.value?.id) return

  if (
    buttonState.value.actionType === 'MID_YEAR' ||
    buttonState.value.actionType === 'END_YEAR'
  ) {
    if (!runSendReviewFieldValidation()) {
      toast.error('Vui lòng nhập đầy đủ thông tin.')
      return
    }
    clearSendReviewFieldHighlights()
  }

  let nextStatusCode: number
  let onlyFrom: number

  if (buttonState.value.actionType === 'GOAL_SETTING') {
    nextStatusCode = KPI_STATUS.ACCEPTED
    onlyFrom = KPI_STATUS.PENDING_ACCEPTANCE
  } else if (buttonState.value.actionType === 'MID_YEAR') {
    nextStatusCode = KPI_STATUS.FIRST_WAITING_GM_APPROVAL
    onlyFrom =
      Number(currentStatusCode.value) === KPI_STATUS.FIRST_COMPLETED
        ? KPI_STATUS.FIRST_COMPLETED
        : KPI_STATUS.ACCEPTED
  } else if (buttonState.value.actionType === 'END_YEAR') {
    nextStatusCode = KPI_STATUS.SECOND_WAITING_GM_APPROVAL
    onlyFrom =
      Number(currentStatusCode.value) === KPI_STATUS.FIRST_COMPLETED
        ? KPI_STATUS.FIRST_COMPLETED
        : KPI_STATUS.ACCEPTED
  } else {
    return
  }

  const promotionFlag = props.portfolioScope === 'promotion'

  const payload: Record<string, unknown> = {
    cycleId: kpiCycleInfo.value.id,
    statusCode: nextStatusCode,
    promotion: promotionFlag,
    onlyFromStatusCode: onlyFrom,
  }

  const toastOk =
    buttonState.value.actionType === 'GOAL_SETTING'
      ? 'Đã chấp nhận KPI.'
      : 'Đã gửi đánh giá (Send Review).'

  Promise.all([pmKpiService.bulkUpdateKpiStatus(payload)])
    .then(() => {
      clearSendReviewFieldHighlights()
      toast.success(toastOk)
      loadPmPortfolio(String(new Date().getFullYear()))
      emit('timeline-refresh')
    })
    .catch(err => {
      console.error('Failed to update KPI statuses', err)
    })
}
</script>

<template>
  <div class="animate-fade-in flex flex-col relative">
    
    <div class="flex flex-col gap-3 border-b border-slate-200 p-5 shrink-0">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <h3 class="font-bold text-slate-800 text-lg flex items-center gap-2">
          <i :class="portfolioScope === 'promotion' ? 'fas fa-arrow-trend-up text-purple-500' : 'fas fa-list-alt text-slate-400'"></i>
          {{ sectionHeading }}
        </h3>

        <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button @click.stop="resetAllDiagnosticFilters" class="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">
            <i class="fas fa-rotate-left text-[11px]" /> Reset Filter
          </button>

          <div ref="filterPopoverWrapRef" class="relative">
            <button @click.stop="toggleFilterPopover" class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
              <i class="fas fa-sliders-h text-sm text-slate-500" /> Bộ lọc
              <span v-if="activeFilterChips.length > 0" class="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-700">{{ activeFilterChips.length }}</span>
            </button>
          </div>
        </div>
      </div>

      <Teleport to="body">
        <Transition name="gm-diag-filter-pop">
          <div v-if="filterPopoverOpen" ref="filterPopoverPanelRef" class="fixed z-[200] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" :style="filterPanelFixedStyle">
            <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2.5">
              <h4 class="text-[11px] font-bold uppercase tracking-wider text-slate-600">Tùy chỉnh hiển thị</h4>
            </div>
            <div class="custom-scrollbar space-y-4 overflow-y-auto p-4">
              <div>
                <label class="mb-1.5 block text-[10px] font-bold text-slate-500">Thành viên</label>
                <select v-model="draftMember" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"><option value="">Tất cả</option><option v-for="n in diagnosticsMemberOptions" :key="n" :value="n">{{ n }}</option></select>
              </div>
              <div>
                <label class="mb-1.5 block text-[10px] font-bold text-slate-500">Mức độ quan trọng</label>
                <select v-model="draftImportant" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-amber-500"><option value="">Tất cả</option><option value="yes">Chỉ KPI quan trọng</option><option value="no">KPI thường</option></select>
              </div>
              <div>
                <label class="mb-1.5 block text-[10px] font-bold text-slate-500">Trạng thái KPI</label>
                <select v-model="draftStatus" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"><option value="">Tất cả</option><option value="approved">Đã duyệt</option><option value="pending_approval">Chờ duyệt</option></select>
              </div>
            </div>
            <div class="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-3 py-2.5">
              <button @click="cancelFilterPopover" class="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/60">Huỷ</button>
              <button @click="applyPopoverFilters" class="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700">Áp dụng</button>
            </div>
          </div>
        </Transition>
      </Teleport>
      
      <div v-if="activeFilterChips.length > 0" class="flex flex-wrap items-start gap-2 border-t border-slate-100 pt-3">
        <span class="mt-1.5 text-[10px] font-bold uppercase text-slate-400">Đang lọc:</span>
        <div class="flex flex-wrap gap-2">
          <span v-for="chip in activeFilterChips" :key="chip.key" class="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-800">{{ chip.label }} <button @click="removeAppliedFilterChip(chip.key)" class="ml-0.5 text-blue-400 hover:text-blue-900"><i class="fas fa-times text-[10px]" /></button></span>
        </div>
        <button
          type="button"
          class="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 shadow-sm hover:bg-slate-50"
          @click="resetAllDiagnosticFilters"
        >
          <i class="fas fa-eraser text-[10px]" />
          Xóa lọc
        </button>
      </div>
    </div>

    <div class="overflow-x-auto w-full">
      <table class="pm-kpi-portfolio-table w-full table-fixed border-collapse text-left">
        <colgroup>
          <col class="pm-kpi-col-stt" />
          <col class="pm-kpi-col-objective" />
          <col class="pm-kpi-col-target" />
          <col class="pm-kpi-col-actual" />
          <col class="pm-kpi-col-weight" />
          <col class="pm-kpi-col-self" />
          <col class="pm-kpi-col-sup" />
          <col class="pm-kpi-col-action" />
        </colgroup>
        <thead class="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
          <tr>
            <th class="py-4 px-5 text-center">STT</th>
            <th class="py-4 px-5">Hạng Mục (Objectives)</th>
            <th class="py-4 px-5">Chỉ Tiêu (Target)</th>
            <th class="py-4 px-5">Thực tế (Actual)</th>
            <th class="py-4 px-5 text-center">Weight</th>
            <th class="py-4 px-5 text-center border-x border-slate-100">Self Score</th>
            <th class="py-4 px-5 text-center">Supervisor Score</th>
            <th class="py-4 px-5 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <template v-for="groupData in groupedPersonalKpis" :key="groupData.key">
            <tr class="bg-amber-50/80 border-y border-amber-100"><td colspan="8" class="py-2.5 px-5 text-xs font-bold text-amber-800 uppercase">{{ groupData.label }}</td></tr>
            <template v-for="(item, idx) in groupData.items" :key="item.id">
              <tr
                :id="'pm-kpi-parent-' + item.id"
                class="cursor-pointer group"
                :class="
                  isPmGmFeedbackPending(item)
                    ? `${pmFeedbackPendingRowClass(item)} hover:bg-violet-100/80`
                    : 'hover:bg-slate-50'
                "
                @click="item.isTree ? item.expanded = !item.expanded : null"
              >
                <td class="py-4 px-5 text-center align-top pt-5"><span class="text-sm font-semibold text-slate-400">{{ Number(idx) + 1 }}</span></td>
                <td class="py-4 px-5 align-top pt-4">
                  <div class="flex items-start gap-2.5">
                    <button
                      v-if="item.isTree"
                      type="button"
                      :aria-expanded="item.expanded"
                      class="mt-0.5 shrink-0 w-5 h-5 flex items-center justify-center rounded bg-slate-100 text-slate-500 border border-slate-200 transition-transform duration-300"
                      :class="item.expanded ? 'rotate-0' : '-rotate-90'"
                      @click.stop="item.expanded = !item.expanded"
                    >
                      <i class="fas fa-chevron-down text-[10px]" />
                    </button>
                    <div v-else class="w-5 h-5 shrink-0"></div>
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="font-bold text-slate-900 text-sm">{{ item.code }} {{ item.name }}</p>
                      <GmStrategicKpiTypeTag
                        :type="item.kpiType"
                        size="sm"
                      />
                      <i v-if="item.isImportant" class="fas fa-star text-amber-400 text-xs" title="KPI Quan trọng"></i>
                    </div>
                  </div>
                </td>
                <td class="py-4 px-5 align-top pt-4">
                  <span
                    :class="pmTargetPillClass(pmParentTargetBalance(item))"
                    :style="{ textAlign: formatTargetCell(item.target) === '-' ? 'center' : 'left' }"
                    :title="pmParentTargetTitle(item)"
                  >
                    {{ formatTargetCellWithUnit(item.target, item.unitCode) }}
                  </span>
                </td>
                
                  <td class="py-4 px-5 align-top pt-4">
                    <p class="text-sm font-bold text-emerald-600">
                      {{ formatPmTeamParentActualCell(item) || 'Chưa cập nhật' }}
                    </p>
                  </td>
                
                <td class="py-4 px-5 text-center align-top pt-4"><span class="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 font-bold text-sm rounded-md">{{ item.weight }}</span></td>
                <td
                  class="py-4 px-5 text-center align-top pt-4 border-x border-slate-100 transition-shadow"
                  :class="
                    sendReviewErrorParentIds.has(String(item.id))
                      ? 'bg-rose-50/50 ring-2 ring-inset ring-rose-500 rounded-md'
                      : 'bg-blue-50/20'
                  "
                >
                  <span class="text-sm font-bold text-slate-800">{{ formatSelfScoreCell(item) }}</span>
                </td>
                <td class="py-4 px-5 text-center align-top pt-4"><span class="text-slate-400 font-medium text-sm">{{ item.pmScore ?? '-' }}</span></td>
                <td class="py-4 px-5 text-right align-top pt-4">
                    <div class="flex items-center justify-end gap-2">
                      <!-- Team KPI: phân bổ + Feedback GM (404/407); trước đây Feedback chỉ nằm trong nhánh !isTree nên PM team không thấy nút. -->
                      <button
                        v-if="item.isTree"
                        type="button"
                        @click.stop="$emit('open-assign', item)"
                        :disabled="isPmGmFeedbackPending(item)"
                        :title="isPmGmFeedbackPending(item) ? 'KPI đang chờ GM xử lý feedback.' : undefined"
                        class="flex h-8 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 text-[10px] font-bold text-violet-800 shadow-sm hover:bg-violet-100"
                        :class="isPmGmFeedbackPending(item) ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-70 hover:bg-slate-100' : ''"
                      >
                        <i class="fas fa-sliders-h text-xs" />
                        Chỉnh sửa phân bổ
                      </button>
                      <button
                        v-if="
                          Number(item.statusCode) === KPI_STATUS.PENDING_ACCEPTANCE ||
                          isPmGmFeedbackPending(item)
                        "
                        type="button"
                        @click.stop="openFeedbackDrawer(item)"
                        class="flex h-8 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 text-[10px] font-bold text-violet-800 shadow-sm hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <i class="fas fa-message text-xs" />
                        {{ isPmGmFeedbackPending(item) ? 'Chờ GM xử lý feedback' : 'Feedback GM' }}
                      </button>
                      <!-- Individual (Portfolio) / Promotion (tab Promotion): chỉ Edit sau khi Accept KPI -->
                      <button
                        v-else-if="!item.isTree"
                        type="button"
                        :disabled="isPmDirectAssignmentEditLockedBeforeAccept(item)"
                        :title="pmDirectAssignmentEditLockReason(item)"
                        @click.stop="openEvidenceDrawer(item)"
                        class="flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[10px] font-bold shadow-sm"
                        :class="
                          isPmDirectAssignmentEditLockedBeforeAccept(item)
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-70'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-600'
                        "
                      >
                        <i class="fas fa-pen text-xs" />
                        Edit
                      </button>
                      <button
                        v-if="item.isSelfCreated && [402, 403, 404, 406].includes(Number(item.statusCode))"
                        type="button"
                        :disabled="deletingSelfCreatedKpiIds.has(item.id)"
                        @click.stop="promptDeleteSelfCreatedPmKpi(item)"
                        class="flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-[10px] font-bold text-rose-700 shadow-sm hover:bg-rose-100"
                        :class="deletingSelfCreatedKpiIds.has(item.id) ? 'cursor-not-allowed opacity-70' : ''"
                      >
                        <i :class="deletingSelfCreatedKpiIds.has(item.id) ? 'fas fa-spinner fa-spin text-xs' : 'fas fa-trash text-xs'" />
                        Xóa
                      </button>
                    </div>
                </td>
              </tr>
              <template v-if="item.isTree && item.expanded && visibleChildrenForItem(item).length">
                <tr
                  v-for="child in visibleChildrenForItem(item)"
                  :key="`${item.id}-${child.id}`"
                  class="pm-kpi-child-row bg-slate-50/70 hover:bg-slate-100/90 border-t border-slate-100/90 transition-colors"
                  @click.stop
                >
                  <td class="py-3 px-5 align-top" />
                  <td class="py-3 px-5 align-top relative min-w-0">
                    <div class="absolute left-[30px] top-0 bottom-0 w-px bg-purple-200" />
                    <div class="absolute left-[30px] top-1/2 w-4 h-px bg-purple-200" />
                    <div class="flex items-center gap-2 pl-[46px]">
                      <div class="w-6 h-6 shrink-0 rounded-full border border-slate-200 bg-white flex items-center justify-center text-[9px] font-bold text-slate-600">{{ child.avatar }}</div>
                      <div class="min-w-0">
                        <p class="text-xs font-bold text-slate-800 truncate">{{ child.name }}</p>
                        <p class="text-[9px] text-slate-500 uppercase truncate">{{ child.role }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="py-3 px-5 align-top">
                    <span
                      :class="pmTargetPillClass(null)"
                      :style="{ textAlign: formatTargetCell(child.target) === '-' ? 'center' : 'left' }"
                    >
                      {{ formatTargetCellWithUnit(child.target, item.unitCode) }}
                    </span>
                  </td>
                  <td class="py-3 px-5 align-top">
                    <p class="text-xs font-semibold text-emerald-600">
                      {{
                        formatPmActualCellWithUnit(
                          formatPmPortfolioActualCell(
                            child.actualResult,
                            item.calculationTypeCode,
                            pmPortfolioActualDisplayMode(item.calculationRuleCode),
                          ),
                          item.unitCode,
                        ) || 'Chưa cập nhật'
                      }}
                    </p>
                  </td>
                  <td class="py-3 px-5 text-center align-top">
                    <span class="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 font-bold text-xs rounded-md">
                      {{ item.weight }}
                    </span>
                  </td>
                  <td class="py-3 px-5 text-center align-top bg-blue-50/10 border-x border-slate-100">
                    <span class="text-xs font-bold text-slate-600">{{ child.selfScore ?? '-' }}</span>
                  </td>
                  <td class="py-3 px-5 text-center align-top">
                    <span class="text-xs font-bold text-purple-700">{{ child.pmScore ?? '-' }}</span>
                  </td>
                  <td class="py-3 px-5 text-right align-top">
                    <div class="inline-flex items-center gap-1.5">
                      <button
                        v-if="isMemberFeedbackPendingForPm(child)"
                        type="button"
                        @click.stop="openMemberFeedbackReviewDrawer(child, item)"
                        class="inline-flex h-7 items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-2.5 text-[10px] font-bold text-violet-700 shadow-sm hover:bg-violet-100"
                      >
                        <i class="far fa-comment-dots text-[10px]" /> Xử lý feedback
                      </button>
                      <button
                        v-if="!isChildOwnedByCurrentPm(child)"
                        type="button"
                        :disabled="isRemovingChildAssignment(child.id)"
                        @click.stop="removeAssignedMemberFromTeamKpi(item, child)"
                        class="inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[10px] font-bold shadow-sm"
                        :class="
                          isRemovingChildAssignment(child.id)
                            ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-70'
                            : 'border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100'
                        "
                      >
                        <i
                          class="text-[10px]"
                          :class="isRemovingChildAssignment(child.id) ? 'fas fa-spinner fa-spin' : 'fas fa-trash'"
                        />
                        Xóa
                      </button>
                      <button
                        v-if="isChildOwnedByCurrentPm(child)"
                        type="button"
                        :disabled="isPmTeamSelfRowActualEditLockedBeforeAccept(item)"
                        :title="pmTeamSelfRowLockReason(item)"
                        @click.stop="openChildEvidenceDrawer(child, item)"
                        class="inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[10px] font-bold shadow-sm"
                        :class="
                          isPmTeamSelfRowActualEditLockedBeforeAccept(item)
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-70'
                            : 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        "
                      >
                        <i class="fas fa-pen text-[10px]" /> Edit Actual
                      </button>
                      <button
                        v-else
                        type="button"
                        @click.stop="$emit('open-member-detail', { child, parent: item })"
                        class="inline-flex h-7 items-center gap-1.5 rounded-md border border-blue-100 bg-blue-50 px-2.5 text-[10px] font-bold text-blue-600 shadow-sm"
                      >
                        <i class="far fa-eye text-[10px]" /> Detail
                      </button>
                    </div>
                  </td>
                </tr>
              </template>
            </template>
          </template>
        </tbody>
        
        <tfoot class="bg-slate-100/80 border-t-2 border-slate-200 font-bold">
          <tr>
            <td colspan="4" class="py-4 px-5 text-right text-slate-700 uppercase text-xs tracking-wider">Tổng cộng (Total weight):</td>
            <td class="py-4 px-5 text-center"><span class="text-sm text-slate-800">{{ totalPortfolioWeightDisplay }}</span><span class="text-[10px] text-slate-500 font-medium ml-1">pts</span></td>
            <td class="py-4 px-5 text-center text-slate-500 text-sm border-x border-slate-100">{{ totalWeightedSelfScoreDisplay }}</td>
            <td class="py-4 px-5 text-center text-slate-500 text-sm">{{ totalWeightedPmScoreDisplay }}</td>
            <td class="py-4 px-5"></td>
          </tr>
          <tr class="bg-violet-50/50 border-t border-slate-200">
            <td colspan="4" class="py-4 px-5 text-right text-violet-800 uppercase text-xs tracking-wider">Điểm trung bình (Average score):</td>
            <td class="py-4 px-5"></td>
            <td class="py-4 px-5 text-center bg-violet-100/80 border-x border-violet-200">
              <span
                class="text-lg font-extrabold"
                :class="averageSelfScoreDisplay === '-' ? 'text-slate-500 text-sm' : 'text-violet-700'"
              >{{ averageSelfScoreDisplay }}</span>
            </td>
            <td class="py-4 px-5 text-center text-sm font-bold">
              <span :class="averagePmScoreDisplay === '-' ? 'text-slate-500' : 'text-violet-700 text-lg font-extrabold'">{{ averagePmScoreDisplay }}</span>
            </td>
            <td class="py-4 px-5"></td>
          </tr>
        </tfoot>

      </table>
    </div>

    <EvaluationCommentBlock
      v-model:employeeComment="pmComments.selfComment"
      v-model:managerComment="pmComments.supervisorComment"
      :employee-comment-section-id="employeeCommentAnchorId"
      employeeTitle="My Comment"
      managerTitle="Supervisor Comment"
      :employee-readonly="false"
      :manager-readonly="true"
      :employee-highlight-error="sendReviewErrorComment"
    />
    <div class="mt-6 mb-8 flex justify-center">
      <button type="button"
        v-if="buttonState.show"
        :disabled="buttonState.disabled"
        :title="buttonState.disabled && buttonState.reason ? buttonState.reason : undefined"
        @click="handleSubmitClick"
        class="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-6 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50">
        <i class="fas fa-paper-plane text-sm" /> {{ buttonState.text }}
      </button>
    </div>
    <EvaluationEvidenceDrawer
      :open="evidencePanelOpen"
      :item="selectedKpiItem"
      self-score-footer-readonly
      @close="evidencePanelOpen = false"
      @save="saveEvidenceData"
    />

    <Teleport to="body">
      <Transition name="pm-feedback-drawer">
        <div
          v-if="feedbackDrawerOpen && feedbackDrawerAssignment"
          class="fixed inset-0 z-[120] flex justify-end"
          role="dialog"
          aria-modal="true"
        >
          <div
            class="pm-feedback-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
            @click="closeFeedbackDrawer"
          />
          <aside class="pm-feedback-panel relative flex h-full w-full max-w-full flex-col border-l border-slate-200 bg-white shadow-2xl md:w-[460px]">
            <header class="border-b border-slate-200 bg-white px-5 py-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="mb-2 flex items-center gap-2">
                    <GmStrategicKpiTypeTag :type="feedbackDrawerAssignment.kpiType" size="sm" />
                  </div>
                  <h4 class="truncate text-2xl font-bold leading-tight text-slate-900">{{ feedbackDrawerAssignment.name }}</h4>
                  <div class="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-semibold text-slate-700">
                    <p>
                      Chỉ tiêu:
                      <span class="font-bold text-slate-900">
                        {{ formatTargetCellWithUnit(feedbackDrawerAssignment.target, feedbackDrawerAssignment.unitCode) }}
                      </span>
                    </p>
                    <p>
                      Trọng số:
                      <span class="font-bold text-slate-900">{{ feedbackDrawerAssignment.weight ?? '-' }}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  @click="closeFeedbackDrawer"
                >
                  <i class="fas fa-times text-xs" />
                </button>
              </div>
            </header>

            <div class="flex-1 overflow-y-auto bg-slate-50/40">
              <section class="border-b border-slate-200 bg-white px-5 py-4">
                <h4 class="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                  <i class="fas fa-align-left text-xs text-violet-600" />
                  Đề xuất điều chỉnh
                </h4>
                <div class="space-y-3">
                  <div>
                    <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Nội dung chi tiết
                    </label>
                    <div
                      v-if="isPmFeedbackDrawerReadonly()"
                      class="min-h-[88px] whitespace-pre-wrap rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700"
                    >
                      {{ feedbackDraftText || 'Không có nội dung feedback.' }}
                    </div>
                    <textarea
                      v-else
                      v-model="feedbackDraftText"
                      rows="4"
                      class="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                      placeholder="Trình bày lý do hoặc giải pháp bạn đề xuất..."
                    />
                  </div>
                  <div class="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                      @click="closeFeedbackDrawer"
                    >
                      {{ isPmFeedbackDrawerReadonly() ? 'Đóng' : 'Hủy' }}
                    </button>
                    <button
                      v-if="!isPmFeedbackDrawerReadonly()"
                      type="button"
                      :disabled="
                        isSendingPmFeedback(feedbackDrawerAssignment.id) ||
                        !feedbackDraftText.trim()
                      "
                      class="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                      @click="sendFeedbackToGmForAssignment(feedbackDrawerAssignment)"
                    >
                      <i
                        :class="
                          isSendingPmFeedback(feedbackDrawerAssignment.id)
                            ? 'fas fa-spinner fa-spin text-xs'
                            : 'fas fa-paper-plane text-xs'
                        "
                      />
                      Gửi quản lý
                    </button>
                  </div>
                </div>
              </section>

            </div>
          </aside>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="pm-feedback-drawer">
        <div
          v-if="memberFeedbackReviewDrawerOpen && memberFeedbackReviewTarget"
          class="fixed inset-0 z-[125] flex justify-end"
          role="dialog"
          aria-modal="true"
        >
          <div
            class="pm-feedback-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
            @click="closeMemberFeedbackReviewDrawer"
          />
          <aside class="pm-feedback-panel relative flex h-full w-full max-w-full flex-col border-l border-slate-200 bg-white shadow-2xl md:w-[460px]">
            <header class="border-b border-slate-200 bg-white px-5 py-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <h4 class="truncate text-2xl font-bold leading-tight text-slate-900">
                      {{ memberFeedbackReviewTarget.parentName }}
                    </h4>
                    <GmStrategicKpiTypeTag :type="memberFeedbackReviewTarget.parentKpiType" size="sm" />
                  </div>
                  <div class="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-semibold text-slate-700">
                    <p>
                      Chỉ tiêu:
                      <span class="font-bold text-slate-900">
                        {{ formatTargetCellWithUnit(memberFeedbackReviewTarget.parentTarget, memberFeedbackReviewTarget.parentUnitCode) }}
                      </span>
                    </p>
                    <p>
                      Trọng số:
                      <span class="font-bold text-slate-900">{{ memberFeedbackReviewTarget.parentWeight ?? '-' }}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  @click="closeMemberFeedbackReviewDrawer"
                >
                  <i class="fas fa-times text-xs" />
                </button>
              </div>
            </header>

            <div class="flex-1 overflow-y-auto bg-slate-50/40">
              <section class="border-b border-slate-200 bg-white px-5 py-4">
                <h4 class="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                  <i class="fas fa-align-left text-xs text-violet-600" />
                  Feedback từ {{ memberFeedbackReviewTarget.memberName }}
                </h4>
                <div>
                  <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Nội dung feedback
                  </label>
                  <div
                    class="min-h-[88px] whitespace-pre-wrap rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
                    {{ memberFeedbackReviewTarget.note }}
                  </div>
                </div>
                <p class="mb-2 text-[11px] font-medium text-slate-600">
                  KPI Team: «Chấp nhận và phân bổ» mở drawer phân bổ; sau khi bấm «Xác nhận phân bổ và đóng feedback» thì hệ thống mới ghi nhận (một giao dịch duyệt + lưu phân bổ).
                </p>
                <div class="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    :disabled="isDecidingMemberFeedback(memberFeedbackReviewTarget.assignmentId)"
                    class="rounded-md border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    @click="decideMemberFeedbackFromDrawer(false)"
                  >
                    Từ chối feedback
                  </button>
                  <button
                    type="button"
                    :disabled="isDecidingMemberFeedback(memberFeedbackReviewTarget.assignmentId)"
                    class="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                    @click="acceptMemberFeedbackFromDrawer()"
                  >
                    <i class="fas fa-sliders-h text-xs" />
                    Chấp nhận và phân bổ
                  </button>
                </div>
              </section>
            </div>
          </aside>
        </div>
      </Transition>
    </Teleport>
    <Teleport to="body">
      <Transition name="gm-diag-filter-pop">
        <div v-if="deleteConfirmModalOpen" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" @click="closeDeleteConfirmModal"></div>
          <div class="relative w-full max-w-md transform overflow-hidden rounded-xl bg-white p-6 text-left align-middle shadow-xl transition-all">
            <h3 class="text-lg font-bold leading-6 text-slate-900 flex items-center gap-2">
              <i class="fas fa-exclamation-triangle text-rose-500"></i> Xác nhận xóa KPI
            </h3>
            <div class="mt-3">
              <p class="text-sm text-slate-600">
                Bạn có chắc chắn muốn xóa KPI <span class="font-bold text-slate-800">"{{ deleteConfirmItem?.name }}"</span> không?
              </p>
              <p class="text-sm text-rose-600 mt-2 font-medium">Lưu ý: Hành động này không thể hoàn tác.</p>
            </div>
            <div class="mt-6 flex justify-end gap-3">
              <button
                type="button"
                class="inline-flex justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none"
                @click="closeDeleteConfirmModal"
              >
                Hủy
              </button>
              <button
                type="button"
                class="inline-flex justify-center rounded-lg border border-transparent bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 focus:outline-none"
                @click="executeDeleteSelfCreatedPmKpi"
              >
                Xóa KPI
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<style scoped>
.gm-diag-filter-pop-enter-active, .gm-diag-filter-pop-leave-active { transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
.gm-diag-filter-pop-enter-from, .gm-diag-filter-pop-leave-to { opacity: 0; transform: scale(0.95); }
.gm-diag-filter-pop-enter-to, .gm-diag-filter-pop-leave-from { opacity: 1; transform: scale(1); }

/* Cùng một bảng + colgroup → dòng breakdown thẳng cột với header/parent */
.pm-kpi-portfolio-table col.pm-kpi-col-stt { width: 3rem; }
.pm-kpi-portfolio-table col.pm-kpi-col-objective { width: 26%; }
.pm-kpi-portfolio-table col.pm-kpi-col-target { width: 14%; }
.pm-kpi-portfolio-table col.pm-kpi-col-actual { width: 14%; }
.pm-kpi-portfolio-table col.pm-kpi-col-weight { width: 7%; }
.pm-kpi-portfolio-table col.pm-kpi-col-self { width: 10%; }
.pm-kpi-portfolio-table col.pm-kpi-col-sup { width: 10%; }
.pm-kpi-portfolio-table col.pm-kpi-col-action { width: 16%; min-width: 8.5rem; }

.pm-kpi-child-row {
  animation: pm-kpi-child-in 0.22s ease;
}
@keyframes pm-kpi-child-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .pm-kpi-child-row {
    animation: none;
  }
}

.pm-feedback-drawer-enter-active,
.pm-feedback-drawer-leave-active {
  transition-duration: 0.32s;
}
.pm-feedback-drawer-enter-active .pm-feedback-backdrop,
.pm-feedback-drawer-leave-active .pm-feedback-backdrop {
  transition: opacity 0.32s ease;
}
.pm-feedback-drawer-enter-active .pm-feedback-panel,
.pm-feedback-drawer-leave-active .pm-feedback-panel {
  transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);
}
.pm-feedback-drawer-enter-from .pm-feedback-backdrop,
.pm-feedback-drawer-leave-to .pm-feedback-backdrop {
  opacity: 0;
}
.pm-feedback-drawer-enter-to .pm-feedback-backdrop,
.pm-feedback-drawer-leave-from .pm-feedback-backdrop {
  opacity: 1;
}
.pm-feedback-drawer-enter-from .pm-feedback-panel,
.pm-feedback-drawer-leave-to .pm-feedback-panel {
  transform: translate3d(100%, 0, 0);
}
.pm-feedback-drawer-enter-to .pm-feedback-panel,
.pm-feedback-drawer-leave-from .pm-feedback-panel {
  transform: translate3d(0, 0, 0);
}
</style>