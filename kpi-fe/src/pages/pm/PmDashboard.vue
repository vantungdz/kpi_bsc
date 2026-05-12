<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '@/stores/auth.store'
import { pmKpiService } from '@/services/modules/kpi-pm.service'
import type { PmMemberKpiApprovalItem } from '@/services/modules/kpi-pm.service'
import type {
  GmMidYearIssuesData,
  GmPmKpiRolloutPayload,
  GmModalKpiItemMock,
  GmStrategicKpiKind,
} from '@/types/gm-workspace'
import type { GmProcessTimelineApiResponse } from '@/services/modules/kpi-gm.service'
import {
  formatPmPortfolioActualCell,
  parsePmPortfolioEvidenceString,
} from '@/utils/memberKpiHelpers'
import { formatKpiTargetWithUnit, kpiUnitCodeToFormUnit } from '@/utils/kpiUnitCodes'
import { countPmEvaluationSubjectsInHierarchy } from '@/utils/pmEvaluationSubject'
import PmPersonalKpiTab from '@/components/pm/tabs/PmPersonalKpiTab.vue'
import PmTeamMembersTab from '@/components/pm/tabs/PmTeamMembersTab.vue'
import PmRequestsTab from '@/components/pm/tabs/PmRequestsTab.vue'
import PmAssignKpiDrawer from '@/components/pm/drawers/PmAssignKpiDrawer.vue'
import PmMemberDetailDrawer from '@/components/pm/drawers/PmMemberDetailDrawer.vue'
import PmRequestDetailDrawer from '@/components/pm/drawers/PmRequestDetailDrawer.vue'
import GmProcessTimeline from '@/components/gm/GmProcessTimeline.vue'
import GmMemberKpiDrawer from '@/components/gm/GmMemberKpiDrawer.vue'

const toast = useToast()
const activeTab = ref('personal')
const pmFeedbackPendingByScope = ref<{ portfolio: number; promotion: number }>({
  portfolio: 0,
  promotion: 0,
})

function onPmFeedbackPendingCount(payload: { scope: 'portfolio' | 'promotion'; count: number }) {
  const scope = payload?.scope === 'promotion' ? 'promotion' : 'portfolio'
  const count = Number.isFinite(Number(payload?.count)) ? Math.max(0, Number(payload.count)) : 0
  pmFeedbackPendingByScope.value = {
    ...pmFeedbackPendingByScope.value,
    [scope]: count,
  }
}

type PmSupervisorDraft = { main: string; promo: string }

const memberComments = ref<Record<string, PmSupervisorDraft>>({})
const memberKpisCache = ref<Record<string, any[]>>({})

function normalizePmSupervisorDraft(raw: unknown): PmSupervisorDraft {
  if (raw == null) return { main: '', promo: '' }
  if (typeof raw === 'string') return { main: raw, promo: '' }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    return {
      main: String(o.main ?? ''),
      promo: String(o.promo ?? ''),
    }
  }
  return { main: '', promo: '' }
}

// Control refresh of PM Portfolio tab after actions in drawers
const personalKpiKey = ref(0)
const approvalYear = new Date().getFullYear()
/** Tăng để Team Review refetch hierarchy sau khi gửi đánh giá (không reload trang). */
const teamReviewReloadNonce = ref(0)

/** Điều kiện gửi đánh giá KPI Member lên GM: mọi member trong cây đã nộp individual/team (≥501) cho PM. */
const pmPortfolioEvalGate = ref<{
  loaded: boolean
  open: boolean
  pending: { userId: string; fullName: string }[]
}>({ loaded: false, open: false, pending: [] })

async function loadPmPortfolioEvaluationGate() {
  try {
    const data = await pmKpiService.getPmPortfolioEvaluationGate(approvalYear)
    pmPortfolioEvalGate.value = {
      loaded: true,
      open: Boolean(data?.allPortfolioSubmittedToPm),
      pending: Array.isArray(data?.pendingMembers) ? data.pendingMembers : [],
    }
  } catch {
    pmPortfolioEvalGate.value = { loaded: true, open: false, pending: [] }
  }
}
/** Số member đang chờ PM đánh giá (501 / 601) — badge tab Team Review + đồng bộ khi mở tab. */
const teamPmEvaluationPendingCount = ref(0)

