<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import EvaluationCommentBlock from '@/components/evaluation/EvaluationCommentBlock.vue'
import { pmKpiService, type PmMemberReviewMeta } from '@/services/modules/kpi-pm.service'
import { useToast } from 'vue-toastification'
import { KPI_TYPE, KPI_STATUS } from '@/config/constants'
import {
  formatPmPortfolioActualCell,
  formatNumericTarget,
  parsePmPortfolioEvidenceString,
  normalizeEvidenceHref,
  isEvidenceImageUrl,
  isRecordStyleCalcRule,
  pmPortfolioActualDisplayMode,
} from '@/utils/memberKpiHelpers'
import { formatKpiTargetWithUnit } from '@/utils/kpiUnitCodes'

const props = defineProps({
  open: { type: Boolean, default: false },
  member: { type: Object, default: null },
  year: { type: [Number, String], default: () => new Date().getFullYear() },
  readonlyYear: { type: Boolean, default: false },
  /** Đã load xong API “cổng” portfolio — tab KPI Member chờ gate trước khi bật Gửi đánh giá. */
  portfolioGateLoaded: { type: Boolean, default: false },
  /** true = mọi member đã nộp individual/team ≥501 cho PM. */
  portfolioGateOpen: { type: Boolean, default: false },
  /** Draft PM nhận xét tổng theo tab từ cache runtime của parent. */
  cachedSupervisorComments: {
    type: Object,
    default: () => ({ main: '', promo: '' }),
  },
  cachedKpis: { type: Array, default: null },
  initialTab: { type: String, default: 'main' },
})

const emit = defineEmits(['close', 'save', 'discard-draft'])
const toast = useToast()

const activeTab = ref<'main' | 'promotion'>('main')
const memberKpis = ref<any[]>([])
const isLoadingKpis = ref(false)
const reviewMeta = ref<PmMemberReviewMeta | null>(null)

function selectedYearValue(): number {
  const propYear = Number(props.year)
  if (Number.isFinite(propYear) && propYear > 0) return propYear
  const memberYear = Number(props.member?.year)
  if (Number.isFinite(memberYear) && memberYear > 0) return memberYear
  return new Date().getFullYear()
}

const reviewCommentsMain = ref({
  memberComment: '',
  pmComment: '',
})
const reviewCommentsPromo = ref({
  memberComment: '',
  pmComment: '',
})

function assignmentFingerprint(kpis: { id: string }[]): string {
  return kpis.map((k) => String(k.id)).sort().join('|')
}

watch(
  () => props.open,
  async (val) => {
    document.body.style.overflow = val ? 'hidden' : ''
    if (!val || !props.member?.id) return
    activeTab.value = props.initialTab === 'promotion' ? 'promotion' : 'main'
    reviewMeta.value = null
    reviewCommentsMain.value = { memberComment: '', pmComment: '' }
    reviewCommentsPromo.value = { memberComment: '', pmComment: '' }

    await Promise.all([fetchMemberKpis(), fetchReviewMeta()])

    const cached = props.cachedKpis as any[] | null | undefined
    const apiIds = assignmentFingerprint(memberKpis.value)
    const cacheIds =
      cached && cached.length > 0 ? assignmentFingerprint(cached as { id: string }[]) : ''
    const hasCachedAssignments = Boolean(cacheIds)
    const cacheCompatible = !hasCachedAssignments || apiIds === cacheIds

    if (!cacheCompatible) {
      emit('discard-draft', props.member.id)
    }

    const draftMain = cacheCompatible ? String(props.cachedSupervisorComments?.main ?? '').trim() : ''
    const draftPromo = cacheCompatible ? String(props.cachedSupervisorComments?.promo ?? '').trim() : ''

    const metaLoaded = reviewMeta.value as PmMemberReviewMeta | null
    reviewCommentsMain.value.memberComment = String(metaLoaded?.evaluationCommentsPortfolio ?? '')
    reviewCommentsPromo.value.memberComment = String(metaLoaded?.evaluationCommentsPromotion ?? '')

    const mainHasPendingPm = memberKpis.value.some(
      (k) => k.kpiType !== 'promotion' && isPmPendingAssignmentStatus(k.statusCode),
    )
    const promoHasPendingPm = memberKpis.value.some(
      (k) => k.kpiType === 'promotion' && isPmPendingAssignmentStatus(k.statusCode),
    )
    const mainHasFinalPendingPm = memberKpis.value.some(
      (k) => k.kpiType !== 'promotion' && Number(k.statusCode) === KPI_STATUS.SECOND_WAITING_PM_APPROVAL,
    )
    const promoHasFinalPendingPm = memberKpis.value.some(
      (k) => k.kpiType === 'promotion' && Number(k.statusCode) === KPI_STATUS.SECOND_WAITING_PM_APPROVAL,
    )

    // Chỉ dùng draft supervisor khi tab còn KPI chờ PM — tránh draft PM cũ ghi đè nhận xét GM/DB sau khi duyệt xong.
    if (mainHasPendingPm && draftMain) {
      reviewCommentsMain.value.pmComment = String(props.cachedSupervisorComments?.main ?? '')
    } else if (mainHasPendingPm) {
      reviewCommentsMain.value.pmComment = mainHasFinalPendingPm
        ? String(metaLoaded?.supervisorCommentsPortfolio ?? '')
        : ''
    } else {
      reviewCommentsMain.value.pmComment = String(metaLoaded?.supervisorCommentsPortfolio ?? '')
    }
    if (promoHasPendingPm && draftPromo) {
      reviewCommentsPromo.value.pmComment = String(props.cachedSupervisorComments?.promo ?? '')
    } else if (promoHasPendingPm) {
      reviewCommentsPromo.value.pmComment = promoHasFinalPendingPm
        ? String(metaLoaded?.supervisorCommentsPromotion ?? '')
        : ''
    } else {
      reviewCommentsPromo.value.pmComment = String(metaLoaded?.supervisorCommentsPromotion ?? '')
    }

    if (cacheCompatible && cached && cached.length > 0) {
      memberKpis.value.forEach((kpi) => {
        const hit = cached.find((c: any) => String(c.id) === String(kpi.id))
        if (hit) {
          if (hit.pmScore != null) {
            kpi.pmScore = hit.pmScore
          }
          // Chỉ khôi phục nhận xét nháp theo KPI khi assignment đó vẫn chờ PM — không ghi đè gmComment từ API.
          if (hit.pmComment && isPmPendingAssignmentStatus(kpi.statusCode)) {
            kpi.pmComment = hit.pmComment
          }
        }
      })
    }
  },
  { immediate: true },
)
onUnmounted(() => { document.body.style.overflow = '' })

