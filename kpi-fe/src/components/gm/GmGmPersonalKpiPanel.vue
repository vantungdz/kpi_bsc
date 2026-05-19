<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { useToast } from 'vue-toastification'
import { GM_BSC_LABELS, GM_BSC_ORDER, normalizeGmBscPerspective } from '@/utils/gm-bsc-diagnostics'
import type { GmBscPerspective, GmPersonalKpiRowMock } from '@/types/gm-workspace'
import type { KpiSheet, LeaderKpiAssignment } from '@/types/kpi'
import type { UpdateMemberSheetItemBody } from '@/services/modules/kpi-member.service'
import { memberKpiService } from '@/services/modules/kpi-member.service'
import { pmKpiService } from '@/services/modules/kpi-pm.service'
import { gmKpiService } from '@/services/modules/kpi-gm.service'
import { KPI_STATUS } from '@/config/constants'
import GmStrategicKpiTypeTag from '@/components/gm/GmStrategicKpiTypeTag.vue'
import { fileService } from '@/services/modules/file.service'
import EvaluationEvidenceDrawer from '@/components/evaluation/EvaluationEvidenceDrawer.vue'
import { kpiCycleService } from '@/services/shared/kpi-cycle.service'
import type { KpiCycleResponse } from '@/types/shared/kpi-cycle.type'
import { getPmPortfolioSubmitButtonState } from '@/utils/common'
import { formatKpiTargetWithUnit } from '@/utils/kpiUnitCodes'

const props = withDefaults(
  defineProps<{
    /** Năm đánh giá (đồng bộ dropdown header GM). */
    yearId: string
    /** UUID `kpi_cycles.id` — bulk Accept KPI (404→405). */
    cycleId?: string
    /** Dữ liệu từ `GET /kpi/leader/kpi-info` (INDIVIDUAL + PROMOTION) sau khi map. */
    rows: GmPersonalKpiRowMock[]
    /** Đang gọi API (hai loại KPI cá nhân). */
    loading?: boolean
    /** `assignmentId` → bản ghi leader (mở drawer minh chứng). */
    assignmentsById?: Record<string, LeaderKpiAssignment>
  }>(),
  { loading: false, assignmentsById: () => ({}), cycleId: '' },
)

const emit = defineEmits<{
  'sheet-saved': []
}>()


const toast = useToast()
const gmPersonalEvidenceOpen = ref(false)
const gmPersonalEvidenceAssign = shallowRef<LeaderKpiAssignment | null>(null)
const acceptKpisLoading = ref(false)
const submitGmPersonalEvalLoading = ref(false)
const invalidRowIds = ref<Set<string>>(new Set())
const personalTableTab = ref<'personal' | 'promotion'>('personal')

const currentCycleInfo = ref<KpiCycleResponse | null>(null)

import { watch } from 'vue'
watch(
  () => props.yearId,
  async (year) => {
    const expectedYearId = String(year ?? '').trim()
    if (!expectedYearId) {
      currentCycleInfo.value = null
      return
    }
    const y = Number.parseInt(expectedYearId, 10)
    if (!Number.isFinite(y)) {
      currentCycleInfo.value = null
      return
    }
    try {
      const res = await kpiCycleService.getKpiCycleByYear(y)
      if (String(props.yearId ?? '').trim() !== expectedYearId) return
      currentCycleInfo.value = res ?? null
    } catch {
      if (String(props.yearId ?? '').trim() !== expectedYearId) return
      currentCycleInfo.value = null
    }
  },
  { immediate: true },
)

const submitButtonState = computed(() => {
  if (!currentCycleInfo.value) return { disabled: true, reason: 'Loading or no evaluation cycle info.' }
  const acceptedRow = scopedRows.value.find(r => Number(r.assignmentStatusCode) === KPI_STATUS.ACCEPTED || Number(r.assignmentStatusCode) === KPI_STATUS.FIRST_COMPLETED)
  if (!acceptedRow) return { disabled: false, reason: '' }
  return getPmPortfolioSubmitButtonState(currentCycleInfo.value, Number(acceptedRow.assignmentStatusCode))
})

const personalRows = computed(() =>
  props.rows.filter((row) => row.kpiType === 'individual' || row.kpiType === 'cascading'),
)

const promotionRows = computed(() =>
  props.rows.filter((row) => row.kpiType === 'promotion'),
)

const scopedRows = computed(() =>
  personalTableTab.value === 'promotion' ? promotionRows.value : personalRows.value,
)