async function loadTeamReviewPendingCount() {
  try {
    const response = await pmKpiService.getTeamHierarchy(String(approvalYear))
    const roots = Array.isArray(response) ? response : []
    teamPmEvaluationPendingCount.value = countPmEvaluationSubjectsInHierarchy(roots)
  } catch {
    teamPmEvaluationPendingCount.value = 0
  }
}

function onTeamPendingPmEvaluationCount(count: number) {
  const n = Number(count)
  teamPmEvaluationPendingCount.value = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}

const approvalLoading = ref(false)
const approvalSubmitting = ref(false)

/** Fallback khi API timeline chưa load hoặc lỗi — khớp prop bắt buộc của GmProcessTimeline. */
const EMPTY_PM_PROCESS_TIMELINE_MID: GmMidYearIssuesData = {
  hasOpenIssues: false,
  pendingKpisLine: '',
  popoverTitle: '',
  issueGroups: [],
}

const processTimelineData = ref<GmProcessTimelineApiResponse | null>(null)

async function loadProcessTimeline() {
  try {
    processTimelineData.value = await pmKpiService.getProcessTimeline(approvalYear)
  } catch (e) {
    console.error(e)
    processTimelineData.value = null
  }
}

type PmRequestUiRow = {
  id: string
  userId: string
  user: string
  avatar: string
  type: string
  kpiName: string
  oldValue: string | null
  newValue: string
  reason: string
  status: string
  date: string
  memberTarget: string
  bscAspect: string
  weightLabel: string
  unitLabel: string
  calculationMethodLabel: string
  scoringRuleText: string
}

/** Dữ liệu gốc từ API — nhóm theo member ở tab Request Approval. */
const approvalRawItems = ref<PmMemberKpiApprovalItem[]>([])

type PmApprovalMemberSummary = {
  userId: string
  userFullName: string
  avatar: string
  pendingCount: number
  latestDateLabel: string
  /** roles.code (uppercase), đã tách và bỏ trùng. */
  roleCodes: string[]
}

/** BE trả user_role_codes nối bằng |||. */
function parseUserRoleCodes(raw: string | null | undefined): string[] {
  if (raw == null || !String(raw).trim()) return []
  const parts = String(raw)
    .split('|||')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    if (seen.has(p)) continue
    seen.add(p)
    out.push(p)
  }
  return out
}

function roleCodesFromApprovalItems(items: PmMemberKpiApprovalItem[]): string[] {
  for (const it of items) {
    const parsed = parseUserRoleCodes(it.userRoleCodes)
    if (parsed.length) return parsed
  }
  return []
}

function maxRequestedAtIso(items: PmMemberKpiApprovalItem[]): string | null {
  let best: string | null = null
  let bestMs = -Infinity
  for (const i of items) {
    const t = i.requestedAt
    if (t == null || String(t).trim() === '') continue
    const s = String(t)
    const ms = Date.parse(s)
    if (!Number.isFinite(ms)) continue
    if (ms >= bestMs) {
      bestMs = ms
      best = s
    }
  }
  return best
}

const approvalMemberSummaries = computed<PmApprovalMemberSummary[]>(() => {
  const map = new Map<string, { userId: string; userFullName: string; items: PmMemberKpiApprovalItem[] }>()
  for (const r of approvalRawItems.value) {
    const uid = String(r.userId ?? '').trim()
    if (!uid) continue
    if (!map.has(uid)) {
      map.set(uid, { userId: uid, userFullName: r.userFullName ?? '—', items: [] })
    }
    map.get(uid)!.items.push(r)
  }
  const rows: PmApprovalMemberSummary[] = []
  for (const m of map.values()) {
    rows.push({
      userId: m.userId,
      userFullName: m.userFullName,
      avatar: initialsFromName(m.userFullName),
      pendingCount: m.items.length,
      latestDateLabel: formatRequestedAt(maxRequestedAtIso(m.items)),
      roleCodes: roleCodesFromApprovalItems(m.items),
    })
  }
  rows.sort((a, b) => b.pendingCount - a.pendingCount || a.userFullName.localeCompare(b.userFullName, 'vi'))
  return rows
})