async function fetchMemberKpis() {
  if (!props.member?.id) return
  isLoadingKpis.value = true
  memberKpis.value = []
  try {
    const year = selectedYearValue()
    const data = await pmKpiService.getMemberKpiDetails(props.member.id, year)
    memberKpis.value = (data ?? []).map((item: any) => {
      const parsedEvidences = parsePmPortfolioEvidenceString(item.evidences)
      return {
        id: String(item.id),
        group: item.group || 'Khác',
        code: item.code || '',
        kpiType: item.kpiTypeCode === KPI_TYPE.PROMOTION ? 'promotion'
          : item.kpiTypeCode === KPI_TYPE.TEAM ? 'cascading'
            : 'individual',
        name: item.name || '',
        target: item.target != null
          ? formatKpiTargetWithUnit(formatNumericTarget(item.target), item.unitCode)
          : '',
        actualResult:
          formatActualWithUnit(
            formatPmPortfolioActualCell(
              item.evidences,
              item.calcRuleCode,
              pmPortfolioActualDisplayMode(item.calcRuleCode),
            ) || '-',
            item.unitCode,
          ),
        weight: item.weight != null ? Number(item.weight) : 0,
        selfScore: item.selfScore != null ? Number(item.selfScore) : null,
        pmScore: item.pmScore != null ? Number(item.pmScore) : null,
        pmComment: item.pmComment || '',
        unitCode: item.unitCode ?? null,
        unitName: item.unitName ?? '',

        statusCode: item.statusCode,
        statusName: item.statusName ?? '',
        statusDesc: item.statusDesc ?? item.statusDescription ?? '',
        calcRuleCode: item.calcRuleCode,
        evidences: item.evidences || '',
        evidenceData: parsedEvidences.rows,
        evidenceContent: parsedEvidences.content || parsedEvidences.note || parsedEvidences.legacyPlain || '',
        evidenceAttachments: parsedEvidences.attachments ?? [],
      }
    })
  } catch (err) {
    console.error('Failed to fetch member KPI details:', err)
  } finally {
    isLoadingKpis.value = false
  }
}

async function fetchReviewMeta() {
  if (!props.member?.id) return
  try {
    const year = selectedYearValue()
    reviewMeta.value = await pmKpiService.getMemberReviewMeta(String(props.member.id), year)
  } catch (err) {
    console.error('Failed to fetch PM review meta:', err)
    reviewMeta.value = null
  }
}

function compareKpiNameEn(a: any, b: any): number {
  return String(a?.name ?? '').localeCompare(String(b?.name ?? ''), 'en', {
    sensitivity: 'base',
    numeric: true,
  })
}

const mainKpis = computed(() => memberKpis.value.filter((k) => k.kpiType !== 'promotion').sort(compareKpiNameEn))
const promoKpis = computed(() => memberKpis.value.filter(k => k.kpiType === 'promotion').sort(compareKpiNameEn))

function formatActualWithUnit(actual: unknown, unitCode: unknown): string {
  return formatKpiTargetWithUnit(String(actual ?? '').trim() || '-', unitCode as number | null | undefined)
}

const groupLabels: Record<string, string> = {
  A: '(A) Core Operations & Technical Excellence',
  B: '(B) People Development & Knowledge Sharing',
  C: '(C) Strategic Management & Governance'
}

