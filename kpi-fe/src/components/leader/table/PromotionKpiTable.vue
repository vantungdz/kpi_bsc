<script setup lang="ts">
import {computed, onMounted, ref, watch} from "vue";
import {useToast} from "vue-toastification";
import {leaderKpiService} from "@/services/modules/kpi-leader.service";
import {memberKpiService} from "@/services/modules/kpi-member.service";
import type {LeaderKpiInformationResponse} from "@/types/kpi";
import {KPI_STATUS} from "@/config/constants";
import {getSubmitButtonState, shouldCollapseKpiProcessTimelineToYearEndOnly} from "@/utils/common";
import {computeRatioPreview, parseNumericFromField, CALC_RULE_AVERAGE} from "@/utils/memberKpiHelpers";
import { extractRawInputFromApiTargetDescription } from "@/utils/kpiScoringRulesDsl";
import EvidenceDrawer from '@/components/leader/drawer/EvidenceDrawer.vue';
import { displayTargetValue, formatTargetDisplay } from "@/utils/strategicKpiTypeCodes";

const toast = useToast();

const props = defineProps<{
  year: number;
  isReadonly: boolean;
  totals?: {
    averageScore: number;
  };
}>();

// ==========================================
// 1. CORE DATA STATE
// ==========================================
const loading = ref(true);
const submitting = ref(false);
const apiData = ref<LeaderKpiInformationResponse | null>(null);
const employeeComment = ref("");
const supervisorComment = ref("");
const emit = defineEmits(['updateAverage', 'refresh-summary', 'open-edit-self-created'])

// draftMap: lưu tạm evidence/score/actualResult chưa submit lên server
type DraftEntry = { evidencesJson: string; selfScore: number | null; actualResult: string | null }
const draftMap = ref<Record<string, DraftEntry>>({})

function rowHasSelfScoreForSubmit(a: {
  assignmentId: string
  endSelfScore?: number | null
  midSelfScore?: number | null
}): boolean {
  const draft = draftMap.value[a.assignmentId]
  const v = draft?.selfScore ?? resolveSelfScoreForUi(a)
  if (v == null) return false
  if (typeof v === 'string' && !String(v).trim()) return false
  return true
}

function resolveSelfScoreForUi(assign: {
  statusCode?: number | null
  midSelfScore?: number | null
  endSelfScore?: number | null
}): number | null {
  const activePhase = String(apiData.value?.kpiCycle?.activePhase ?? '').trim().toLowerCase()
  if (activePhase === 'mid_year') {
    return assign.midSelfScore ?? assign.endSelfScore ?? null
  }
  if (activePhase === 'end_year') {
    return assign.endSelfScore ?? assign.midSelfScore ?? null
  }
  const status = Number(assign?.statusCode ?? 0)
  if (status >= 501 && status < 601) {
    return assign.midSelfScore ?? assign.endSelfScore ?? null
  }
  if (status >= 601) {
    return assign.endSelfScore ?? assign.midSelfScore ?? null
  }
  return assign.endSelfScore ?? assign.midSelfScore ?? null
}

const hasPromotionAssignments = computed(() =>
  (apiData.value?.categories ?? []).some(c => (c.assignments?.length ?? 0) > 0),
)

// ==========================================
// 2. DRAWER STATE
// ==========================================
const isDrawerOpen = ref(false);
const selectedKpi = ref<any>(null);
const drawerMode = ref<'detail' | 'feedback'>('detail')
const showDeleteConfirmModal = ref(false)
const pendingDeleteAssignment = ref<any | null>(null)

function openEvidence(assign: any, mode: 'detail' | 'feedback' = 'detail') {
  drawerMode.value = mode
  selectedKpi.value = assign;
  isDrawerOpen.value = true;
}