/** Số member có ít nhất một KPI chờ duyệt (402) — badge tab Request Approval. */
const pendingRequestsCount = computed(() => approvalMemberSummaries.value.length)

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatRequestedAt(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('vi-VN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

function calcMethodLabel(ruleCode: number | null | undefined, typeCode: number | null | undefined): string {
  const r = Number(ruleCode)
  const t = Number(typeCode)
  if (r === 801) return 'Tổng Plan/Actual'
  if (r === 802 && t === 701) return 'Trung bình Actual / Plan'
  if (r === 802 && t === 702) return 'Trung bình Plan / Actual'
  if (r === 802) return 'Trung bình Plan/Actual (%)'
  if (r === 803) return 'Nhập tay theo nhận xét'
  return '—'
}

function scoringRulesText(targetDescription: string | null | undefined): string {
  const raw = String(targetDescription ?? '').trim()
  if (!raw) return '—'
  try {
    const parsed = JSON.parse(raw) as { rawInput?: string }
    const txt = String(parsed?.rawInput ?? '').trim()
    if (txt) return txt
  } catch {
    // targetDescription có thể không phải JSON
  }
  return raw
}

function mapApprovalToUi(r: PmMemberKpiApprovalItem): PmRequestUiRow {
  const w = r.weight != null ? Number(r.weight) : null
  const weightLabel = w != null && Number.isFinite(w) ? `${w}% trọng số` : '—'
  const newValueParts = [weightLabel]
  if (r.categoryName) newValueParts.push(r.categoryName)
  const just = (r.justification && r.justification.trim()) || ''
  const target = (r.targetDescription && r.targetDescription.trim()) || ''
  const name = r.userFullName ?? '—'
  const unitLabel = r.unitCode != null ? kpiUnitCodeToFormUnit(r.unitCode) : '—'
  const memberTarget = formatKpiTargetWithUnit(
    r.targetValue != null ? String(r.targetValue) : '-',
    r.unitCode ?? undefined,
  )
  return {
    id: r.assignmentId,
    userId: String(r.userId ?? ''),
    user: name,
    avatar: initialsFromName(name),
    type: 'CREATE_KPI',
    kpiName: r.kpiName ?? '—',
    oldValue: null,
    newValue: newValueParts.join(' · '),
    reason: just || target || '—',
    status: 'PENDING',
    date: formatRequestedAt(r.requestedAt),
    memberTarget,
    bscAspect: r.categoryName?.trim() || '—',
    weightLabel,
    unitLabel,
    calculationMethodLabel: calcMethodLabel(r.calculationRuleCode, r.calculationTypeCode),
    scoringRuleText: scoringRulesText(r.targetDescription),
  }
}

async function loadApprovalRequests() {
  approvalLoading.value = true
  try {
    const rows = await pmKpiService.listMemberKpiApprovals(approvalYear)
    approvalRawItems.value = rows

    const openMemberApproval =
      rightPanelVisible.value &&
      rightPanelMode.value === 'request_detail' &&
      activeItem.value &&
      activeItem.value._approvalMember === true &&
      activeItem.value.userId != null

    if (openMemberApproval) {
      const uid = String(activeItem.value.userId)
      const kpis = rows.filter((r) => String(r.userId) === uid).map(mapApprovalToUi)
      if (kpis.length === 0) {
        closePanel()
      } else {
        const snap = activeItem.value
        activeItem.value = {
          ...snap,
          kpis,
          userFullName: rows.find((r) => String(r.userId) === uid)?.userFullName ?? snap.userFullName,
          avatar: initialsFromName(
            rows.find((r) => String(r.userId) === uid)?.userFullName ?? snap.userFullName ?? '',
          ),
        }
      }
    }
  } catch (e) {
    console.error(e)
    toast.error('Không tải được danh sách đề xuất KPI')
    approvalRawItems.value = []
  } finally {
    approvalLoading.value = false
  }
}

function apiErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const ax = err as { response?: { data?: { message?: string | null } } }
    const m = ax.response?.data?.message
    if (m != null && String(m).trim() !== '') return String(m)
  }
  if (err instanceof Error) return err.message
  return 'Thao tác thất bại'
}

async function submitApprovalDecision(req: PmRequestUiRow, approve: boolean, rejectReason?: string) {
  if (approvalSubmitting.value) return
  approvalSubmitting.value = true
  try {
    await pmKpiService.decideMemberKpiApproval({
      year: approvalYear,
      assignmentId: req.id,
      approve,
      rejectReason: approve ? undefined : (rejectReason ?? ''),
    })
    toast.success(
      approve ? 'Đã duyệt — KPI chuyển sang chờ GM.' : 'Đã từ chối đề xuất KPI.',
    )
    await loadApprovalRequests()
    void loadProcessTimeline()
  } catch (err: unknown) {
    toast.error(apiErrorMessage(err))
  } finally {
    approvalSubmitting.value = false
  }
}