const personalPendingAcceptanceCount = computed(() =>
  personalRows.value.filter((row) => Number(row.assignmentStatusCode) === KPI_STATUS.PENDING_ACCEPTANCE).length,
)

const promotionPendingAcceptanceCount = computed(() =>
  promotionRows.value.filter((row) => Number(row.assignmentStatusCode) === KPI_STATUS.PENDING_ACCEPTANCE).length,
)

const hasAcceptedKpis = computed(() =>
  scopedRows.value.some((r) => Number(r.assignmentStatusCode) === KPI_STATUS.ACCEPTED || Number(r.assignmentStatusCode) === KPI_STATUS.FIRST_COMPLETED),
)

const cycleIdTrimmed = computed(() => String(props.cycleId ?? '').trim())

const hasPendingAcceptanceKpis = computed(() =>
  scopedRows.value.some((r) => Number(r.assignmentStatusCode) === KPI_STATUS.PENDING_ACCEPTANCE),
)

function sheetUpdateErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const ax = err as { response?: { data?: { message?: string | null } } }
    const m = ax.response?.data?.message
    if (m != null && String(m).trim() !== '') return String(m)
  }
  if (err instanceof Error) return err.message
  return 'Could not save — please try again'
}

async function submitGmPersonalEvaluation() {
  const cid = cycleIdTrimmed.value
  if (!cid) {
    toast.error('No evaluation cycle selected.')
    return
  }
  if (scopedRows.value.length === 0) return

  // Validate: tất cả KPI status 405 hoặc 503 phải có actual và điểm
  const acceptedRows = scopedRows.value.filter(
    (r) => Number(r.assignmentStatusCode) === KPI_STATUS.ACCEPTED || Number(r.assignmentStatusCode) === KPI_STATUS.FIRST_COMPLETED,
  )
  const missingRows = acceptedRows.filter((r) => {
    const act = r.actual == null ? '' : String(r.actual).trim()
    const score = r.finalScore == null ? '' : String(r.finalScore).trim()
    const hasActual = act !== '' && act !== '-' && act !== '—'
    const hasScore = score !== '' && score !== '-' && score !== '—'
    return !hasActual || !hasScore
  })
  if (missingRows.length > 0) {
    invalidRowIds.value = new Set(missingRows.map((r) => String(r.id)))
    toast.error(
      `${missingRows.length} KPIs are missing Actual or score`,
    )
    return
  }
  invalidRowIds.value = new Set()

  submitGmPersonalEvalLoading.value = true
  try {
    await gmKpiService.submitPersonalEvaluation(cid, personalTableTab.value === 'promotion')
    toast.success('Evaluation submitted — KPI statuses updated for this checkpoint (mid-year / year-end).')
    emit('sheet-saved')
  } catch (err: unknown) {
    toast.error(sheetUpdateErrorMessage(err))
  } finally {
    submitGmPersonalEvalLoading.value = false
  }
}

async function acceptPendingKpis() {
  const cid = cycleIdTrimmed.value
  if (!cid) {
    toast.error('No evaluation cycle selected.')
    return
  }
  if (!hasPendingAcceptanceKpis.value) return
  acceptKpisLoading.value = true
  try {
    await pmKpiService.bulkUpdateKpiStatus({
      cycleId: cid,
      statusCode: KPI_STATUS.ACCEPTED,
      promotion: personalTableTab.value === 'promotion',
      onlyFromStatusCode: KPI_STATUS.PENDING_ACCEPTANCE,
    })
    toast.success('KPIs accepted.')
    emit('sheet-saved')
  } catch (err: unknown) {
    toast.error(sheetUpdateErrorMessage(err))
  } finally {
    acceptKpisLoading.value = false
  }
}

function openGmPersonalEvidence(row: GmPersonalKpiRowMock) {
  const a = props.assignmentsById[row.id]
  if (!a) {
    toast.warning('KPI details not found — refresh or try again later.')
    return
  }
  gmPersonalEvidenceAssign.value = a
  gmPersonalEvidenceOpen.value = true
}

function closeGmPersonalEvidence() {
  gmPersonalEvidenceOpen.value = false
  gmPersonalEvidenceAssign.value = null
}