async function onEvidenceSaved(payload: any) {
  if (!selectedKpi.value) { isDrawerOpen.value = false; return; }
  const assignId = selectedKpi.value.assignmentId;
  if (payload?.feedbackMode) {
    try {
      await memberKpiService.submitFeedback(assignId, String(payload.feedbackComment ?? '').trim())
      selectedKpi.value.statusCode = 407
      selectedKpi.value.statusDesc = 'Chờ PM kiểm tra feedback'
      selectedKpi.value.feedbackComment = String(payload.feedbackComment ?? '').trim()
      isDrawerOpen.value = false
      emit('refresh-summary')
      toast.success('Gửi feedback thành công')
    } catch (error) {
      console.error('Failed to submit Promotion KPI feedback', error)
      toast.error('Gửi feedback thất bại')
    }
    return
  }
  try {
    const scorePayload = payload.selfScore == null ? undefined : Number(payload.selfScore)
    await memberKpiService.updateSheetItem(assignId, {
      selfScore: scorePayload,
      evidences: payload.evidencesJson,
    })
  } catch (error) {
    console.error('Failed to save Promotion KPI evidence', error)
    toast.error('Lưu evidence thất bại')
    return
  }
  delete draftMap.value[assignId]
  await fetchData()
  isDrawerOpen.value = false;
}

// ==========================================
// 3. COMPUTED (TOTALS & BUTTON STATE)
// ==========================================
const totals = computed(() => {
  let totalWeight = 0;
  let weighted = 0;
  let pmWeighted = 0;
  let pmWeightSum = 0;

  if (apiData.value?.categories) {
    apiData.value.categories.forEach((category) => {
      category.assignments.forEach((assign) => {
        const w = assign.weight || 0;
        totalWeight += w;

        const draft = draftMap.value[assign.assignmentId];
        const s = (draft?.selfScore ?? resolveSelfScoreForUi(assign)) ?? 0;
        weighted += s * w;

        const pmRaw = assign.endGmScore ?? assign.endPmScore
        if (pmRaw !== null && Number.isFinite(Number(pmRaw))) {
          const pm = Number(pmRaw)
          pmWeighted += pm * w
          pmWeightSum += w
        }
      });
    });
  }

  const averageScore = totalWeight > 0 ? weighted / totalWeight : 0;
  const averagePmScore = pmWeightSum > 0 ? pmWeighted / pmWeightSum : 0;

  return {
    totalWeight,
    weightedSelfPoints: Math.round(weighted * 10) / 10,
    weightedPmPoints: Math.round(pmWeighted * 10) / 10,
    averageScore,
    averagePmScore: Math.round(averagePmScore * 100) / 100,
  };
});

watch(
  () => totals.value.averageScore,
  (val) => emit('updateAverage', val),
  { immediate: true }
)

const currentStatusCode = computed(() => {
  const all = apiData.value?.categories?.flatMap(c => c.assignments) ?? []
  if (!all.length) return KPI_STATUS.INACTIVE
  return Math.min(...all.map(a => a.statusCode ?? KPI_STATUS.INACTIVE))
})

const hasMissingMidYearSelfScore = computed(() => {
  if (buttonState.value.actionType !== 'MID_YEAR') return false
  const all = apiData.value?.categories?.flatMap(c => c.assignments) ?? []
  return all.some(a => !rowHasSelfScoreForSubmit(a))
})

const hasMissingEndYearSelfScore = computed(() => {
  if (buttonState.value.actionType !== 'END_YEAR') return false
  const all = apiData.value?.categories?.flatMap(c => c.assignments) ?? []
  return all.some(a => !rowHasSelfScoreForSubmit(a))
})

const hasSubmitBlockingStatus = computed(() => {
  const all = apiData.value?.categories?.flatMap(c => c.assignments) ?? []
  return all.some(a => {
    const status = Number(a.statusCode ?? 0)
    return status === 407 || (status > 0 && status < 404)
  })
})
const hasRejectedAssignments = computed(() => {
  const all = apiData.value?.categories?.flatMap(c => c.assignments) ?? []
  return all.some(a => Number(a.statusCode ?? 0) === 406)
})