async function submitApprovalDecisionBatch(
  rows: PmRequestUiRow[],
  approve: boolean,
  rejectReason?: string,
) {
  const targets = rows.filter((r) => r.status === 'PENDING')
  if (!targets.length || approvalSubmitting.value) return
  approvalSubmitting.value = true
  let ok = 0
  try {
    for (const req of targets) {
      try {
        await pmKpiService.decideMemberKpiApproval({
          year: approvalYear,
          assignmentId: req.id,
          approve,
          rejectReason: approve ? undefined : (rejectReason ?? ''),
        })
        ok += 1
      } catch (e) {
        console.error(e)
      }
    }
    if (ok > 0) {
      toast.success(
        approve
          ? `Đã duyệt ${ok} KPI — chuyển sang chờ GM.`
          : `Đã từ chối ${ok} KPI.`,
      )
    }
    if (ok < targets.length) {
      toast.warning(`Có ${targets.length - ok} KPI chưa cập nhật được. Vui lòng thử lại.`)
    }
    await loadApprovalRequests()
    void loadProcessTimeline()
  } catch (err: unknown) {
    toast.error(apiErrorMessage(err))
  } finally {
    approvalSubmitting.value = false
  }
}

watch(activeTab, (t) => {
  if (t === 'requests') loadApprovalRequests()
  if (t === 'team') void loadPmPortfolioEvaluationGate()
})

watch(teamReviewReloadNonce, () => {
  void loadTeamReviewPendingCount()
  void loadPmPortfolioEvaluationGate()
})

const initLocalStorage = () => {
  const savedComments = localStorage.getItem('pm_eval_comments')
  if (savedComments) {
    try {
      const parsed = JSON.parse(savedComments) as Record<string, unknown>
      const next: Record<string, PmSupervisorDraft> = {}
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          next[k] = normalizePmSupervisorDraft(v)
        }
      }
      memberComments.value = next
    } catch {
      /* ignore */
    }
  }
  const savedKpis = localStorage.getItem('pm_eval_kpis')
  if (savedKpis) {
    try { memberKpisCache.value = JSON.parse(savedKpis) } catch(e) {}
  }
}

onMounted(() => {
  initLocalStorage()
  void loadProcessTimeline()
  void loadApprovalRequests()
  void loadTeamReviewPendingCount()
  void loadPmPortfolioEvaluationGate()
  window.addEventListener('pm-kpi-created', handleRefresh)
})

onUnmounted(() => {
  window.removeEventListener('pm-kpi-created', handleRefresh)
})

function onDrawerApproveRequest(req: PmRequestUiRow) {
  if (req) submitApprovalDecision(req, true)
}

function onDrawerRejectRequest(payload: any) {
  if (payload?.req) submitApprovalDecision(payload.req as PmRequestUiRow, false, String(payload.reason ?? ''))
}

function onDrawerApproveAll(rows: PmRequestUiRow[]) {
  void submitApprovalDecisionBatch(rows, true)
}

function onDrawerRejectAll(payload: { rows: PmRequestUiRow[]; reason: string }) {
  void submitApprovalDecisionBatch(payload.rows, false, payload.reason)
}

/** KPI của member thay đổi (vd xóa KPI) — bỏ draft localStorage tránh nhầm Supervisor Comment. */
function discardMemberEvalDraft(memberId: string) {
  if (!memberId) return
  const nextComments = { ...memberComments.value }
  delete nextComments[memberId]
  memberComments.value = nextComments
  const nextKpis = { ...memberKpisCache.value }
  delete nextKpis[memberId]
  memberKpisCache.value = nextKpis
  localStorage.setItem('pm_eval_comments', JSON.stringify(memberComments.value))
  localStorage.setItem('pm_eval_kpis', JSON.stringify(memberKpisCache.value))
}

const rightPanelVisible = ref(false)
const rightPanelMode = ref<'assign' | 'member_detail' | 'request_detail' | 'none'>('none')
const activeItem = ref<any>(null)
/** Truyền vào PmAssignKpiDrawer khi mở từ «Chấp nhận và phân bổ» (feedback member). */
const pendingAssignDrawerMemberFeedbackAssignmentId = ref<string | undefined>(undefined)