/** Map `LeaderKpiAssignment` → `item` của `EvaluationEvidenceDrawer` (cùng shape PM portfolio). */
function leaderAssignmentToEvaluationDrawerItem(a: LeaderKpiAssignment): Record<string, unknown> {
  const tv = a.targetValue
  let target = '-'
  if (tv != null && String(tv).trim() !== '') {
    target = String(tv)
  } else {
    const td = String(a.targetDescription ?? '').trim()
    if (td && !td.startsWith('{')) {
      target = td.length > 160 ? `${td.slice(0, 157)}…` : td
    }
  }
  return {
    id: a.assignmentId,
    code: a.kpiCode,
    name: a.kpiName,
    target,
    weight: a.weight,
    group: '',
    calculationRuleCode: a.calculationRuleCode,
    calculationTypeCode: a.calculationTypeCode,
    /** JSON quy tắc chấm điểm GM — preview Self score trong drawer. */
    targetDescription: a.targetDescription ?? '',
    selfScore: a.endSelfScore ?? a.midSelfScore ?? null,
    actualResult: a.evidences != null ? String(a.evidences) : '',
  }
}

const gmPersonalEvidenceDrawerItem = computed((): Record<string, unknown> | null => {
  const a = gmPersonalEvidenceAssign.value
  if (!a) return null
  return leaderAssignmentToEvaluationDrawerItem(a)
})

async function onGmPersonalEvidenceSaved(data: {
  id?: string
  actualResult: string
  selfScore: number | null
  evidenceNote?: string
  files?: { id: string; file: File }[]
  urls?: { id: string; url: string; name?: string }[]
}) {
  const id = String(data.id ?? gmPersonalEvidenceAssign.value?.assignmentId ?? '').trim()
  if (!id) {
    closeGmPersonalEvidence()
    return
  }

  const finalUrls = [...(data.urls ?? [])]
  if (data.files && data.files.length > 0) {
    try {
      toast.info('Uploading file…')
      for (const item of data.files) {
        const res = await fileService.uploadFile(item.file)
        finalUrls.push({ id: Math.random().toString(), url: res.url, name: res.name })
      }
    } catch (e) {
      toast.error('Upload failed')
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
    } catch (e) { }
  }
  if (finalUrls.length > 0) {
    delete evJson.urls
    delete evJson.evd
    evJson.files = finalUrls.map(u => ({ url: u.url, name: u.name || '' }))
  }

  const finalActualResult = Object.keys(evJson).length > 0 ? JSON.stringify(evJson) : ''
  if (finalActualResult !== '') body.evidences = finalActualResult

  if (Object.keys(body).length === 0) {
    toast.info('No changes to save.')
    closeGmPersonalEvidence()
    return
  }

  try {
    const sheet = (await memberKpiService.updateSheetItem(id, body)) as KpiSheet
    toast.success('Evidence and self-assessment score saved.')
    const updated = sheet?.items?.find((it) => String(it.id) === id)
    const a = gmPersonalEvidenceAssign.value
    if (a && updated != null) {
      if (typeof finalActualResult === 'string' && finalActualResult.trim() !== '') {
        a.evidences = finalActualResult
      }
      if (updated.selfScore != null) {
        const sc = updated.selfScore
        if (sheet.phase === 'mid_year') {
          a.midSelfScore = sc
        } else {
          a.endSelfScore = sc
        }
      }
    }
    // Xoá highlight lỗi khi row đã được lưu
    if (invalidRowIds.value.has(id)) {
      const s = new Set(invalidRowIds.value)
      s.delete(id)
      invalidRowIds.value = s
    }
    closeGmPersonalEvidence()
    emit('sheet-saved')
  } catch (err: unknown) {
    toast.error(sheetUpdateErrorMessage(err))
  }
}

const yearLabel = computed(() => props.yearId.trim() || String(new Date().getFullYear()))

interface BscGroup {
  perspective: GmBscPerspective
  label: string
  rows: { row: GmPersonalKpiRowMock; stt: number }[]
}

const groupedByBsc = computed((): BscGroup[] => {
  const m = new Map<GmBscPerspective, GmPersonalKpiRowMock[]>()
  for (const id of GM_BSC_ORDER) m.set(id, [])
  for (const r of scopedRows.value) {
    m.get(normalizeGmBscPerspective(r.diagnosticsFallbackGroup))!.push(r)
  }
  let stt = 0
  const out: BscGroup[] = []
  for (const perspective of GM_BSC_ORDER) {
    const list = m.get(perspective)!
    if (list.length === 0) continue
    out.push({
      perspective,
      label: GM_BSC_LABELS[perspective],
      rows: list.map((row) => ({ row, stt: ++stt })),
    })
  }
  return out
})

const expandedBscSections = ref<Set<GmBscPerspective>>(new Set(GM_BSC_ORDER))