const isEmployeeCommentReadonly = computed(() => {
  if (props.isReadonly) return true
  const all = apiData.value?.categories?.flatMap(c => c.assignments) ?? []
  const pendingStatuses = new Set([402, 403, 501, 502, 601, 602])
  return all.some(a => pendingStatuses.has(Number(a.statusCode ?? 0)))
})

const buttonState = computed(() => {
  if (!apiData.value?.kpiCycle) {
    return {show: false, disabled: true, text: null, actionType: 'COMPLETED'};
  }
  if (hasRejectedAssignments.value) {
    return { show: true, disabled: false, text: 'Resubmit KPI', actionType: 'GOAL_SETTING' as const }
  }
  const skipMid = shouldCollapseKpiProcessTimelineToYearEndOnly(
    apiData.value.accountCreatedAt,
    apiData.value.kpiCycle.midYearEnd,
  )
  return getSubmitButtonState(apiData.value.kpiCycle, currentStatusCode.value, new Date(), {
    treatMidYearAsSkipped: skipMid,
  })
});

const submitLabel = computed(() => {
  if (buttonState.value.actionType === 'GOAL_SETTING') return 'Nộp mục tiêu KPI (Goal Setting)'
  if (buttonState.value.actionType === 'MID_YEAR') return 'Nộp KPI giữa năm (Mid-Year)'
  if (buttonState.value.actionType === 'END_YEAR') return 'Nộp KPI cuối năm (End-Year)'
  return 'Nộp đánh giá KPI'
});

// ==========================================
// 4. API FETCHING & ACTIONS
// ==========================================
async function fetchData() {
  loading.value = true;
  try {
    apiData.value = await leaderKpiService.getKpiInfo(props.year, 'PROMOTION');
    employeeComment.value = String(apiData.value?.kpiSummary?.evaluationComments ?? '')
    supervisorComment.value = String(apiData.value?.kpiSummary?.evaluationSupervisorComments ?? '')
    draftMap.value = {};
  } catch (error) {
    console.error("Lỗi khi tải dữ liệu Promotion KPI:", error);
  } finally {
    loading.value = false;
  }
}

async function submitEvaluation() {
  if (props.isReadonly || submitting.value || hasMissingMidYearSelfScore.value || hasMissingEndYearSelfScore.value) return
  submitting.value = true
  try {
    const draftEntries = Object.entries(draftMap.value)
    if (draftEntries.length > 0) {
      await Promise.all(
        draftEntries.map(([assignId, draft]) =>
          memberKpiService.updateSheetItem(assignId, {
            selfScore: draft.selfScore ?? undefined,
            evidences: draft.evidencesJson,
          })
        )
      )
    }
    await memberKpiService.submit(props.year, 'PROMOTION', employeeComment.value)
    toast.success('Nộp Promotion KPI thành công!')
    await fetchData()
    emit('refresh-summary')
  } catch (error) {
    console.error('Failed to submit Promotion KPI', error)
    toast.error('Có lỗi xảy ra khi nộp Promotion KPI.')
  } finally {
    submitting.value = false
  }
}

watch(() => props.year, fetchData);
onMounted(fetchData);

defineExpose({ submitEvaluation, buttonState, submitting })

function statusPhaseClass(code: number): string {
  if ([501, 502, 601, 602].includes(code)) return 'text-sky-700';
  if (code === 407) return 'text-violet-700';
  if (code === 406) return 'text-orange-700';
  if ([503, 603].includes(code)) return 'text-emerald-700';
  if ([402, 403, 404, 405].includes(code)) return 'text-slate-700';
  return 'text-slate-600';
}

function statusCodeForUi(assign: any): number {
  return Number(assign?.statusCode ?? 0)
}

function isOverdueEval(assign: any): boolean {
  return String(assign?.evaluationStatus ?? '').toLowerCase() === 'overdue'
}

function statusTextClass(assign: any): string {
  if (isOverdueEval(assign)) return 'text-rose-700'
  return statusPhaseClass(statusCodeForUi(assign))
}