function openAssignDrawer(kpi: any) {
  pendingAssignDrawerMemberFeedbackAssignmentId.value = undefined
  activeItem.value = kpi
  rightPanelMode.value = 'assign'
  rightPanelVisible.value = true
}

function openAssignDrawerAfterMemberFeedback(payload: { parentKpi: any; feedbackAssignmentId: string }) {
  const id = String(payload?.feedbackAssignmentId ?? '').trim()
  pendingAssignDrawerMemberFeedbackAssignmentId.value = id || undefined
  activeItem.value = payload.parentKpi
  rightPanelMode.value = 'assign'
  rightPanelVisible.value = true
}
const openMemberDrawer = (member: any) => { activeItem.value = member; rightPanelMode.value = 'member_detail'; rightPanelVisible.value = true }

function openMemberApprovalDrawer(summary: PmApprovalMemberSummary) {
  const uid = String(summary.userId ?? '').trim()
  if (!uid) return
  const kpis = approvalRawItems.value.filter((r) => String(r.userId) === uid).map(mapApprovalToUi)
  activeItem.value = {
    _approvalMember: true,
    userId: uid,
    userFullName: summary.userFullName,
    avatar: summary.avatar,
    kpis,
  }
  rightPanelMode.value = 'request_detail'
  rightPanelVisible.value = true
}
const closePanel = () => { rightPanelVisible.value = false; setTimeout(() => { activeItem.value = null; rightPanelMode.value = 'none' }, 300); personalKpiKey.value += 1 }

function onPmAssignDrawerClose() {
  pendingAssignDrawerMemberFeedbackAssignmentId.value = undefined
  closePanel()
}

const handleMemberEvalSubmitted = (payload: {
  kpis: any[]
  comments: { main: string; promo: string }
  memberId?: string
}) => {
  const mid = String(payload.memberId ?? activeItem.value?.id ?? '')
  if (!mid) return
  const prev = memberComments.value[mid] ?? { main: '', promo: '' }
  memberComments.value = {
    ...memberComments.value,
    [mid]: {
      main: String(payload.comments?.main ?? prev.main),
      promo: String(payload.comments?.promo ?? prev.promo),
    },
  }
  memberKpisCache.value = { ...memberKpisCache.value, [mid]: payload.kpis }

  try {
    localStorage.setItem('pm_eval_comments', JSON.stringify(memberComments.value))
    localStorage.setItem('pm_eval_kpis', JSON.stringify(memberKpisCache.value))
  } catch {
    /* ignore */
  }

  teamReviewReloadNonce.value += 1
  personalKpiKey.value += 1
  void loadProcessTimeline()
}

const authStore = useAuthStore()

const isGmDrawerOpen = ref(false)
const gmDrawerMember = ref<any>(null)
const gmDrawerItems = ref<any[]>([])
const gmDrawerPmRollout = ref<GmPmKpiRolloutPayload | null>(null)

function closeGmMemberDrawer() {
  isGmDrawerOpen.value = false
  gmDrawerPmRollout.value = null
  gmDrawerMember.value = null
  gmDrawerItems.value = []
}

