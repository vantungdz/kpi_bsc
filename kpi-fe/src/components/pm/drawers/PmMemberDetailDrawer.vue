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
  CALC_RULE_AVERAGE,
} from '@/utils/memberKpiHelpers'

const props = defineProps({
  open: { type: Boolean, default: false },
  member: { type: Object, default: null },
  /** Đã load xong API “cổng” portfolio — tab KPI Member chờ gate trước khi bật Gửi đánh giá. */
  portfolioGateLoaded: { type: Boolean, default: false },
  /** true = mọi member đã nộp individual/team ≥501 cho PM. */
  portfolioGateOpen: { type: Boolean, default: false },
  /** Draft PM nhận xét tổng theo tab (localStorage / cache parent). */
  cachedSupervisorComments: {
    type: Object,
    default: () => ({ main: '', promo: '' }),
  },
  cachedKpis: { type: Array, default: null },
})

const emit = defineEmits(['close', 'save', 'discard-draft'])
const toast = useToast()

const activeTab = ref<'main' | 'promotion'>('main')
const memberKpis = ref<any[]>([])
const isLoadingKpis = ref(false)
const reviewMeta = ref<PmMemberReviewMeta | null>(null)

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
    activeTab.value = 'main'
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

    if (draftMain) {
      reviewCommentsMain.value.pmComment = String(props.cachedSupervisorComments?.main ?? '')
    } else {
      reviewCommentsMain.value.pmComment = String(metaLoaded?.supervisorCommentsPortfolio ?? '')
    }
    if (draftPromo) {
      reviewCommentsPromo.value.pmComment = String(props.cachedSupervisorComments?.promo ?? '')
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
          if (hit.pmComment) {
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
    const year = props.member.year ? Number(props.member.year) : new Date().getFullYear()
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
        target: item.target != null ? formatNumericTarget(item.target) : '',
        actualResult:
          formatPmPortfolioActualCell(
            item.evidences,
            item.calcRuleCode,
            Number(item.calcRuleCode) === CALC_RULE_AVERAGE ? 'mean' : 'list',
          ) || '-',
        weight: item.weight != null ? Number(item.weight) : 0,
        selfScore: item.selfScore != null ? Number(item.selfScore) : null,
        pmScore: item.pmScore != null ? Number(item.pmScore) : null,
        pmComment: item.pmComment || '',

        statusCode: item.statusCode,
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
    const year = props.member.year ? Number(props.member.year) : new Date().getFullYear()
    reviewMeta.value = await pmKpiService.getMemberReviewMeta(String(props.member.id), year)
  } catch (err) {
    console.error('Failed to fetch PM review meta:', err)
    reviewMeta.value = null
  }
}

const mainKpis = computed(() => memberKpis.value.filter((k) => k.kpiType !== 'promotion'))
const promoKpis = computed(() => memberKpis.value.filter(k => k.kpiType === 'promotion'))
const hasPromotion = computed(() => promoKpis.value.length > 0)

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
    key, label: groupLabels[key] ?? key, items: groups[key] || []
  })).filter(g => g.items.length > 0)
})

// Trọng số & tổng có trọng số — đồng bộ KPI Portfolio (PmPersonalKpiTab)
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