function statusDescForUi(assign: any): string {
  if (isOverdueEval(assign)) {
    return String(assign?.evaluationState ?? '').trim() || 'Đã quá hạn tự đánh giá KPI'
  }
  return assign?.statusDesc ?? '—'
}

function statusBadgeClass(code: number): string {
  if ([501, 502, 601, 602].includes(code)) return 'border-sky-200 bg-sky-50'
  if (code === 407) return 'border-violet-200 bg-violet-50'
  if (code === 406) return 'border-rose-200 bg-rose-50'
  if ([503, 603].includes(code)) return 'border-emerald-200 bg-emerald-50'
  if ([402, 403, 404, 405].includes(code)) return 'border-slate-200 bg-slate-50'
  return 'border-slate-200 bg-slate-50'
}

function rowAlertClass(code: number): string {
  if (code === 406) return 'bg-rose-50/60'
  if (code === 407) return 'bg-violet-100/70 ring-1 ring-inset ring-violet-200'
  if ([501, 502, 601, 602].includes(code)) return 'bg-sky-50/45'
  if ([503, 603].includes(code)) return 'bg-emerald-50/35'
  if ([402, 403, 404, 405].includes(code)) return 'bg-slate-50/50'
  return ''
}

function canSendFeedback(assign: any): boolean {
  if (assign?.createdByCurrentUser === true) return false
  const status = Number(assign?.statusCode ?? 0)
  return status === 404 || status === 407
}

function canDeleteSelfCreatedVisible(assign: any): boolean {
  const status = Number(assign?.statusCode ?? 0)
  return !props.isReadonly && assign?.createdByCurrentUser === true && [402, 404, 406].includes(status)
}

function canDeleteSelfCreatedEnabled(assign: any): boolean {
  const status = Number(assign?.statusCode ?? 0)
  // 402: đã submit target_setup, chờ PM duyệt -> chỉ hiển thị disabled
  return status === 404 || status === 406
}

function shouldOpenSelfCreatedEditForm(assign: any): boolean {
  const status = Number(assign?.statusCode ?? 0)
  return (
    assign?.createdByCurrentUser === true
    && (status === 404 || status === 406)
    && String(assign?.kpiInformationId ?? '').trim().length > 0
  )
}

function sourceRowClass(assign: any): string {
  if (assign?.createdByCurrentUser === true) return 'bg-emerald-50 hover:bg-emerald-100'
  const role = String(assign?.createdByRoleCode ?? '').trim().toUpperCase()
  if (role === 'GM') return 'bg-amber-50 hover:bg-amber-100'
  if (role === 'PM') return 'bg-blue-50 hover:bg-blue-100'
  return ''
}

function rowClass(assign: any): string {
  const source = sourceRowClass(assign)
  if (source) return source
  const alert = rowAlertClass(statusCodeForUi(assign))
  if (alert) return alert
  return 'hover:bg-slate-50'
}

function scoreColorClass(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(Number(score))) return 'text-slate-400'
  const v = Number(score)
  if (v <= 2) return 'text-rose-600'
  if (v < 4) return 'text-amber-600'
  return 'text-emerald-600'
}

function parseGmComment(assign: any): string {
  try {
    const parsed = JSON.parse(String(assign?.evidences ?? '{}'))
    return String(parsed?.gmComment ?? '').trim()
  } catch {
    return ''
  }
}

function finalScoreTooltip(assign: any): string | undefined {
  const selfScore = Number(draftMap.value[assign.assignmentId]?.selfScore ?? resolveSelfScoreForUi(assign))
  const finalScore = Number(assign.endGmScore ?? assign.endPmScore)
  if (!Number.isFinite(selfScore) || !Number.isFinite(finalScore)) return undefined
  if (selfScore === finalScore) return undefined
  const gm = parseGmComment(assign)
  if (!gm) return undefined
  return `${gm}`
}