const openKpiChildDetail = (payload: { child: any; parent: any }) => {
  const { child, parent } = payload
  const pmName = authStore.user?.fullName?.trim() || authStore.user?.name || '—'

  const targetStr =
    child.target != null && String(child.target).trim() !== '' ? String(child.target).trim() : '—'
  const actualFormatted =
    formatPmPortfolioActualCell(child.actualResult, parent.calculationTypeCode) || ''
  const actualStr = actualFormatted || '—'

  const rawEvidences =
    child.actualResult == null
      ? ''
      : typeof child.actualResult === 'string'
        ? child.actualResult.trim()
        : (() => {
            try {
              return JSON.stringify(child.actualResult)
            } catch {
              return ''
            }
          })()
  const parsed = parsePmPortfolioEvidenceString(rawEvidences)
  const evidenceNote =
    [parsed.note.trim(), parsed.content.trim()].filter(Boolean).join(' · ') || '—'
  const targetSummary = `Đóng góp trong KPI «${parent.name}» · Minh chứng / ghi chú: ${evidenceNote}`

  const w = parent.weight
  const weightNum = typeof w === 'number' ? w : Number(w)
  const weightSafe = Number.isFinite(weightNum) ? weightNum : 0

  const kpiType = (parent.kpiType as GmStrategicKpiKind) || 'cascading'

  const modalItem: GmModalKpiItemMock = {
    code: String(child.id ?? parent.code ?? ''),
    obj: String(parent.name ?? ''),
    weight: weightSafe,
    target: targetStr,
    actual: actualStr,
    isFail: false,
    rootCause: '',
    score: '',
    kpiType,
    submissionStatus: 'submitted',
    assignmentStatusCode: child.statusCode != null ? Number(child.statusCode) : null,
    targetSummary,
    actualProgressPct: null,
    evidenceAttachmentUrl: null,
    evidenceNoteDisplay: evidenceNote,
    evidenceAttachments: parsed.attachments ?? [],
  }

  gmDrawerPmRollout.value = {
    pmName,
    rollupRoleLabel: 'PM',
    kpiName: String(parent.name ?? ''),
    kpiTarget: parent.target != null ? String(parent.target) : '—',
    rows: [
      {
        profile: {
          name: String(child.name ?? ''),
          rank: child.role != null ? String(child.role) : undefined,
          departmentLabel: 'CÔNG TY',
        },
        item: modalItem,
      },
    ],
  }
  gmDrawerMember.value = null
  gmDrawerItems.value = []
  isGmDrawerOpen.value = true
}

const handleRefresh = () => {
  personalKpiKey.value += 1
  void loadProcessTimeline()
}
</script>