const currentGroupedKpis = computed(() => {
  const sourceList = activeTab.value === 'promotion' ? promoKpis.value : mainKpis.value;
  const groups = sourceList.reduce((acc: any, item: any) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  const allGroups = [...new Set(sourceList.map(k => k.group))].sort()
  return allGroups.map(key => ({
    key, label: groupLabels[key] ?? key, items: [...(groups[key] || [])].sort(compareKpiNameEn)
  })).filter(g => g.items.length > 0)
})

// Trọng số & tổng có trọng số — đồng bộ KPI Personal (PmPersonalKpiTab)
const hasCurrentTabKpis = computed(() => currentGroupedKpis.value.length > 0)

const totalWeight = computed(() => {
  const list = activeTab.value === 'promotion' ? promoKpis.value : mainKpis.value
  return list.reduce((s, k) => s + (Number(k.weight) || 0), 0)
})

function formatWeightedTotalDisplay(sum: number): string {
  const rounded = Math.round(sum * 100) / 100
  if (rounded % 1 === 0) return String(rounded)
  return String(rounded.toFixed(2).replace(/\.?0+$/, ''))
}

/** Σ(score × weight) và số dòng có điểm — giống portfolioWeightedTotals. */
const memberDrawerWeightedTotals = computed(() => {
  const list = activeTab.value === 'promotion' ? promoKpis.value : mainKpis.value
  let selfSum = 0
  let pmSum = 0
  let selfContributed = 0
  let pmContributed = 0
  for (const k of list) {
    const w = Number(k.weight)
    if (!Number.isFinite(w)) continue

    if (k.selfScore != null) {
      const s = Number(k.selfScore)
      if (Number.isFinite(s)) {
        selfSum += s * w
        selfContributed += 1
      }
    }
    if (k.pmScore != null) {
      const p = Number(k.pmScore)
      if (Number.isFinite(p)) {
        pmSum += p * w
        pmContributed += 1
      }
    }
  }
  return { selfSum, pmSum, selfContributed, pmContributed }
})

/** Hàng TỔNG CỘNG — Self / PM: Σ(điểm × weight). */
const totalWeightedSelfDisplay = computed((): string => {
  const { selfSum, selfContributed } = memberDrawerWeightedTotals.value
  if (selfContributed === 0 || !Number.isFinite(selfSum)) return '-'
  return formatWeightedTotalDisplay(selfSum)
})

const totalWeightedPmDisplay = computed((): string => {
  const { pmSum, pmContributed } = memberDrawerWeightedTotals.value
  if (pmContributed === 0 || !Number.isFinite(pmSum)) return '-'
  return formatWeightedTotalDisplay(pmSum)
})

/** Trung bình có trọng số = Σ(score × weight) / Σ(weight). */
const averageWeightedSelfDisplay = computed((): string => {
  const tw = totalWeight.value
  const { selfSum, selfContributed } = memberDrawerWeightedTotals.value
  if (!Number.isFinite(tw) || tw <= 0 || selfContributed === 0 || !Number.isFinite(selfSum)) return '-'
  return formatWeightedTotalDisplay(selfSum / tw)
})

const averageWeightedPmDisplay = computed((): string => {
  const tw = totalWeight.value
  const { pmSum, pmContributed } = memberDrawerWeightedTotals.value
  if (!Number.isFinite(tw) || tw <= 0 || pmContributed === 0 || !Number.isFinite(pmSum)) return '-'
  return formatWeightedTotalDisplay(pmSum / tw)
})

/** Chờ PM giữa kỳ / cuối kỳ — theo từng assignment, không dùng MIN(status) của cả member. */
function isPmPendingAssignmentStatus(statusCode: unknown): boolean {
  const sc = Number(statusCode)
  return sc === KPI_STATUS.FIRST_WAITING_PM_APPROVAL || sc === KPI_STATUS.SECOND_WAITING_PM_APPROVAL
}

function tabHasPmPendingRows(rows: { statusCode?: unknown }[]): boolean {
  return rows.some((k) => isPmPendingAssignmentStatus(k.statusCode))
}

const canEvaluateMainTab = computed(() => tabHasPmPendingRows(mainKpis.value))
const canEvaluatePromotionTab = computed(() => tabHasPmPendingRows(promoKpis.value))
const canEvaluateActiveTab = computed(() =>
  activeTab.value === 'promotion' ? canEvaluatePromotionTab.value : canEvaluateMainTab.value,
)

const unlocking = ref(false)
const unlockConfirmOpen = ref(false)
const unlockTabAtPrompt = ref<'main' | 'promotion'>('main')
const UNLOCK_FROM_GM_WAITING_STATUSES = [
  KPI_STATUS.WAITING_GM_APPROVAL,
  KPI_STATUS.FIRST_WAITING_PM_APPROVAL,
  KPI_STATUS.FIRST_WAITING_GM_APPROVAL,
  KPI_STATUS.SECOND_WAITING_PM_APPROVAL,
  KPI_STATUS.SECOND_WAITING_GM_APPROVAL,
] as const

function rowsByTab(tab: 'main' | 'promotion') {
  return tab === 'promotion' ? promoKpis.value : mainKpis.value
}

function hasUnlockableWaitingGmRows(rows: { statusCode?: unknown }[]): boolean {
  return rows.some((row) => UNLOCK_FROM_GM_WAITING_STATUSES.includes(Number(row.statusCode) as any))
}

const canUnlockActiveTab = computed(() => hasUnlockableWaitingGmRows(rowsByTab(activeTab.value)))

/** Tab KPI Member: chỉ gửi lên GM khi cả team đã nộp portfolio cho PM; tab Promotion không áp dụng cổng này. */
const canSubmitPmEvaluationToGm = computed(() => {
  if (!canEvaluateActiveTab.value) return false
  if (activeTab.value === 'main') {
    if (!props.portfolioGateLoaded) return false
    if (!props.portfolioGateOpen) return false
  }
  return true
})

const expandedEvidenceRows = ref(new Set<string>())
function toggleEvidence(id: string) {
  const s = new Set(expandedEvidenceRows.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expandedEvidenceRows.value = s
}

function hasEvidence(item: any): boolean {
  return Boolean(
    (Array.isArray(item.evidenceData) && item.evidenceData.length > 0)
    || String(item.evidenceContent ?? '').trim()
    || (Array.isArray(item.evidenceAttachments) && item.evidenceAttachments.length > 0),
  )
}

const expandedCommentRows = ref(new Set<string>())

function statusLabel(item: any): string {
  const direct = String(item?.statusDesc ?? item?.statusName ?? '').trim()
  if (direct) return direct
  const code = Number(item?.statusCode ?? 0)
  const labels: Record<number, string> = {
    [KPI_STATUS.WAITING_PM_APPROVAL]: 'Waiting PM Approval',
    [KPI_STATUS.WAITING_GM_APPROVAL]: 'Waiting GM Approval',
    [KPI_STATUS.PENDING_ACCEPTANCE]: 'Pending Acceptance',
    [KPI_STATUS.ACCEPTED]: 'Accepted',
    [KPI_STATUS.REJECTED]: 'Rejected',
    [KPI_STATUS.FEEDBACK_IN_PROGRESS]: 'Feedback In Progress',
    [KPI_STATUS.FIRST_WAITING_PM_APPROVAL]: 'Waiting PM Review (1st)',
    [KPI_STATUS.FIRST_WAITING_GM_APPROVAL]: 'Waiting GM Approval (1st)',
    [KPI_STATUS.FIRST_COMPLETED]: 'GM Approved (1st)',
    [KPI_STATUS.SECOND_WAITING_PM_APPROVAL]: 'Waiting PM Review (Final)',
    [KPI_STATUS.SECOND_WAITING_GM_APPROVAL]: 'Waiting GM Approval (Final)',
    [KPI_STATUS.COMPLETED]: 'GM Approved (Final)',
  }
  return labels[code] ?? (code ? `Status ${code}` : '-')
}

function statusClass(statusCode: unknown): string {
  const c = Number(statusCode ?? 0)
  if ([KPI_STATUS.FIRST_WAITING_PM_APPROVAL, KPI_STATUS.FIRST_WAITING_GM_APPROVAL, KPI_STATUS.SECOND_WAITING_PM_APPROVAL, KPI_STATUS.SECOND_WAITING_GM_APPROVAL].includes(c as any)) {
    return 'border-sky-200 bg-sky-50 text-sky-700'
  }
  if (c === KPI_STATUS.FEEDBACK_IN_PROGRESS) return 'border-violet-200 bg-violet-50 text-violet-700'
  if (c === KPI_STATUS.REJECTED) return 'border-orange-200 bg-orange-50 text-orange-700'
  if ([KPI_STATUS.FIRST_COMPLETED, KPI_STATUS.COMPLETED].includes(c as any)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

const saving = ref(false)
function openUnlockConfirm() {
  if (props.readonlyYear) return
  if (saving.value || unlocking.value || !canUnlockActiveTab.value) return
  unlockTabAtPrompt.value = activeTab.value
  unlockConfirmOpen.value = true
}

function closeUnlockConfirm() {
  if (unlocking.value) return
  unlockConfirmOpen.value = false
}

async function confirmUnlockForActiveTab() {
  if (!props.member?.id || unlocking.value) return
  const tab = unlockTabAtPrompt.value
  const isPromo = tab === 'promotion'
  const rows = rowsByTab(tab)
  const unlockFromStatuses = UNLOCK_FROM_GM_WAITING_STATUSES.filter((status) =>
    rows.some((row) => Number(row.statusCode) === status),
  )
  if (unlockFromStatuses.length === 0) {
    unlockConfirmOpen.value = false
    toast.info('Không còn KPI nào ở trạng thái chờ GM duyệt để mở khóa.')
    return
  }

  unlocking.value = true
  try {
    const year = selectedYearValue()
    const initData = await pmKpiService.getInitialization(String(year))
    const cycleId = String(initData?.kpiCycle?.id ?? '').trim()
    if (!cycleId) {
      throw new Error('Không xác định được chu kỳ KPI để mở khóa.')
    }

    for (const status of unlockFromStatuses) {
      await pmKpiService.bulkUpdateKpiStatus({
        cycleId,
        statusCode: KPI_STATUS.PENDING_ACCEPTANCE,
        onlyFromStatusCode: status,
        promotion: isPromo,
        bulkForManagedMembers: true,
        managedMemberUserId: String(props.member.id),
      })
    }

    unlockConfirmOpen.value = false
    await Promise.all([fetchMemberKpis(), fetchReviewMeta()])
    toast.success('Đã mở khóa KPI thành công.')
  } catch (err) {
    console.error('Failed to unlock KPI before GM approval:', err)
    toast.error('Mở khóa KPI thất bại. Vui lòng thử lại.')
  } finally {
    unlocking.value = false
  }
}

const sendEvaluationForActiveTab = async () => {
  if (props.readonlyYear) return
  if (!props.member?.id) return
  const tab = activeTab.value
  const isPromo = tab === 'promotion'
  const rows = isPromo ? promoKpis.value : mainKpis.value
  const rc = isPromo ? reviewCommentsPromo.value : reviewCommentsMain.value

  if (tab === 'main' && (!props.portfolioGateLoaded || !props.portfolioGateOpen)) {
    toast.error(
      'Chưa thể gửi: còn nhân viên chưa nộp KPI Member (individual/team) cho PM. Xem danh sách phía trên bảng Team Hierarchy & Performance.',
    )
    return
  }

  if (!rows.length) {
    toast.error(isPromo ? 'Không có Promotion KPI để gửi.' : 'Không có KPI Member để gửi.')
    return
  }

  const rowsPendingPm = rows.filter((item) => isPmPendingAssignmentStatus(item.statusCode))
  if (!rowsPendingPm.length) {
    toast.error(
      isPromo
        ? 'Chưa có Promotion KPI nào đang chờ PM. Member cần gửi đánh giá phần Promotion trước.'
        : 'Chưa có KPI Member nào đang chờ PM trên tab này.',
    )
    return
  }

  const hasMidYear = rowsPendingPm.some((k) => Number(k.statusCode) === KPI_STATUS.FIRST_WAITING_PM_APPROVAL)
  const hasFinalYear = rowsPendingPm.some((k) => Number(k.statusCode) === KPI_STATUS.SECOND_WAITING_PM_APPROVAL)

  if (!String(rc.pmComment ?? '').trim()) {
    toast.error(
      hasFinalYear
        ? 'Vui lòng nhập nhận xét supervisor (bắt buộc cuối kỳ).'
        : 'Vui lòng nhập nhận xét supervisor (bắt buộc giữa kỳ).',
    )
    return
  }

  if (hasFinalYear) {
    for (const item of rowsPendingPm) {
      if (Number(item.statusCode) !== KPI_STATUS.SECOND_WAITING_PM_APPROVAL) continue
      const score = item.pmScore != null ? Number(item.pmScore) : NaN
      if (!Number.isFinite(score) || score < 1 || score > 5) {
        toast.error('Cuối kỳ: cần chấm điểm PM (1–5) cho mọi KPI trên tab này.')
        return
      }
    }
  }

  saving.value = true
  try {
    const year = selectedYearValue()
    const memberId = String(props.member.id)
    const requests: Promise<unknown>[] = rows.map((item) =>
      pmKpiService.saveMemberKpiComment({
        year,
        assignmentId: String(item.id),
        pmComment: String(item.pmComment ?? ''),
      }),
    )
    requests.push(
      pmKpiService.saveMemberSupervisorComment({
        year,
        memberId,
        pmComment: String(rc.pmComment ?? ''),
        promotion: isPromo,
      }),
    )
    for (const item of rows) {
      const st = Number(item.statusCode)
      if (item.pmScore != null && st === KPI_STATUS.SECOND_WAITING_PM_APPROVAL) {
        const score = Number(item.pmScore)
        if (Number.isFinite(score) && score >= 1 && score <= 5) {
          requests.push(pmKpiService.scoreItem(memberId, String(item.id), score))
        }
      }
    }
    await Promise.all(requests)

    const initData = await pmKpiService.getRegistrationInitData()
    const cycleId = initData.activeCycle.id
    if (hasMidYear) {
      await pmKpiService.bulkUpdateKpiStatus({
        cycleId,
        statusCode: KPI_STATUS.FIRST_WAITING_GM_APPROVAL,
        onlyFromStatusCode: KPI_STATUS.FIRST_WAITING_PM_APPROVAL,
        promotion: isPromo,
        bulkForManagedMembers: true,
        managedMemberUserId: memberId,
      })
    }
    if (hasFinalYear) {
      await pmKpiService.bulkUpdateKpiStatus({
        cycleId,
        statusCode: KPI_STATUS.SECOND_WAITING_GM_APPROVAL,
        onlyFromStatusCode: KPI_STATUS.SECOND_WAITING_PM_APPROVAL,
        promotion: isPromo,
        bulkForManagedMembers: true,
        managedMemberUserId: memberId,
      })
    }

    emit('save', {
      memberId: props.member.id,
      kpis: memberKpis.value,
      comments: { main: reviewCommentsMain.value.pmComment, promo: reviewCommentsPromo.value.pmComment },
    })
    toast.success('Đã gửi đánh giá tới GM.')
    emit('close')
  } catch (err) {
    console.error('Failed to send PM evaluation:', err)
    toast.error('Gửi đánh giá thất bại (điểm, nhận xét hoặc trạng thái KPI).')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pm-drawer" :duration="360" appear>
      <div v-if="open && member" class="fixed inset-0 z-[100]" role="dialog">
        <div class="pm-drawer-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
          @click="$emit('close')" />

        <aside
          class="pm-drawer-panel will-change-transform absolute right-0 top-0 bottom-0 flex w-full max-w-full flex-col border-l border-slate-200 bg-slate-50 shadow-2xl lg:w-[1100px] xl:w-[1280px]">

          <div class="flex flex-col shrink-0 border-b border-slate-200 bg-white shadow-sm z-10 sticky top-0">
            <div class="flex items-center justify-between px-6 py-4">
              <div class="flex items-center gap-4">
                <div class="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <i class="fas fa-file-signature text-xl"></i>
                </div>
                <div>
                  <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
                    Đánh giá KPI: <span class="text-indigo-700">{{ member.name }}</span>
                  </h2>
                  <div class="flex items-center gap-2 mt-1">
                    <span
                      class="text-[10px] uppercase font-bold text-slate-500 tracking-wider border border-slate-200 bg-slate-100 px-2 py-0.5 rounded-md">
                      {{ member.role || member.rank }}
                    </span>
                    <span class="text-xs text-slate-400">•</span>
                    <span class="text-xs text-slate-500 font-medium">Kỳ đánh giá: {{ selectedYearValue() }}</span>
                  </div>
                </div>
              </div>
              <button @click="$emit('close')"
                class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"><i
                  class="fas fa-times text-xl" /></button>
            </div>

          </div>

          <div class="custom-scrollbar flex-1 overflow-y-auto p-6 space-y-6">

            <div v-if="isLoadingKpis" class="flex items-center justify-center py-16 text-slate-400">
              <i class="fas fa-circle-notch fa-spin mr-3 text-xl text-indigo-500"></i>
              <span class="text-sm font-medium">Đang tải dữ liệu KPI...</span>
            </div>

            <div v-else class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
              <table class="min-w-[1180px] w-full text-sm text-left">
                <thead
                  class="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200">
                  <tr>
                    <th class="px-4 py-3 font-semibold text-center w-12">STT</th>
                    <th class="px-4 py-3 font-semibold w-1/4">HẠNG MỤC (OBJECTIVES)</th>
                    <th class="px-4 py-3 font-semibold text-center w-48">CHỈ TIÊU (TARGET)</th>
                    <th class="px-4 py-3 font-semibold text-center w-40">THỰC TẾ (ACTUAL)</th>
                    <th class="px-4 py-3 font-semibold text-center w-20">TRỌNG SỐ (W)</th>
                    <th class="px-4 py-3 font-semibold text-center w-32">EVIDENCE</th>
                    <th class="px-4 py-3 font-semibold text-center w-32">SELF SCORE</th>
                    <th class="px-4 py-3 font-semibold text-center w-32">FINAL SCORE</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <template v-for="groupData in currentGroupedKpis" :key="groupData.key">

                    <tr :class="activeTab === 'promotion' ? 'bg-violet-50/70 border-y border-violet-100' : 'bg-slate-50 border-y border-slate-200'">
                      <td colspan="8" class="px-4 py-2.5 text-xs font-bold uppercase tracking-wider" :class="activeTab === 'promotion' ? 'text-violet-800' : 'text-slate-800'">{{
                        groupData.label }}</td>
                    </tr>

                    <template v-for="(item, idx) in groupData.items" :key="item.id">
                      <tr class="hover:bg-slate-50/50 transition-colors">
                        <td class="px-4 py-4 text-center font-medium text-slate-400">{{ Number(idx) + 1 }}</td>

                        <td class="px-4 py-4">
                          <p class="flex flex-wrap items-center gap-2 font-semibold text-slate-800 text-sm">
                            <span>{{ item.code }} {{ item.name }}</span>
                            <span
                              class="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold"
                              :class="statusClass(item.statusCode)"
                            >
                              {{ statusLabel(item) }}
                            </span>
                          </p>
                        </td>

                        <td class="px-4 py-4 text-slate-600 text-xs leading-relaxed text-center">
                          {{ item.target }}
                        </td>
                        <td class="px-4 py-4 text-center">
                          <p class="text-xs font-medium text-emerald-700 leading-relaxed">{{ item.actualResult }}</p>
                        </td>
                        <td class="px-4 py-4 text-center font-semibold text-slate-700">{{ item.weight }}</td>
                        <td class="px-4 py-4 text-center align-middle">
                          <button
                            type="button"
                            class="inline-flex min-w-28 items-center justify-between gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition-colors"
                            :class="hasEvidence(item)
                              ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                              : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'"
                            @click.stop="toggleEvidence(item.id)"
                          >
                            <span class="inline-flex items-center gap-1">
                              <i class="fas fa-file-alt text-xs" />
                              {{ hasEvidence(item) ? 'Evidence' : 'No Evidence' }}
                            </span>
                            <i class="fas fa-chevron-down text-[10px] text-slate-500 transition-transform" :class="expandedEvidenceRows.has(item.id) ? 'rotate-180' : ''" />
                          </button>
                        </td>
                        <td class="px-4 py-4 text-center font-bold text-slate-900">{{ item.selfScore ?? '-' }}</td>

                        <td class="px-4 py-4 text-center">
                          <select v-model="item.pmScore" @click.stop
                            :disabled="props.readonlyYear || Number(item.statusCode) !== KPI_STATUS.SECOND_WAITING_PM_APPROVAL"
                            class="w-14 rounded border border-slate-300 bg-white px-1 py-1 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 shadow-sm cursor-pointer text-center disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed">
                            <option :value="null">-</option>
                            <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
                          </select>
                        </td>
                      </tr>

                      <tr v-if="expandedEvidenceRows.has(item.id)" class="bg-slate-50/50">
                        <td colspan="8" class="p-0 border-b border-slate-200">
                          <div
                            class="px-8 py-4 bg-gradient-to-r from-indigo-50/30 to-transparent border-l-2 border-indigo-300">
                            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Evidences</p>
                            <div class="overflow-x-auto rounded-lg border border-indigo-100 shadow-sm bg-white">
                              <table class="w-full text-left text-xs">
                                <thead
                                  class="bg-indigo-50 text-indigo-800 uppercase tracking-wider text-[10px] font-bold">
                                  <tr>
                                    <th class="px-3 py-2.5 text-center"
                                      :class="!isRecordStyleCalcRule(item.calcRuleCode) ? 'w-3/5' : 'w-2/3'">Content</th>
                                    <th v-if="!isRecordStyleCalcRule(item.calcRuleCode)"
                                      class="px-3 py-2.5 text-center w-1/5 border-l border-indigo-100/60">Plan</th>
                                    <th class="px-3 py-2.5 text-center border-l border-indigo-100/60"
                                      :class="!isRecordStyleCalcRule(item.calcRuleCode) ? 'w-1/5' : 'w-1/3'">Actual</th>
                                  </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                  <tr v-for="(ev, eIdx) in item.evidenceData" :key="eIdx"
                                    class="hover:bg-slate-50 transition-colors">
                                    <td class="px-3 py-2.5 font-medium text-slate-800 leading-snug">{{ ev.content || ev.comment }}
                                    </td>
                                    <td v-if="!isRecordStyleCalcRule(item.calcRuleCode)"
                                      class="px-3 py-2.5 text-center text-slate-600 border-l border-slate-100">{{
                                        ev.plan }}</td>
                                    <td
                                      class="px-3 py-2.5 text-center font-bold text-emerald-600 border-l border-slate-100">
                                      {{ formatActualWithUnit(ev.actual, item.unitCode) }}</td>
                                  </tr>
                                  <tr v-if="(!item.evidenceData || item.evidenceData.length === 0) && !item.evidenceContent">
                                    <td :colspan="isRecordStyleCalcRule(item.calcRuleCode) ? 2 : 3"
                                      class="px-3 py-3 text-center text-slate-400 font-medium italic">Không có dữ liệu
                                      khai báo chi tiết.</td>
                                  </tr>
                                  <tr v-if="item.evidenceContent">
                                    <td :colspan="isRecordStyleCalcRule(item.calcRuleCode) ? 2 : 3" class="px-4 py-3 text-slate-700 whitespace-pre-wrap bg-yellow-50/30 border-t border-yellow-100">
                                      <p class="font-bold text-[10px] uppercase text-yellow-700/70 mb-1">Nội dung nhận xét / diễn giải:</p>
                                      {{ item.evidenceContent }}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                            <div
                              v-if="item.evidenceAttachments && item.evidenceAttachments.length > 0"
                              class="mt-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                            >
                              <p class="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Minh chứng đính kèm (URL / file)
                              </p>
                              <ul class="flex flex-col gap-3">
                                <li
                                  v-for="(att, aIdx) in item.evidenceAttachments"
                                  :key="aIdx"
                                  class="rounded-md border border-slate-100 bg-slate-50/80 p-2"
                                >
                                  <a
                                    :href="normalizeEvidenceHref(att.url)"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="break-all text-xs font-semibold text-indigo-600 underline hover:text-indigo-800"
                                  >
                                    {{ att.name || att.url }}
                                  </a>
                                  <div v-if="isEvidenceImageUrl(att.url)" class="mt-2">
                                    <img
                                      :src="normalizeEvidenceHref(att.url)"
                                      :alt="att.name || 'Evidence'"
                                      class="max-h-40 max-w-full rounded border border-slate-200 object-contain"
                                    />
                                  </div>
                                </li>
                              </ul>
                            </div>
                            <div class="mt-3 rounded-lg border border-emerald-100 bg-white p-3 shadow-sm">
                              <p class="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                Supervisor's Comment
                              </p>
                              <textarea
                                v-model="item.pmComment"
                                :disabled="props.readonlyYear || !isPmPendingAssignmentStatus(item.statusCode)"
                                class="w-full px-3 py-2.5 text-sm font-normal text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed resize-vertical"
                                rows="4"
                                placeholder="Nhập nhận xét / đánh giá cho KPI này..."
                              />
                            </div>
                          </div>
                        </td>
                      </tr>

                      <tr v-if="false && expandedCommentRows.has(item.id)" class="bg-emerald-50/50">
                        <td colspan="8" class="p-0 border-b border-slate-200">
                          <div
                            class="px-8 py-4 bg-gradient-to-r from-emerald-50/30 to-transparent border-l-2 border-emerald-300">
                            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Supervisor's Comment</p>
                            <textarea
                              v-model="item.pmComment"
                              :disabled="props.readonlyYear || !isPmPendingAssignmentStatus(item.statusCode)"
                              class="w-full px-3 py-2.5 text-sm font-normal text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed resize-vertical"
                              rows="4"
                              placeholder="Nhập nhận xét / đánh giá cho KPI này..."
                            />
                          </div>
                        </td>
                      </tr>

                    </template>
                  </template>

                  <tr v-if="currentGroupedKpis.length === 0">
                    <td colspan="8" class="py-8 text-center text-sm font-medium text-slate-500">No KPI Evaluation</td>
                  </tr>
                </tbody>

                <tbody v-if="hasCurrentTabKpis" class="border-t-2 border-slate-200">
                  <tr class="bg-slate-50">
                    <td colspan="4" class="px-4 py-3 text-right font-bold text-slate-600 text-xs tracking-wider">
                      TỔNG CỘNG (TOTAL SCORE):
                    </td>
                    <td class="px-4 py-3 text-center font-bold text-slate-800">{{ totalWeight }} <span class="text-[10px] text-slate-400 font-normal">pts</span></td>
                    <td class="px-4 py-3 text-center font-bold text-slate-400">-</td>
                    <td class="px-4 py-3 text-center font-bold text-slate-800">{{ totalWeightedSelfDisplay }}</td>
                    <td class="px-4 py-3 text-center font-bold text-slate-400">{{ totalWeightedPmDisplay }}</td>
                  </tr>
                  <tr class="bg-purple-50 border-t border-purple-100">
                    <td colspan="5" class="px-4 py-4 text-right font-bold text-purple-700 text-xs tracking-wider">
                      ĐIỂM TRUNG BÌNH (AVERAGE SCORE):
                    </td>
                    <td class="px-4 py-4 text-center font-bold text-slate-300">-</td>
                    <td class="px-4 py-4 text-center text-lg font-black text-purple-700">{{ averageWeightedSelfDisplay }}</td>
                    <td class="px-4 py-4 text-center font-bold text-purple-300">{{ averageWeightedPmDisplay }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              v-if="hasCurrentTabKpis && activeTab === 'main' && portfolioGateLoaded && !portfolioGateOpen"
              class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 mb-3"
            >
              <i class="fas fa-user-clock mr-2 text-amber-600" aria-hidden="true" />
              Chỉ gửi đánh giá KPI Member lên GM khi toàn team đã nộp kết quả cho PM. Xem tên còn thiếu ở thông báo phía trên bảng
              <strong>Team Hierarchy & Performance</strong>.
            </div>

            <div v-if="hasCurrentTabKpis && activeTab === 'main'" class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <EvaluationCommentBlock
                v-model:employeeComment="reviewCommentsMain.memberComment"
                v-model:managerComment="reviewCommentsMain.pmComment"
                employeeTitle="Employee's Comment"
                managerTitle="Supervisor Comment"
                :employeeReadonly="true"
                :managerReadonly="props.readonlyYear || !canEvaluateMainTab"
              />
            </div>
            <div v-if="hasCurrentTabKpis && activeTab === 'promotion'" class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <EvaluationCommentBlock
                v-model:employeeComment="reviewCommentsPromo.memberComment"
                v-model:managerComment="reviewCommentsPromo.pmComment"
                employeeTitle="Employee's Comment (Promotion)"
                managerTitle="Supervisor Comment (Promotion)"
                :employeeReadonly="true"
                :managerReadonly="props.readonlyYear || !canEvaluatePromotionTab"
              />
            </div>

            <div class="h-4"></div>
          </div>

          <div class="bg-white border-t border-slate-200 p-4 px-6 flex justify-end gap-3 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <button @click="$emit('close')"
              class="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors">
              Hủy
            </button>
            <button
              v-if="canUnlockActiveTab"
              @click="openUnlockConfirm"
              :disabled="props.readonlyYear || saving || unlocking"
              class="px-5 py-2.5 text-sm font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
              <i v-if="unlocking" class="fas fa-spinner fa-spin" />
              <i v-else class="fas fa-lock-open" />
              {{ unlocking ? 'Đang mở khóa...' : 'Unlock' }}
            </button>
            <button @click="sendEvaluationForActiveTab" :disabled="props.readonlyYear || saving || !canSubmitPmEvaluationToGm"
              class="px-6 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-xl hover:bg-indigo-600 hover:shadow-lg transition-all flex items-center gap-2 focus:ring-4 focus:ring-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed">
              <i v-if="saving" class="fas fa-spinner fa-spin" />
              <i v-else class="fas fa-paper-plane" />
              {{ saving ? 'Đang gửi...' : 'Gửi đánh giá' }}
            </button>
          </div>

          <Teleport to="body">
            <Transition name="pm-drawer" :duration="220">
              <div
                v-if="unlockConfirmOpen"
                class="fixed inset-0 z-[120] flex items-center justify-center p-4"
                role="dialog"
                aria-modal="true"
              >
                <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="closeUnlockConfirm" />
                <div class="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
                  <h3 class="text-lg font-bold text-slate-900">Xác nhận mở khóa KPI</h3>
                  <p class="mt-3 text-sm text-slate-700">
                    Bạn có chắc chắn muốn mở khóa toàn bộ KPI của <span class="font-bold">{{ member.name }}</span> này không?
                  </p>
                  <div class="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      :disabled="unlocking"
                      class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      @click="closeUnlockConfirm"
                    >
                      Không
                    </button>
                    <button
                      type="button"
                      :disabled="unlocking"
                      class="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                      @click="confirmUnlockForActiveTab"
                    >
                      <i v-if="unlocking" class="fas fa-spinner fa-spin text-xs" />
                      <i v-else class="fas fa-lock-open text-xs" />
                      Có
                    </button>
                  </div>
                </div>
              </div>
            </Transition>
          </Teleport>

        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Backdrop fade + panel slide — không fade cả overlay (tránh nhấp nháy) */
.pm-drawer-enter-active,
.pm-drawer-leave-active {
  transition-duration: 0.36s;
}

.pm-drawer-enter-active .pm-drawer-backdrop,
.pm-drawer-leave-active .pm-drawer-backdrop {
  transition: opacity 0.36s ease;
}

.pm-drawer-enter-active .pm-drawer-panel,
.pm-drawer-leave-active .pm-drawer-panel {
  transition: transform 0.36s cubic-bezier(0.16, 1, 0.3, 1);
}

.pm-drawer-enter-from .pm-drawer-backdrop,
.pm-drawer-leave-to .pm-drawer-backdrop {
  opacity: 0;
}

.pm-drawer-enter-to .pm-drawer-backdrop,
.pm-drawer-leave-from .pm-drawer-backdrop {
  opacity: 1;
}

.pm-drawer-enter-from .pm-drawer-panel,
.pm-drawer-leave-to .pm-drawer-panel {
  transform: translate3d(100%, 0, 0);
}

.pm-drawer-enter-to .pm-drawer-panel,
.pm-drawer-leave-from .pm-drawer-panel {
  transform: translate3d(0, 0, 0);
}

@media (prefers-reduced-motion: reduce) {

  .pm-drawer-enter-active,
  .pm-drawer-leave-active,
  .pm-drawer-enter-active .pm-drawer-backdrop,
  .pm-drawer-leave-active .pm-drawer-backdrop,
  .pm-drawer-enter-active .pm-drawer-panel,
  .pm-drawer-leave-active .pm-drawer-panel {
    transition-duration: 0.01ms !important;
  }

  .pm-drawer-enter-from .pm-drawer-panel,
  .pm-drawer-leave-to .pm-drawer-panel {
    transform: none;
  }
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