function statusTooltip(assign: any): string {
  const status = Number(assign?.statusCode ?? 0)
  const reason = String(assign?.updateReason ?? assign?.feedbackComment ?? '').trim()
  if (status === 406 && reason) return `Lý do từ chối:\n${reason}`
  return statusDescForUi(assign)
}

async function handleDeleteSelfCreated(assign: any) {
  pendingDeleteAssignment.value = assign
  showDeleteConfirmModal.value = true
}

function cancelDeleteSelfCreated() {
  showDeleteConfirmModal.value = false
  pendingDeleteAssignment.value = null
}

async function confirmDeleteSelfCreated() {
  const assignmentId = String(pendingDeleteAssignment.value?.assignmentId ?? '').trim()
  if (!assignmentId) return
  try {
    await memberKpiService.deleteSelfCreatedKpi(assignmentId)
    toast.success('Đã xóa KPI tự tạo')
    await fetchData()
    emit('refresh-summary')
  } catch (error) {
    console.error('Failed to delete self-created KPI', error)
    toast.error('Xóa KPI thất bại')
  } finally {
    cancelDeleteSelfCreated()
  }
}

// function formatTargetDisplay(assign: any): string {
//   const raw = assign?.targetValue
//   if (raw == null || raw === '') return '-'
//   const unit = String(assign?.unitName ?? '').trim()
//   return unit ? `${raw} ${unit}` : String(raw)
// }

function targetDataTooltip(assign: any): string {
  const rawRules = extractRawInputFromApiTargetDescription(assign?.targetDescription ?? '')
  if (rawRules) return `Quy tắc chấm điểm:\n${rawRules}`
  const fallback = String(assign?.targetDescription ?? '').trim()
  return fallback || formatTargetDisplay(assign)
}

function getActualResult(assign: any): string {
  const draft = draftMap.value[assign.assignmentId]
  const parsed = JSON.parse(assign.evidences ?? '{}')
  const actualValue = draft?.actualResult ?? parsed.result
  if (actualValue) return `${actualValue} ${displayTargetValue(assign, actualValue)}`
  if (draft?.actualResult) return `${displayTargetValue(assign, draft.actualResult)}`
  return parseActualResultFromEvidences(
    assign.evidences,
    assign.calculationRuleCode,
    assign.calculationTypeCode,
  )
}

function parseActualResultFromEvidences(
  evidencesJson: string | null | undefined,
  calcRule: number | null | undefined,
  calcType: number | null | undefined,
): string {
  if (!evidencesJson) return '-'
  try {
    const parsed = JSON.parse(evidencesJson)
    const records: any[] = parsed.planActualRecords ?? []
    if (records.length && calcRule === CALC_RULE_AVERAGE) {
      const values = records
        .map(r => computeRatioPreview(r.plan ?? '', r.actual ?? '', calcType))
        .filter((v): v is string => v !== null)
        .map(v => parseNumericFromField(v))
        .filter((n): n is number => n !== null)
      if (values.length) {
        const avg = values.reduce((s, x) => s + x, 0) / values.length
        return `${avg.toFixed(1)}%`
      }
    }
    const waRecords: any[] = parsed.waTimeRecords ?? []
    if (waRecords.length) {
      const totalSpent = waRecords.reduce((s, r) => s + (parseFloat(r.spent) || 0), 0)
      if (totalSpent > 0) return `${totalSpent}h`
    }
    const note: string = parsed.note ?? parsed.content ?? ''
    if (note.trim()) return note.trim().length > 40 ? note.trim().slice(0, 40) + '…' : note.trim()
  } catch { /* ignore */ }
  return '-'
}
</script>