const expandedCommentRows = ref(new Set<string>())
function toggleComment(id: string) {
  const s = new Set(expandedCommentRows.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expandedCommentRows.value = s
}

const saving = ref(false)
const sendEvaluationForActiveTab = async () => {
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
        ? 'Chưa có Promotion KPI nào đang chờ PM (501/601). Member cần gửi đánh giá phần Promotion trước.'
        : 'Chưa có KPI Member nào đang chờ PM (501/601) trên tab này.',
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
        toast.error('Cuối kỳ: cần chấm điểm PM (1–5) cho mọi KPI 601 trên tab này.')
        return
      }
    }
  }

  saving.value = true
  try {
    const year = props.member.year ? Number(props.member.year) : new Date().getFullYear()
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
                    <span class="text-xs text-slate-500 font-medium">Kỳ đánh giá: {{ member.year || new Date().getFullYear() }}</span>
                  </div>
                </div>
              </div>
              <button @click="$emit('close')"
                class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"><i
                  class="fas fa-times text-xl" /></button>
            </div>

            <div v-if="hasPromotion" class="bg-white px-6 flex gap-6">
              <button @click="activeTab = 'main'"
                class="pb-3 pt-4 border-b-2 text-sm font-bold flex items-center gap-2 transition-colors"
                :class="activeTab === 'main' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'">
                <i class="fas fa-bullseye"></i> KPI Member
              </button>
              <button @click="activeTab = 'promotion'"
                class="pb-3 pt-4 border-b-2 text-sm font-bold flex items-center gap-2 transition-colors"
                :class="activeTab === 'promotion' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-700'">
                <i class="fas fa-award"></i> Promotion KPI
              </button>
            </div>
          </div>

          <div class="custom-scrollbar flex-1 overflow-y-auto p-6 space-y-6">

            <div v-if="isLoadingKpis" class="flex items-center justify-center py-16 text-slate-400">
              <i class="fas fa-circle-notch fa-spin mr-3 text-xl text-indigo-500"></i>
              <span class="text-sm font-medium">Đang tải dữ liệu KPI...</span>
            </div>

            <div v-else class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table class="w-full text-sm text-left">
                <thead
                  class="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200">
                  <tr>
                    <th class="px-4 py-3 font-semibold text-center w-12">#</th>
                    <th class="px-4 py-3 font-semibold w-1/4">Hạng Mục</th>
                    <th class="px-4 py-3 font-semibold text-center w-48">Chỉ Tiêu (Target)</th>
                    <th class="px-4 py-3 font-semibold text-center w-40">Thực tế (Actual)</th>
                    <th class="px-4 py-3 font-semibold text-center w-20">W(%)</th>
                    <th class="px-4 py-3 font-semibold text-center w-32">Self Score</th>
                    <th class="px-4 py-3 font-semibold text-center w-32">PM Score</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <template v-for="groupData in currentGroupedKpis" :key="groupData.key">

                    <tr class="bg-orange-50/50">
                      <td colspan="7" class="px-4 py-2.5 text-xs font-bold text-orange-800 tracking-wide border-y border-orange-100/50">{{
                        groupData.label }}</td>
                    </tr>

                    <template v-for="(item, idx) in groupData.items" :key="item.id">
                      <tr class="hover:bg-slate-50/50 transition-colors">
                        <td class="px-4 py-4 text-center font-medium text-slate-400">{{ Number(idx) + 1 }}</td>

                        <td class="px-4 py-4">
                          <p class="font-semibold text-slate-800 text-sm mb-1.5">
                            {{ item.code }} {{ item.name }}
                          </p>
                          <span
                            class="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200"
                            :class="item.kpiType === 'promotion' ? 'bg-purple-50 text-purple-700 border-purple-200' : ''">
                            {{ item.kpiType }}
                          </span>
                          <div class="mt-2 flex items-center gap-4">
                            <div @click="toggleEvidence(item.id)" class="text-xs text-indigo-600 font-medium cursor-pointer hover:underline flex items-center gap-1">
                              Evidences <i class="fas" :class="expandedEvidenceRows.has(item.id) ? 'fa-chevron-up' : 'fa-chevron-down'" />
                            </div>
                            <div @click="toggleComment(item.id)" class="text-xs text-emerald-600 font-medium cursor-pointer hover:underline flex items-center gap-1">
                              Comment <i class="fas" :class="expandedCommentRows.has(item.id) ? 'fa-chevron-up' : 'fa-chevron-down'" />
                            </div>
                          </div>
                        </td>

                        <td class="px-4 py-4 text-slate-600 text-xs leading-relaxed text-center">
                          {{ item.target }}
                        </td>
                        <td class="px-4 py-4 text-center">
                          <p class="text-xs font-medium text-emerald-700 leading-relaxed">{{ item.actualResult }}</p>
                        </td>
                        <td class="px-4 py-4 text-center font-semibold text-slate-700">{{ item.weight }}</td>
                        <td class="px-4 py-4 text-center font-bold text-slate-900">{{ item.selfScore ?? '-' }}</td>

                        <td class="px-4 py-4 text-center">
                          <select v-model="item.pmScore" @click.stop
                            :disabled="Number(item.statusCode) !== KPI_STATUS.SECOND_WAITING_PM_APPROVAL"
                            class="w-14 rounded border border-slate-300 bg-white px-1 py-1 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 shadow-sm cursor-pointer text-center disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed">
                            <option :value="null">-</option>
                            <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
                          </select>
                        </td>
                      </tr>

                      <tr v-if="expandedEvidenceRows.has(item.id)" class="bg-slate-50/50">
                        <td colspan="7" class="p-0 border-b border-slate-200">
                          <div
                            class="px-8 py-4 bg-gradient-to-r from-indigo-50/30 to-transparent border-l-2 border-indigo-300">
                            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Evidences</p>
                            <div class="overflow-x-auto rounded-lg border border-indigo-100 shadow-sm bg-white">
                              <table class="w-full text-left text-xs">
                                <thead
                                  class="bg-indigo-50 text-indigo-800 uppercase tracking-wider text-[10px] font-bold">
                                  <tr>
                                    <th class="px-3 py-2.5 text-center"
                                      :class="item.calcMode !== 'sum' ? 'w-3/5' : 'w-2/3'">Content</th>
                                    <th v-if="item.calcMode !== 'sum'"
                                      class="px-3 py-2.5 text-center w-1/5 border-l border-indigo-100/60">Plan</th>
                                    <th class="px-3 py-2.5 text-center border-l border-indigo-100/60"
                                      :class="item.calcMode !== 'sum' ? 'w-1/5' : 'w-1/3'">Actual</th>
                                  </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                  <tr v-for="(ev, eIdx) in item.evidenceData" :key="eIdx"
                                    class="hover:bg-slate-50 transition-colors">
                                    <td class="px-3 py-2.5 font-medium text-slate-800 leading-snug">{{ ev.content || ev.comment }}
                                    </td>
                                    <td v-if="item.calcMode !== 'sum'"
                                      class="px-3 py-2.5 text-center text-slate-600 border-l border-slate-100">{{
                                        ev.plan }}</td>
                                    <td
                                      class="px-3 py-2.5 text-center font-bold text-emerald-600 border-l border-slate-100">
                                      {{ ev.actual }}</td>
                                  </tr>
                                  <tr v-if="(!item.evidenceData || item.evidenceData.length === 0) && !item.evidenceContent">
                                    <td :colspan="item.calcMode === 'sum' ? 2 : 3"
                                      class="px-3 py-3 text-center text-slate-400 font-medium italic">Không có dữ liệu
                                      khai báo chi tiết.</td>
                                  </tr>
                                  <tr v-if="item.evidenceContent">
                                    <td :colspan="item.calcMode === 'sum' ? 2 : 3" class="px-4 py-3 text-slate-700 whitespace-pre-wrap bg-yellow-50/30 border-t border-yellow-100">
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
                          </div>
                        </td>
                      </tr>

                      <tr v-if="expandedCommentRows.has(item.id)" class="bg-emerald-50/50">
                        <td colspan="7" class="p-0 border-b border-slate-200">
                          <div
                            class="px-8 py-4 bg-gradient-to-r from-emerald-50/30 to-transparent border-l-2 border-emerald-300">
                            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">PM's Comment</p>
                            <textarea
                              v-model="item.pmComment"
                              :disabled="!isPmPendingAssignmentStatus(item.statusCode)"
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
                    <td colspan="7" class="py-8 text-center text-sm font-medium text-slate-500">Chưa có dữ liệu KPI cho
                      mục này.</td>
                  </tr>
                </tbody>

                <tbody class="border-t-2 border-slate-200">
                  <tr class="bg-slate-50">
                    <td colspan="4" class="px-4 py-3 text-right font-bold text-slate-600 text-xs tracking-wider">
                      TỔNG CỘNG (TOTAL SCORE):
                    </td>
                    <td class="px-4 py-3 text-center font-bold text-slate-800">{{ totalWeight }} <span class="text-[10px] text-slate-400 font-normal">pts</span></td>
                    <td class="px-4 py-3 text-center font-bold text-slate-800">{{ totalWeightedSelfDisplay }}</td>
                    <td class="px-4 py-3 text-center font-bold text-slate-400">{{ totalWeightedPmDisplay }}</td>
                  </tr>
                  <tr class="bg-purple-50 border-t border-purple-100">
                    <td colspan="5" class="px-4 py-4 text-right font-bold text-purple-700 text-xs tracking-wider">
                      ĐIỂM TRUNG BÌNH (AVERAGE SCORE):
                    </td>
                    <td class="px-4 py-4 text-center text-lg font-black text-purple-700">{{ averageWeightedSelfDisplay }}</td>
                    <td class="px-4 py-4 text-center font-bold text-purple-300">{{ averageWeightedPmDisplay }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              v-if="activeTab === 'main' && !isLoadingKpis && mainKpis.length > 0 && !canEvaluateMainTab"
              class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
            >
              <i class="fas fa-info-circle mr-2 text-slate-500" />
              Chưa có KPI Member nào đang chờ PM trên tab này (không có mục 501/601). PM chỉ gửi đánh giá khi member đã nộp phần tương ứng.
            </div>
            <div
              v-if="hasPromotion && activeTab === 'promotion' && !isLoadingKpis && !canEvaluatePromotionTab"
              class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            >
              <i class="fas fa-info-circle mr-2 text-amber-600" />
              Member chưa gửi đánh giá phần <strong>Promotion KPI</strong>.
            </div>

            <div
              v-if="activeTab === 'main' && portfolioGateLoaded && !portfolioGateOpen"
              class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 mb-3"
            >
              <i class="fas fa-user-clock mr-2 text-amber-600" aria-hidden="true" />
              Chỉ gửi đánh giá KPI Member lên GM khi toàn team đã nộp kết quả cho PM. Xem tên còn thiếu ở thông báo phía trên bảng
              <strong>Team Hierarchy & Performance</strong>.
            </div>

            <div v-if="activeTab === 'main'" class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <EvaluationCommentBlock
                v-model:employeeComment="reviewCommentsMain.memberComment"
                v-model:managerComment="reviewCommentsMain.pmComment"
                employeeTitle="My Comment"
                managerTitle="Supervisor Comment"
                :employeeReadonly="true"
                :managerReadonly="!canEvaluateMainTab"
              />
            </div>
            <div v-if="activeTab === 'promotion'" class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <EvaluationCommentBlock
                v-model:employeeComment="reviewCommentsPromo.memberComment"
                v-model:managerComment="reviewCommentsPromo.pmComment"
                employeeTitle="My Comment (Promotion)"
                managerTitle="Supervisor Comment (Promotion)"
                :employeeReadonly="true"
                :managerReadonly="!canEvaluatePromotionTab"
              />
            </div>

            <div class="h-4"></div>
          </div>

          <div class="bg-white border-t border-slate-200 p-4 px-6 flex justify-end gap-3 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <button @click="$emit('close')"
              class="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors">
              Hủy
            </button>
            <button @click="sendEvaluationForActiveTab" :disabled="saving || !canSubmitPmEvaluationToGm"
              class="px-6 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-xl hover:bg-indigo-600 hover:shadow-lg transition-all flex items-center gap-2 focus:ring-4 focus:ring-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed">
              <i v-if="saving" class="fas fa-spinner fa-spin" />
              <i v-else class="fas fa-paper-plane" />
              {{ saving ? 'Đang gửi...' : 'Gửi đánh giá' }}
            </button>
          </div>

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