<template>
  <div class="flex flex-col w-full text-slate-800 font-sans relative pb-10">
    
    <div class="space-y-4 p-3 sm:p-4 lg:p-6">
      <GmProcessTimeline
        :mid-year-issues="processTimelineData?.midYear ?? EMPTY_PM_PROCESS_TIMELINE_MID"
        :setting-issues="processTimelineData?.setting ?? undefined"
        :year-end-issues="processTimelineData?.yearEnd ?? undefined"
        :year="approvalYear"
      />
    </div>

    <div class="mx-6 mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
      
      <div class="flex bg-slate-50 border-b border-slate-200 px-4 pt-3 gap-2 overflow-x-auto hide-scrollbar">
        <button 
          @click="activeTab = 'personal'" 
          class="px-5 py-3 text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 relative -bottom-[1px]" 
          :class="activeTab === 'personal' ? 'bg-white text-blue-700 border border-slate-200 border-b-white z-10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 border border-transparent'"
        >
          <i class="fas fa-list-alt text-base"></i> KPI Portfolio
          <span
            v-if="pmFeedbackPendingByScope.portfolio > 0"
            class="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-sm ml-1">
            {{ pmFeedbackPendingByScope.portfolio }}
          </span>
        </button>

        <button 
          @click="activeTab = 'promotion'" 
          class="px-5 py-3 text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 relative -bottom-[1px]" 
          :class="activeTab === 'promotion' ? 'bg-white text-blue-700 border border-slate-200 border-b-white z-10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 border border-transparent'"
        >
          <i class="fas fa-arrow-trend-up text-base"></i> KPI Promotion
        </button>
        
        <button 
          @click="activeTab = 'team'" 
          class="px-5 py-3 text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 relative -bottom-[1px]" 
          :class="activeTab === 'team' ? 'bg-white text-blue-700 border border-slate-200 border-b-white z-10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 border border-transparent'"
        >
          <i class="fas fa-sitemap text-base"></i> Team Review
          <span
            v-if="teamPmEvaluationPendingCount > 0"
            class="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm ml-1"
          >{{ teamPmEvaluationPendingCount }}</span>
        </button>
        
        <button 
          @click="activeTab = 'requests'" 
          class="px-5 py-3 text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 relative -bottom-[1px]" 
          :class="activeTab === 'requests' ? 'bg-white text-blue-700 border border-slate-200 border-b-white z-10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 border border-transparent'"
        >
          <i class="fas fa-inbox text-base"></i> Request Approval
          <span v-if="pendingRequestsCount > 0" class="flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white shadow-sm ml-1">{{ pendingRequestsCount }}</span>
        </button>
      </div>

      <div class="bg-white">
        <PmPersonalKpiTab
          v-if="activeTab === 'personal'"
          :key="`pf-${personalKpiKey}`"
          portfolio-scope="portfolio"
          @open-assign="openAssignDrawer"
          @open-assign-after-member-feedback="openAssignDrawerAfterMemberFeedback"
          @open-member-detail="openKpiChildDetail"
          @feedback-pending-count="onPmFeedbackPendingCount"
          @timeline-refresh="() => void loadProcessTimeline()"
        />
        <PmPersonalKpiTab
          v-if="activeTab === 'promotion'"
          :key="`pm-${personalKpiKey}`"
          portfolio-scope="promotion"
          @open-assign="openAssignDrawer"
          @open-assign-after-member-feedback="openAssignDrawerAfterMemberFeedback"
          @open-member-detail="openKpiChildDetail"
          @feedback-pending-count="onPmFeedbackPendingCount"
          @timeline-refresh="() => void loadProcessTimeline()"
        />
        <PmTeamMembersTab
          v-if="activeTab === 'team'"
          :year="approvalYear"
          :reload-nonce="teamReviewReloadNonce"
          :kpis-cache="memberKpisCache"
          :comments-cache="memberComments"
          :portfolio-gate-loaded="pmPortfolioEvalGate.loaded"
          :portfolio-gate-open="pmPortfolioEvalGate.open"
          :portfolio-gate-pending="pmPortfolioEvalGate.pending"
          @open-member="openMemberDrawer"
          @pending-pm-evaluation-count="onTeamPendingPmEvaluationCount"
        />
        <PmRequestsTab
          v-if="activeTab === 'requests'"
          :members="approvalMemberSummaries"
          :loading="approvalLoading"
          @open-member="openMemberApprovalDrawer"
        />
      </div>
    </div>

    <!-- Always mounted so inner Transition sees open false→true / true→false (v-if on the component skips enter/leave). -->
    <PmAssignKpiDrawer
      :open="rightPanelVisible && rightPanelMode === 'assign'"
      :kpi="rightPanelMode === 'assign' ? activeItem : null"
      :pending-member-feedback-assignment-id="pendingAssignDrawerMemberFeedbackAssignmentId"
      @close="onPmAssignDrawerClose"
      @refresh="handleRefresh"
    />
    <PmMemberDetailDrawer
      :open="rightPanelVisible && rightPanelMode === 'member_detail'"
      :member="activeItem"
      :portfolio-gate-loaded="pmPortfolioEvalGate.loaded"
      :portfolio-gate-open="pmPortfolioEvalGate.open"
      :cached-supervisor-comments="
        activeItem?.id
          ? (memberComments[activeItem.id] ?? { main: '', promo: '' })
          : { main: '', promo: '' }
      "
      :cached-kpis="activeItem ? memberKpisCache[activeItem.id] : undefined"
      @close="closePanel"
      @save="handleMemberEvalSubmitted"
      @discard-draft="discardMemberEvalDraft"
    />
    <PmRequestDetailDrawer
      v-if="rightPanelVisible && rightPanelMode === 'request_detail'"
      :open="rightPanelVisible && rightPanelMode === 'request_detail'"
      :member-approval="
        activeItem && activeItem._approvalMember
          ? {
              userFullName: activeItem.userFullName,
              avatar: activeItem.avatar,
              kpis: activeItem.kpis ?? [],
            }
          : null
      "
      :action-busy="approvalSubmitting"
      @close="closePanel"
      @approve="onDrawerApproveRequest"
      @reject="onDrawerRejectRequest"
      @approve-all="onDrawerApproveAll"
      @reject-all="onDrawerRejectAll"
    />
    <!-- Luôn mount (không v-if) để Transition trong drawer chạy enter/leave khi mở Chi tiết thực hiện KPI. -->
    <GmMemberKpiDrawer
      :open="isGmDrawerOpen"
      :member="gmDrawerMember"
      :items="gmDrawerItems"
      :pm-kpi-rollout="gmDrawerPmRollout"
      @close="closeGmMemberDrawer"
    />
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

/* Ẩn scrollbar ngang cho thanh Tab */
.hide-scrollbar::-webkit-scrollbar { display: none; }
.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

.slide-panel-enter-active, .slide-panel-leave-active { transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1); }
.slide-panel-enter-from, .slide-panel-leave-to { transform: translateX(100%); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.28s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>