<template>
  <div class="space-y-4">
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 relative"
         :class="isReadonly ? 'opacity-95' : ''">

      <div v-if="loading" class="absolute inset-0 bg-white/80 z-10 flex items-center justify-center backdrop-blur-sm">
        <i class="fas fa-spinner fa-spin text-blue-500 text-3xl"></i>
      </div>

      <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
        <h3 class="flex items-center gap-2 text-lg font-bold text-slate-800">
          <i class="fas fa-arrow-trend-up text-slate-400"/>
          Chi Tiết Bảng KPI Promotion
        </h3>
      </div>

      <div
        v-if="!hasPromotionAssignments && !loading"
        class="flex min-h-[220px] flex-col items-center justify-center bg-slate-50/60 px-5 py-16 text-center text-sm text-slate-500"
      >
        <i class="fas fa-medal mb-3 text-3xl text-violet-200" />
        <p class="font-medium text-slate-600">Chưa có KPI Promotion</p>
        <p class="mt-1 mx-auto max-w-md text-xs text-slate-400">
          Khi PM/Leader giao mục tiêu thăng tiến (Direct), các dòng sẽ hiển thị tại đây.
        </p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-sm">
          <thead class="border-b border-slate-200 bg-white">
          <tr class="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <th class="w-12 px-5 py-4 text-center">STT</th>
            <th class="min-w-[200px] px-5 py-4">Hạng Mục (Objectives)</th>
            <th class="min-w-[10rem] px-5 py-4 text-center">Trạng thái KPI</th>
            <th class="px-5 py-4">Chỉ Tiêu (Target)</th>
            <th class="w-24 px-5 py-4 text-center">Trọng số (W)</th>
            <th class="min-w-[8rem] px-5 py-4 text-center">
              <span class="inline-flex items-center gap-1">
                Actual Result
              </span>
            </th>
            <th class="w-28 px-5 py-4 text-center text-slate-600">Self Score</th>
            <th class="w-28 px-5 py-4 text-center">Final Score</th>
            <th class="w-28 px-5 py-4 text-right">Thao tác</th>
          </tr>
          </thead>

          <tbody class="divide-y divide-slate-100">

          <template v-for="(category, catIndex) in apiData?.categories" :key="'cat-' + catIndex">
            <tr class="bg-amber-100 border-y border-amber-100">
              <td colspan="9" class="py-2 px-5 text-xs font-bold text-amber-800 uppercase tracking-wider">
                {{ category.name }}
              </td>
            </tr>

            <tr v-for="(assign, assignIndex) in category.assignments" :key="assign.assignmentId"
                class="group transition-colors"
                :class="rowClass(assign)">

              <td class="py-4 px-5 text-center text-sm font-semibold text-slate-400">
                {{ assignIndex + 1 }}
              </td>

              <td class="py-4 px-5">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p class="text-sm font-bold text-slate-900">{{ assign.kpiCode }} {{ assign.kpiName }}</p>
                </div>
              </td>

              <td class="max-w-[11rem] px-3 py-4 text-center align-top">
                <span
                  class="inline-flex max-w-full flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-[10px] font-semibold leading-tight"
                  :class="statusBadgeClass(statusCodeForUi(assign))"
                :title="statusTooltip(assign)"
                >
                  <span class="line-clamp-3 text-center" :class="statusTextClass(assign)">{{ statusDescForUi(assign) }}</span>
                </span>
              </td>

              <td class="max-w-xs py-4 px-5 align-middle">
                <div class="inline-flex items-center gap-1">
                  <p class="text-sm font-medium text-slate-700">
                    {{ formatTargetDisplay(assign) }}
                  </p>
                  <span
                    class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-500 cursor-help"
                    :title="targetDataTooltip(assign)"
                  >
                    ?
                  </span>
                </div>
              </td>

              <td class="py-4 px-5 text-center">
                  <span
                      class="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 font-bold text-sm rounded-md border border-slate-200">
                    {{ assign.weight || 0 }}
                  </span>
              </td>

              <td class="py-4 px-5 text-center align-middle">
                <span
                  class="text-sm font-semibold leading-snug inline-block"
                  :class="getActualResult(assign) !== '-' ? 'text-emerald-700' : 'text-slate-400'"
                >
                  {{ getActualResult(assign) }}
                </span>
              </td>

              <td class="py-4 px-5 text-center align-middle">
                <span class="text-sm font-semibold leading-snug text-slate-700 inline-block">
                  <span :class="scoreColorClass((draftMap[assign.assignmentId]?.selfScore ?? resolveSelfScoreForUi(assign)))">
                    {{ (draftMap[assign.assignmentId]?.selfScore ?? resolveSelfScoreForUi(assign)) ?? 0 }}
                  </span>
                </span>
              </td>

              <td class="py-4 px-5 text-center align-middle">
                <div class="inline-flex items-center gap-1 justify-center">
                <p 
                  class="font-medium text-sm display-inline-flex items-center gap-1"
                  :class="scoreColorClass(assign.endGmScore ?? assign.endPmScore)">
                   {{ assign.endGmScore ?? assign.endPmScore ?? '' }}
                </p>
                <span
                  v-if="finalScoreTooltip(assign)"
                  class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-500 cursor-help cursor-pointer hover:bg-sky-200"
                  :title="finalScoreTooltip(assign)"
                >
                  ?
                </span>
                </div>
              </td>

              <td class="py-4 px-5 text-right align-middle">
                <div class="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    class="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-indigo-600"
                    @click.stop="shouldOpenSelfCreatedEditForm(assign) ? emit('open-edit-self-created', assign) : openEvidence(assign)"
                  >
                    <i class="fas fa-pen text-[10px]"></i>
                  </button>
                  <button
                    v-if="canSendFeedback(assign)"
                    type="button"
                    class="flex h-8 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 text-[10px] font-bold text-violet-700 shadow-sm transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-45"
                    :disabled="isReadonly || !canSendFeedback(assign)"
                    title="Mở KPI này để nhập và gửi feedback riêng"
                    @click.stop="openEvidence(assign, 'feedback')"
                  >
                    <i class="fas fa-message text-[10px]"></i> Feedback
                  </button>
                <button
                  v-if="canDeleteSelfCreatedVisible(assign)"
                  type="button"
                  class="flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-[10px] font-bold text-rose-700 shadow-sm transition-colors hover:bg-rose-100 cursor-pointer"
                  :class="!canDeleteSelfCreatedEnabled(assign) ? 'cursor-not-allowed opacity-45 hover:bg-rose-50' : ''"
                  :disabled="!canDeleteSelfCreatedEnabled(assign)"
                  :title="canDeleteSelfCreatedEnabled(assign) ? 'Xóa KPI tự tạo' : 'KPI đã submit đầu năm, không thể xóa'"
                  @click.stop="handleDeleteSelfCreated(assign)"
                >
                  <i class="fas fa-trash text-[10px]"></i>
                </button>
                </div>
              </td>
            </tr>
          </template>
          </tbody>

          <tfoot class="bg-slate-100/80 border-t-2 border-slate-200 font-bold">
          <tr>
            <td colspan="3" class="py-4 px-5 text-right text-slate-700 uppercase text-xs tracking-wider">
              Tổng cộng (Total score):
            </td>
            <td class="py-4 px-5 text-center">
                <span class="text-sm text-slate-800">
                  {{ totals.totalWeight % 1 === 0 ? totals.totalWeight.toFixed(0) : totals.totalWeight.toFixed(1) }}
                </span>
              <span class="text-xs text-slate-500 font-medium ml-1">pts</span>
            </td>
            <td class="py-4 px-5 text-center text-xs font-medium text-slate-400">-</td>
            <td class="bg-sky-50/90 py-4 px-5 text-center text-sm text-slate-700">
              {{ totals.weightedSelfPoints }}
            </td>
            <td class="py-4 px-5 text-center">
              <span class="text-sm text-slate-800">{{ totals.weightedPmPoints }}</span>
            </td>
            <td class="py-4 px-5"></td>
          </tr>
          <tr class="bg-violet-50/50 border-t border-slate-200">
            <td colspan="3" class="py-4 px-5 text-right text-violet-800 uppercase text-xs tracking-wider">
              Điểm trung bình (Average score):
            </td>
            <td class="py-4 px-5"></td>
            <td class="py-4 px-5 text-center text-xs font-medium text-slate-400">-</td>
            <td class="bg-sky-50/90 py-4 px-5 text-center text-sm text-slate-700">
              {{ totals.averageScore.toFixed(2) }}
            </td>
            <td class="py-4 px-5 text-center bg-violet-100/80">
                <span class="text-lg text-violet-700 font-extrabold">
                  {{ totals.averagePmScore.toFixed(2) }}
                </span>
            </td>
            <td class="py-4 px-5"></td>
          </tr>
          </tfoot>
        </table>
      </div>

      <div v-if="hasPromotionAssignments && !loading" class="p-6 border-t border-slate-200 bg-slate-50/30">
        <h4 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <i class="fas fa-comments text-blue-600"/>
          Comment of employee and supervisor
        </h4>
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Employee's comment
              </label>
              <textarea v-model="employeeComment" rows="4" placeholder="Nhập ý kiến của bạn..."
                        class="w-full resize-none p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none shadow-sm"
                        :class="{ 'bg-slate-100 text-slate-500': isEmployeeCommentReadonly }"
                        :readonly="isEmployeeCommentReadonly"/>
            </div>
          </div>
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Supervisor Comment
              </label>
              <textarea v-model="supervisorComment" rows="4"
                        placeholder="Supervisor sẽ nhập ý kiến tại đây..."
                        class="w-full resize-none p-3 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 outline-none"
                        readonly/>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!isReadonly && hasPromotionAssignments && !loading" class="bg-slate-50 p-4 border-t border-slate-200 flex flex-col items-center gap-2">
        <button
          v-if="buttonState.show"
          type="button"
          :disabled="buttonState.disabled || submitting || (!hasRejectedAssignments && hasMissingMidYearSelfScore) || (!hasRejectedAssignments && hasMissingEndYearSelfScore) || (!hasRejectedAssignments && hasSubmitBlockingStatus)"
          class="px-4 py-2 bg-violet-700 border border-transparent rounded-lg text-sm font-semibold text-white shadow-sm hover:bg-violet-800 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          @click="submitEvaluation"
        >
          <i v-if="submitting" class="fas fa-spinner fa-spin text-xs" />
          <i v-else class="fas fa-paper-plane text-xs" />
          {{ submitting ? 'Đang xử lý...' : submitLabel }}
        </button>
      </div>

      <div v-if="isReadonly && hasPromotionAssignments && !loading" class="bg-slate-50 p-4 border-t border-slate-200 flex flex-col items-center gap-2">
        <div class="text-sm text-slate-500 font-medium">
          Dữ liệu năm {{ year }} chỉ để xem
        </div>
      </div>

    </div>

    <EvidenceDrawer
        :open="isDrawerOpen"
        :item="selectedKpi"
        :mode="drawerMode"
        @close="isDrawerOpen = false"
        @save="onEvidenceSaved"
    />

    <Teleport to="body">
      <div
        v-if="showDeleteConfirmModal"
        class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4"
        role="dialog"
        aria-modal="true"
      >
        <div class="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div class="border-b border-slate-100 px-5 py-4">
            <h3 class="text-base font-bold text-slate-800">Xác nhận xóa KPI</h3>
            <p class="mt-1 text-xs text-slate-500">KPI tự tạo sẽ bị xóa khỏi danh sách hiện tại.</p>
          </div>
          <div class="px-5 py-4 text-sm text-slate-700">
            <p>
              Bạn có chắc muốn xóa KPI:
              <span class="font-semibold text-slate-900">
                {{ pendingDeleteAssignment?.kpiCode }} {{ pendingDeleteAssignment?.kpiName }}
              </span>
              ?
            </p>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              @click="cancelDeleteSelfCreated"
            >
              Hủy
            </button>
            <button
              type="button"
              class="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              @click="confirmDeleteSelfCreated"
            >
              Xóa KPI
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>