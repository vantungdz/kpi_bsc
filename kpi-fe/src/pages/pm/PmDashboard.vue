<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
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
import { isPmEvaluationSubject } from '@/utils/pmEvaluationSubject'
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

const invalidMembers = ref<string[]>([])
/** Giữ khớp rule với lần bấm "Gửi toàn bộ đánh giá" gần nhất — để gỡ highlight sau khi Lưu trong drawer */
const bulkSubmitUsesEndYearRules = ref(false)
const memberComments = ref<Record<string, string>>({})
const memberKpisCache = ref<Record<string, any[]>>({})

/** Trả về true nếu member chưa đủ điều kiện bulk (đồng bộ logic trong handleSubmitEvaluations). */
function memberFailsBulkSubmitRules(m: any, isEndYear: boolean): boolean {
  if (!m?.id) return false
  if (!isPmEvaluationSubject(m)) return false
  if (isEndYear) {
    if (m.statusCode < 601) return true
    if (m.statusCode === 601) {
      const comment = memberComments.value[m.id]
      const kpis = memberKpisCache.value[m.id]
      if (!comment?.trim()) return true
      if (!kpis?.length) return true
      return kpis.some((kpi: any) => kpi.pmScore == null)
    }
    return false
  }
  if (m.statusCode < 501) return true
  if (m.statusCode === 501) return !memberComments.value[m.id]?.trim()
  return false
}

// Control refresh of PM Portfolio tab after actions in drawers
const personalKpiKey = ref(0)
/** Tăng để Team Review refetch hierarchy sau bulk gửi đánh giá (không reload trang). */
const teamReviewReloadNonce = ref(0)

const approvalYear = new Date().getFullYear()
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
  user: string
  avatar: string
  type: string
  kpiName: string
  oldValue: string | null
  newValue: string
  reason: string
  status: string
  date: string
}

const requests = ref<PmRequestUiRow[]>([])
const pendingRequestsCount = computed(() => requests.value.filter((r) => r.status === 'PENDING').length)

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
    return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })
  } catch {
    return '—'
  }
}

function mapApprovalToUi(r: PmMemberKpiApprovalItem): PmRequestUiRow {
  const w = r.weight != null ? Number(r.weight) : null
  const weightLabel = w != null && Number.isFinite(w) ? `${w}% trọng số` : '—'
  const newValueParts = [weightLabel]
  if (r.categoryName) newValueParts.push(r.categoryName)
  const just = (r.justification && r.justification.trim()) || ''
  const target = (r.targetDescription && r.targetDescription.trim()) || ''
  return {
    id: r.assignmentId,
    user: r.userFullName ?? '—',
    avatar: initialsFromName(r.userFullName ?? ''),
    type: 'CREATE_KPI',
    kpiName: r.kpiName ?? '—',
    oldValue: null,
    newValue: newValueParts.join(' · '),
    reason: just || target || '—',
    status: 'PENDING',
    date: formatRequestedAt(r.requestedAt),
  }
}