function toggleBscSection(p: GmBscPerspective) {
  const s = new Set(expandedBscSections.value)
  if (s.has(p)) s.delete(p)
  else s.add(p)
  expandedBscSections.value = s
}

/** Tooltip: mã ASM + `sys_status_codes.name` (API leader kpi-info). */
function assignmentStatusTooltip(row: GmPersonalKpiRowMock): string | undefined {
  const parts: string[] = []
  if (row.assignmentStatusCode != null) parts.push(`Code: ${row.assignmentStatusCode}`)
  if (row.assignmentStatusName) parts.push(row.assignmentStatusName)
  return parts.length ? parts.join(' · ') : undefined
}

/** Hiển thị ô số giống mock thiết kế: trống → dấu «-». */
function displayTableCell(v: string | number | null | undefined): string {
  if (v == null) return '-'
  const s = String(v).trim()
  if (s === '' || s === '—') return '-'
  return s
}

function displayTargetWithUnit(row: GmPersonalKpiRowMock): string {
  return formatKpiTargetWithUnit(displayTableCell(row.target), row.unitCode)
}
</script>

<template>
  <div class="animate-fade-in">
    <!-- Tiêu đề trang — đồng bộ mock a.ts / screenshot -->
    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700"
          aria-hidden="true">
          <i class="fas fa-bullseye text-lg" />
        </div>
        <h1 class="text-lg font-bold uppercase tracking-wide text-slate-800">Personal KPI (GM)</h1>
      </div>
      <div v-if="hasPendingAcceptanceKpis && cycleIdTrimmed"
        class="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <button type="button"
          class="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 shadow-sm transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading || acceptKpisLoading" @click="acceptPendingKpis">
          <i class="fas text-[11px]" :class="acceptKpisLoading ? 'fa-spinner fa-spin' : 'fa-check'"
            aria-hidden="true" />
          {{ acceptKpisLoading ? 'Processing…' : 'Accept KPIs' }}
        </button>
      </div>
    </div>

    <div class="flex gap-2 border-b border-slate-200 bg-white px-4 pt-3 sm:px-5">
      <button
        type="button"
        class="relative rounded-t-lg border px-4 py-2 text-xs font-bold transition-colors"
        :class="
          personalTableTab === 'personal'
            ? 'border-slate-200 border-b-white bg-white text-blue-700'
            : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
        "
        @click="personalTableTab = 'personal'"
      >
        KPI Personal
        <span
          v-if="personalPendingAcceptanceCount > 0"
          class="ml-2 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white"
        >{{ personalPendingAcceptanceCount }}</span>
      </button>
      <button
        type="button"
        class="relative rounded-t-lg border px-4 py-2 text-xs font-bold transition-colors"
        :class="
          personalTableTab === 'promotion'
            ? 'border-slate-200 border-b-white bg-white text-purple-700'
            : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
        "
        @click="personalTableTab = 'promotion'"
      >
        KPI Promotion
        <span
          v-if="promotionPendingAcceptanceCount > 0"
          class="ml-2 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white"
        >{{ promotionPendingAcceptanceCount }}</span>
      </button>
    </div>

    <div v-if="loading"
      class="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-12 text-sm font-medium text-slate-600 shadow-sm"
      role="status">
      <i class="fas fa-spinner fa-spin text-indigo-500" aria-hidden="true" />
      Loading personal KPIs (Individual + Promotion)…
    </div>

    <div v-else-if="scopedRows.length === 0"
      class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center">
      <p class="text-sm font-semibold text-slate-700">
        {{ personalTableTab === 'promotion' ? 'No promotion KPI data yet' : 'No personal KPI data yet' }}
      </p>
    </div>

    <div v-else class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
        <h2 class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <i class="fas fa-file-alt w-4 shrink-0 text-center text-base text-slate-400" aria-hidden="true" />
          Personal KPI table
        </h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[52rem] border-collapse text-left text-sm text-slate-800">
          <thead class="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th class="w-16 px-6 py-4 text-center">#</th>
              <th class="px-6 py-4">Objective</th>
              <th class="px-6 py-4 text-center">Target</th>
              <th class="px-6 py-4 text-center">Weight</th>
              <th class="px-6 py-4 text-center">Actual</th>
              <th class="px-6 py-4 text-center">Score</th>
              <th class="px-6 py-4 text-center">Status</th>
              <th class="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <template v-for="group in groupedByBsc" :key="'pk-bsc-' + group.perspective">
              <tr class="bg-slate-50/50 transition-colors hover:bg-slate-50">
                <td colspan="8" class="p-0">
                  <button type="button"
                    class="flex w-full cursor-pointer items-center gap-3 px-6 py-3 text-left transition-colors"
                    :aria-expanded="expandedBscSections.has(group.perspective)"
                    :aria-controls="`gm-personal-bsc-${group.perspective}`"
                    @click="toggleBscSection(group.perspective)">
                    <i class="fas fa-chevron-down w-4 shrink-0 text-center text-xs text-slate-400 transition-transform duration-200 motion-reduce:transition-none"
                      :class="expandedBscSections.has(group.perspective) ? '' : '-rotate-90'" aria-hidden="true" />
                    <span class="font-bold text-slate-700">{{ group.label }}</span>
                    <span class="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">{{
                      group.rows.length }} KPI</span>
                  </button>
                </td>
              </tr>
              <template v-if="expandedBscSections.has(group.perspective)">
                <tr v-for="({ row, stt }, ri) in group.rows" :key="row.id"
                  :id="ri === 0 ? `gm-personal-bsc-${group.perspective}` : undefined"
                  class="align-top transition-colors"
                  :class="invalidRowIds.has(row.id) ? 'bg-red-50 ring-1 ring-inset ring-red-200' : 'hover:bg-indigo-50/30'">
                  <td class="px-6 py-4 text-center text-sm font-medium text-slate-500">
                    {{ stt }}
                  </td>
                  <td class="min-w-0 px-6 py-4">
                    <div class="flex flex-wrap items-center gap-3">
                      <span class="font-medium leading-snug text-slate-900">{{ row.objective }}</span>
                      <GmStrategicKpiTypeTag :type="row.kpiType" size="sm" class="shrink-0" />
                    </div>
                  </td>
                  <td class="min-w-0 px-6 py-4 text-center text-sm font-medium leading-snug text-slate-600">
                    <span class="break-words">{{ displayTargetWithUnit(row) }}</span>
                  </td>
                  <td class="px-6 py-4 text-center text-sm text-slate-600">{{ row.weight }}%</td>
                  <td class="px-6 py-4 text-center text-sm font-semibold tabular-nums text-slate-900">
                    {{ displayTableCell(row.actual) }}
                  </td>
                  <td class="px-6 py-4 text-center text-sm font-bold tabular-nums text-indigo-600">
                    {{ displayTableCell(row.finalScore) }}
                  </td>
                  <td class="min-w-0 px-6 py-4 text-center">
                    <span
                      class="inline-flex max-w-full items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                      :title="assignmentStatusTooltip(row)">
                      <span class="mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                      <span class="line-clamp-2 text-center leading-snug">{{
                        row.assignmentStatusDisplay
                      }}</span>
                    </span>
                  </td>
                  <td class="px-6 py-4 text-right">
                    <button v-if="Number(row.assignmentStatusCode) === KPI_STATUS.ACCEPTED || Number(row.assignmentStatusCode) === KPI_STATUS.FIRST_COMPLETED" type="button"
                      class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-all hover:border-indigo-300 hover:bg-slate-50 hover:text-indigo-600"
                      :class="invalidRowIds.has(row.id) ? 'border-red-300 text-red-600 hover:border-red-400 hover:bg-red-50 hover:text-red-700' : ''"
                      @click.stop="openGmPersonalEvidence(row)">
                      <i class="fas fa-exclamation-circle text-[13px]" v-if="invalidRowIds.has(row.id)"
                        aria-hidden="true" />
                      <i class="fas fa-eye text-[13px]" v-else aria-hidden="true" />
                      Evaluate
                    </button>
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>
      <div v-if="hasAcceptedKpis" class="flex justify-end border-t border-slate-100 bg-slate-50/50 px-6 py-5">
        <button type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading || !cycleIdTrimmed || submitGmPersonalEvalLoading || submitButtonState.disabled" @click="submitGmPersonalEvaluation">
          <i class="fas text-sm" :class="submitGmPersonalEvalLoading ? 'fa-spinner fa-spin' : 'fa-paper-plane'"
            aria-hidden="true" />
          {{ submitGmPersonalEvalLoading ? 'Sending…' : 'Submit evaluation' }}
        </button>
      </div>
    </div>

    <EvaluationEvidenceDrawer :open="gmPersonalEvidenceOpen" :item="gmPersonalEvidenceDrawerItem"
      self-score-footer-readonly @close="closeGmPersonalEvidence" @save="onGmPersonalEvidenceSaved" />
  </div>
</template>