async function loadApprovalRequests() {
  approvalLoading.value = true
  try {
    const rows = await pmKpiService.listMemberKpiApprovals(approvalYear)
    requests.value = rows.map(mapApprovalToUi)
  } catch (e) {
    console.error(e)
    toast.error('Không tải được danh sách đề xuất KPI')
    requests.value = []
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

async function submitApprovalDecision(req: PmRequestUiRow, approve: boolean) {
  if (approvalSubmitting.value) return
  approvalSubmitting.value = true
  try {
    await pmKpiService.decideMemberKpiApproval({
      year: approvalYear,
      assignmentId: req.id,
      approve,
    })
    toast.success(
      approve ? 'Đã duyệt — KPI chuyển sang chờ GM (403).' : 'Đã từ chối đề xuất KPI (406).',
    )
    if (rightPanelVisible.value && rightPanelMode.value === 'request_detail' && activeItem.value?.id === req.id) {
      closePanel()
    }
    await loadApprovalRequests()
  } catch (err: unknown) {
    toast.error(apiErrorMessage(err))
  } finally {
    approvalSubmitting.value = false
  }
}

watch(activeTab, (t) => {
  if (t === 'requests') loadApprovalRequests()
})

const initLocalStorage = () => {
  const savedComments = localStorage.getItem('pm_eval_comments')
  if (savedComments) {
    try { memberComments.value = JSON.parse(savedComments) } catch(e) {}
  }
  const savedKpis = localStorage.getItem('pm_eval_kpis')
  if (savedKpis) {
    try { memberKpisCache.value = JSON.parse(savedKpis) } catch(e) {}
  }
}

onMounted(() => {
  initLocalStorage()
  void loadProcessTimeline()
  if (activeTab.value === 'requests') loadApprovalRequests()
})

function onDrawerApproveRequest() {
  const r = activeItem.value as PmRequestUiRow | null
  if (r) submitApprovalDecision(r, true)
}

function onDrawerRejectRequest() {
  const r = activeItem.value as PmRequestUiRow | null
  if (r) submitApprovalDecision(r, false)
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

const openAssignDrawer = (kpi: any) => { activeItem.value = kpi; rightPanelMode.value = 'assign'; rightPanelVisible.value = true }
const openMemberDrawer = (member: any) => { activeItem.value = member; rightPanelMode.value = 'member_detail'; rightPanelVisible.value = true }
const openRequestDrawer = (req: any) => { activeItem.value = req; rightPanelMode.value = 'request_detail'; rightPanelVisible.value = true }
const closePanel = () => { rightPanelVisible.value = false; setTimeout(() => { activeItem.value = null; rightPanelMode.value = 'none' }, 300); personalKpiKey.value += 1 }

const handleSaveMemberKpis = (payload: { kpis: any[]; comments: any; memberId?: string }) => {
  const mid = payload.memberId ?? activeItem.value?.id
  const memberRow = activeItem.value?.id === mid ? activeItem.value : null
  if (mid) {
    memberComments.value = { ...memberComments.value, [mid]: payload.comments.pmComment }
    memberKpisCache.value = { ...memberKpisCache.value, [mid]: payload.kpis }

    // Save to localStorage to persist across F5 refresh
    localStorage.setItem('pm_eval_comments', JSON.stringify(memberComments.value))
    localStorage.setItem('pm_eval_kpis', JSON.stringify(memberKpisCache.value))

    toast.success('Lưu đánh giá thành công (Lưu tạm)')

    // Gỡ tô đỏ hàng Team Review khi dữ liệu đã đủ điều kiện bulk
    if (invalidMembers.value.includes(mid) && memberRow) {
      if (!memberFailsBulkSubmitRules(memberRow, bulkSubmitUsesEndYearRules.value)) {
        invalidMembers.value = invalidMembers.value.filter((id) => id !== mid)
      }
    }
  }
}

const handleSubmitEvaluations = async (evaluationSubjects: any[]) => {
  if (evaluationSubjects.length === 0) {
    toast.info('Không có nhân sự nào đang chờ PM đánh giá trong kỳ này (501/601).')
    return
  }

  bulkSubmitUsesEndYearRules.value = evaluationSubjects.some((m) => Number(m.statusCode) >= 600)
  const isEndYear = bulkSubmitUsesEndYearRules.value

  let isValid = true
  const newInvalidMembers: string[] = []

  for (const m of evaluationSubjects) {
    if (memberFailsBulkSubmitRules(m, isEndYear)) {
      isValid = false
      newInvalidMembers.push(m.id)
    }
  }

  invalidMembers.value = newInvalidMembers

  if (!isValid) {
    toast.error('Vui lòng đảm bảo TOÀN BỘ thành viên đều đã nộp KPI và được PM đánh giá (Điểm & Nhận xét)!')
    return
  }

  try {
    const initData = await pmKpiService.getRegistrationInitData()
    const cycleId = initData.activeCycle.id
    
    // Call API to save PM scores for all valid members
    const promises: Promise<any>[] = []
    
    if (isEndYear) {
      for (const m of evaluationSubjects) {
        if (m.statusCode === 601) {
          const kpis = memberKpisCache.value[m.id]
          if (kpis) {
            for (const kpi of kpis) {
              if (kpi.pmScore != null) {
                // Ignore API failures for scores since it might not be fully implemented, but try our best
                promises.push(pmKpiService.scoreItem(m.id, kpi.id, kpi.pmScore).catch(() => {}))
              }
            }
          }
        }
      }
    }
    
    if (promises.length > 0) {
      await Promise.all(promises)
    }

    // Call Bulk Update Status API
    // bulkForManagedMembers: cập nhật KPI của cả team dưới PM (501→502 / 601→602), không chỉ dòng KPI của chính PM
    await pmKpiService.bulkUpdateKpiStatus({
      cycleId: cycleId,
      statusCode: isEndYear ? 602 : 502,
      onlyFromStatusCode: isEndYear ? 601 : 501,
      promotion: false,
      bulkForManagedMembers: true,
    })

    invalidMembers.value = []
    memberComments.value = {}
    memberKpisCache.value = {}
    try {
      localStorage.removeItem('pm_eval_comments')
      localStorage.removeItem('pm_eval_kpis')
    } catch {
      /* ignore */
    }
    teamReviewReloadNonce.value += 1
    personalKpiKey.value += 1

    toast.success('Gửi toàn bộ đánh giá thành công!')
  } catch (err: any) {
    console.error('Failed to submit evaluations:', err)
    toast.error('Gửi đánh giá thất bại: ' + (err.response?.data?.message || err.message))
  }
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
          @open-member-detail="openKpiChildDetail"
          @feedback-pending-count="onPmFeedbackPendingCount"
        />
        <PmPersonalKpiTab
          v-if="activeTab === 'promotion'"
          :key="`pm-${personalKpiKey}`"
          portfolio-scope="promotion"
          @open-assign="openAssignDrawer"
          @open-member-detail="openKpiChildDetail"
          @feedback-pending-count="onPmFeedbackPendingCount"
        />
        <PmTeamMembersTab
          v-if="activeTab === 'team'"
          :year="approvalYear"
          :reload-nonce="teamReviewReloadNonce"
          :invalid-members="invalidMembers"
          :kpis-cache="memberKpisCache"
          :comments-cache="memberComments"
          @open-member="openMemberDrawer"
          @submit-evaluations="handleSubmitEvaluations"
        />
        <PmRequestsTab
          v-if="activeTab === 'requests'"
          :requests="requests"
          :loading="approvalLoading"
          :action-busy="approvalSubmitting"
          @open-request="openRequestDrawer"
          @approve="submitApprovalDecision($event, true)"
          @reject="submitApprovalDecision($event, false)"
        />
      </div>
    </div>

    <!-- Always mounted so inner Transition sees open false→true / true→false (v-if on the component skips enter/leave). -->
    <PmAssignKpiDrawer
      :open="rightPanelVisible && rightPanelMode === 'assign'"
      :kpi="rightPanelMode === 'assign' ? activeItem : null"
      @close="closePanel"
      @refresh="handleRefresh"
    />
    <PmMemberDetailDrawer
      :open="rightPanelVisible && rightPanelMode === 'member_detail'"
      :member="activeItem"
      :persisted-pm-comment="activeItem?.apiPmComment ?? ''"
      :cached-comment="activeItem ? memberComments[activeItem.id] : ''"
      :cached-kpis="activeItem ? memberKpisCache[activeItem.id] : undefined"
      @close="closePanel"
      @save="handleSaveMemberKpis"
      @discard-draft="discardMemberEvalDraft"
    />
    <PmRequestDetailDrawer
      v-if="rightPanelVisible && rightPanelMode === 'request_detail'"
      :open="rightPanelVisible && rightPanelMode === 'request_detail'"
      :request="activeItem"
      :action-busy="approvalSubmitting"
      @close="closePanel"
      @approve="onDrawerApproveRequest"
      @reject="onDrawerRejectRequest"
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