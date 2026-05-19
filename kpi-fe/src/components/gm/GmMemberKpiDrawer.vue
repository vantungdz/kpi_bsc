<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  GmMemberKpiDrawerProfile,
  GmModalKpiItemMock,
  GmPmKpiRolloutPayload,
  GmStrategicKpiKind,
} from '@/types/gm-workspace'
import type { GmEvidenceTable } from '@/types/gm-employee-evaluation'
import { isEvidenceImageUrl, isRecordStyleCalcRule, normalizeEvidenceHref } from '@/utils/memberKpiHelpers'

const props = withDefaults(
  defineProps<{
    open: boolean
    /** Chế độ cũ: một nhân viên + nhiều KPI (master list). */
    member: GmMemberKpiDrawerProfile | null
    items: GmModalKpiItemMock[]
    /** Chế độ diagnostics: PM + một KPI, mỗi dòng là member + đóng góp KPI đó. */
    pmKpiRollout?: GmPmKpiRolloutPayload | null
  }>(),
  { items: () => [], pmKpiRollout: null },
)

const emit = defineEmits<{
  close: []
  remind: [item: GmModalKpiItemMock]
}>()

function onRemind(item: GmModalKpiItemMock) {
  emit('remind', item)
}

const SECTION_ORDER: GmStrategicKpiKind[] = ['cascading', 'individual', 'promotion']

const SECTION_UI: Record<
  GmStrategicKpiKind,
  { title: string; dotClass: string; badgeDoneClass: string; badgeWarnClass: string }
> = {
  cascading: {
    title: 'Cascading KPI',
    dotClass: 'bg-blue-500',
    badgeDoneClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    badgeWarnClass: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  individual: {
    title: 'Individual KPI',
    dotClass: 'bg-violet-500',
    badgeDoneClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    badgeWarnClass: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  promotion: {
    title: 'Promotion KPI',
    dotClass: 'bg-emerald-500',
    badgeDoneClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    badgeWarnClass: 'border-rose-200 bg-rose-50 text-rose-700',
  },
}

function isMissing(item: GmModalKpiItemMock) {
  return item.submissionStatus === 'missing_data'
}

const showRolloutPanel = computed(
  () => !!(props.open && props.pmKpiRollout && props.pmKpiRollout.rows.length > 0),
)

const showLegacyPanel = computed(() => !!props.open && !!props.member && !props.pmKpiRollout)

const groupedSections = computed(() => {
  if (!props.member || props.pmKpiRollout) return []
  const map = new Map<GmStrategicKpiKind, GmModalKpiItemMock[]>()
  for (const k of SECTION_ORDER) map.set(k, [])
  for (const item of props.items) {
    map.get(item.kpiType)?.push(item)
  }
  return SECTION_ORDER.map((kind) => {
    const items = map.get(kind) ?? []
    if (!items.length) return null
    const total = items.length
    const missing = items.filter(isMissing).length
    const complete = total - missing
    const done = missing === 0
    const meta = SECTION_UI[kind]
    return {
      kind,
      items,
      meta,
      sectionBadgeText: done ? `Complete ${complete}/${total}` : `Missing ${missing}/${total}`,
      sectionBadgeClass: done ? meta.badgeDoneClass : meta.badgeWarnClass,
    }
  }).filter(Boolean) as {
    kind: GmStrategicKpiKind
    items: GmModalKpiItemMock[]
    meta: (typeof SECTION_UI)['cascading']
    sectionBadgeText: string
    sectionBadgeClass: string
  }[]
})

function targetLine(item: GmModalKpiItemMock) {
  if (item.targetSummary?.trim()) return item.targetSummary
  const w = item.weight
  const wPart =
    typeof w === 'number' && Number.isFinite(w) ? ` (W: ${w}%)` : ''
  return `Target: ${item.target}${wPart}`
}

function statusBlock(item: GmModalKpiItemMock) {
  if (item.submissionStatus === 'submitted_with_file') {
    return { kind: 'ok' as const, label: 'Submitted (with file)', icon: 'fas fa-check-circle' }
  }
  if (item.submissionStatus === 'submitted') {
    return { kind: 'ok' as const, label: 'Submitted', icon: 'fas fa-check-circle' }
  }
  return { kind: 'missing' as const, label: 'Missing data', icon: 'fas fa-exclamation-circle' }
}

function asmStatusMeta(item: GmModalKpiItemMock): { label: string; badgeClass: string } {
  const code = item.assignmentStatusCode
  if (code == null) {
    return {
      label: '—',
      badgeClass: 'border-slate-200 bg-slate-100 text-slate-600',
    }
  }
  if (code === 403 || code === 502 || code === 602) {
    return {
      label:
        code === 403
          ? 'Pending GM Approval'
          : code === 502
            ? 'Pending GM Approval (Mid-Year)'
            : 'Pending GM Approval (Final)',
      badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
    }
  }
  if (code === 402 || code === 404 || code === 501 || code === 601) {
    return {
      label:
        code === 402
          ? 'Pending PM Approval'
          : code === 404
            ? 'Pending Acceptance'
            : code === 501
              ? 'Pending PM Approval (Mid-Year)'
              : 'Pending PM Approval (Final)',
      badgeClass: 'border-amber-200 bg-amber-50 text-amber-900',
    }
  }
  if (code === 405 || code === 503 || code === 603) {
    return {
      label: code === 405 ? 'In progress' : code === 503 ? 'Completed (Mid-Year)' : 'Complete',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    }
  }
  if (code === 406) {
    return {
      label: 'Rejected',
      badgeClass: 'border-slate-300 bg-slate-100 text-slate-700',
    }
  }
  if (code === 401) {
    return {
      label: 'New KPI',
      badgeClass: 'border-slate-200 bg-slate-100 text-slate-600',
    }
  }
  return {
    label: `Processing Feedback`,
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-600',
  }
}

function rolloutEvidenceTable(item: GmModalKpiItemMock): GmEvidenceTable | null {
  const t = item.rolloutEvidence
  if (!t?.rows?.length) return null
  return t
}

function isEvidenceCellHttpUrl(raw: unknown): boolean {
  const s = String(raw ?? '').trim()
  return /^https?:\/\//i.test(s)
}

function usesPmStyleEvidence(item: GmModalKpiItemMock): boolean {
  return (
    item.evidenceData !== undefined ||
    item.evidenceContent !== undefined ||
    item.evidenceAttachments !== undefined
  )
}

function rolloutEvidenceColspan(item: GmModalKpiItemMock): number {
  return isRecordStyleCalcRule(item.calcRuleCode) ? 2 : 3
}

function evidenceText(raw: unknown): string {
  const s = String(raw ?? '').trim()
  return s || '—'
}

/** % hoàn thành 0–100: từ actualProgressPct hoặc chuỗi Actual kiểu «10 (100%)» / «100%». */
function rolloutProgressPctNumeric(item: GmModalKpiItemMock): number | null {
  const fromPctStr = (s: string): number | null => {
    const m = s.trim().match(/(\d+(?:\.\d+)?)\s*%/)
    if (!m) return null
    const n = parseFloat(m[1])
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null
  }
  const ap = item.actualProgressPct
  if (ap != null && String(ap).trim() !== '') {
    const n = fromPctStr(String(ap))
    if (n != null) return n
  }
  const act = String(item.actual ?? '')
  const paren = act.match(/\(\s*(\d+(?:\.\d+)?)\s*%\s*\)/)
  if (paren) {
    const n = parseFloat(paren[1])
    if (Number.isFinite(n)) return Math.min(100, Math.max(0, n))
  }
  return fromPctStr(act)
}

/** Đã có % trong cột Actual → không lặp lại hàng «Tỷ lệ Actual» riêng. */
function rolloutActualProgressRedundant(item: GmModalKpiItemMock): boolean {
  const pct = String(item.actualProgressPct ?? '')
    .trim()
    .replace(/\s+/g, '')
  const act = String(item.actual ?? '')
    .trim()
    .replace(/\s+/g, '')
  if (!pct || !act) return false
  return act.includes(pct)
}

function rolloutProgressPctRounded(item: GmModalKpiItemMock): number | null {
  const n = rolloutProgressPctNumeric(item)
  return n != null ? Math.round(n) : null
}

/** Actual hiển thị kiểu mẫu a.ts: số/chữ chính + (% riêng) khi parse được % — tránh lặp «10 (100%)». */
function rolloutMetricHeadline(item: GmModalKpiItemMock): {
  actualMain: string
  actualPct: number | null
} {
  const pctN = rolloutProgressPctNumeric(item)
  const act = String(item.actual ?? '').trim()
  if (pctN != null) {
    const withoutParenSuffix = act
      .replace(/\(\s*\d+(?:\.\d+)?\s*%\s*\)\s*$/, '')
      .trim()
    const onlyPct = act.match(/^\s*(\d+(?:\.\d+)?)\s*%\s*$/)
    const main = (
      onlyPct ? onlyPct[1] : withoutParenSuffix || act
    ).trim()
    return {
      actualMain: main || '—',
      actualPct: Math.round(Math.min(100, Math.max(0, pctN))),
    }
  }
  return { actualMain: act || '—', actualPct: null }
}

function rolloutMemberCardStyle(item: GmModalKpiItemMock) {
  const fail = item.submissionStatus === 'missing_data' || item.isFail
  if (fail) {
    return {
      outerCard: 'bg-rose-50/30 rounded-2xl border border-rose-200 shadow-sm',
      accentClass: 'bg-rose-500',
      avatarWrap: 'bg-white border border-rose-200 text-rose-500',
      nameClass: 'text-sm font-bold text-rose-800',
      rankBadgeClass: 'border-rose-200 bg-rose-50 text-rose-800',
      actualValueClass: 'font-bold text-rose-700',
    }
  }
  return {
    outerCard: 'bg-white rounded-2xl border border-slate-200 shadow-sm',
    accentClass: 'bg-emerald-500',
    avatarWrap: 'bg-slate-100 border border-slate-200 text-slate-500',
    nameClass: 'text-sm font-bold text-slate-800',
    rankBadgeClass: 'border-slate-200 bg-slate-50 text-slate-600',
    actualValueClass: 'font-bold text-emerald-700',
  }
}

const rolloutDeptLabel = computed(() => {
  const rows = props.pmKpiRollout?.rows
  if (!rows?.length) return ''
  return rows[0]?.profile.departmentLabel?.trim() ?? ''
})

const rolloutPersonnelCountLabel = computed(() => {
  const n = props.pmKpiRollout?.rows.length ?? 0
  return n === 1 ? '1 member' : `${n} members`
})

const expandedRolloutRows = ref<Record<number, boolean>>({})

function isRolloutRowExpanded(idx: number): boolean {
  return expandedRolloutRows.value[idx] ?? false
}

function toggleRolloutRow(idx: number) {
  expandedRolloutRows.value[idx] = !isRolloutRowExpanded(idx)
}

watch(
  () => props.pmKpiRollout,
  (rollout) => {
    const len = rollout?.rows.length ?? 0
    const next: Record<number, boolean> = {}
    for (let i = 0; i < len; i += 1) next[i] = false
    expandedRolloutRows.value = next
  },
  { immediate: true },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="gm-member-drawer">
      <div v-if="showRolloutPanel || showLegacyPanel" class="fixed inset-0 z-[60]">
        <div
          class="gm-member-drawer-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
          @click="emit('close')"
        />
        <div
          class="gm-member-drawer-panel absolute bottom-0 right-0 top-0 flex w-full max-w-full flex-col border-l border-slate-200 bg-slate-50 shadow-[0_0_40px_rgba(0,0,0,0.2)] md:w-[520px] lg:w-[min(42rem,100vw)] xl:w-[min(44rem,100vw)]"
        >
          <!-- ─── PM + một KPI (diagnostics) — bám submission-detail-drawer trong index.html ─── -->
          <template v-if="showRolloutPanel && pmKpiRollout">
            <div
              class="z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white p-4 shadow-sm"
            >
              <h2 class="flex items-center gap-2 text-base font-bold text-slate-800">
                <i class="fas fa-file-lines text-base text-indigo-500" />
                KPI execution details (by group / PM)
              </h2>
              <button
                type="button"
                class="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
                @click="emit('close')"
              >
                <i class="fas fa-times text-base" />
              </button>
            </div>

            <div
              class="relative flex shrink-0 items-start gap-4 overflow-hidden bg-[#1e293b] p-6 shadow-md"
            >
              <div
                class="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl"
              />
              <div
                class="relative z-10 mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/20 text-blue-300 shadow-inner"
              >
                <i class="fas fa-bullseye text-lg" />
              </div>
              <div class="relative z-10 min-w-0 flex-1">
                <h2 class="text-lg font-bold leading-tight text-white">
                  {{ pmKpiRollout.kpiName }}
                </h2>
                <div class="mt-2.5 border-t border-slate-600/50 pt-2.5">
                  <p class="flex items-center gap-1.5 text-sm font-medium text-slate-300">
                    <i class="fas fa-user text-xs text-slate-400" />
                    Manager ({{ pmKpiRollout.rollupRoleLabel || '—' }}):
                    <span class="font-bold text-white">{{ pmKpiRollout.pmName }}</span>
                  </p>
                  <p
                    v-if="rolloutDeptLabel"
                    class="mt-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400"
                  >
                    <i class="fas fa-building text-[11px] text-slate-500" />
                    {{ rolloutDeptLabel }}
                  </p>
                </div>
              </div>
            </div>

            <div class="custom-scrollbar flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-slate-100/40 to-slate-50 p-3 sm:p-4">
              <div class="flex items-center justify-between px-0.5">
                <h3 class="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-600">
                  Personnel performing this KPI
                </h3>
                <span
                  class="rounded-full border border-emerald-300/80 bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800 shadow-sm"
                >
                  {{ rolloutPersonnelCountLabel }}
                </span>
              </div>

              <div
                v-for="(row, idx) in pmKpiRollout.rows"
                :key="`${row.item.code}-${idx}`"
                class="group relative overflow-hidden rounded-xl border border-red-100 bg-white shadow-sm ring-1 ring-slate-900/[0.03] transition-all duration-200 hover:shadow-md"
              >
                <div
                  class="pointer-events-none absolute bottom-0 left-0 top-0 w-1.5 rounded-l-xl"
                  :class="rolloutMemberCardStyle(row.item).accentClass"
                />
                <div class="relative p-4 sm:p-5">
                  <div class="flex min-w-0 flex-col">
                    <div
                      class="flex min-w-0 cursor-pointer select-none flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                      @click="toggleRolloutRow(idx)"
                    >
                      <div class="flex min-w-0 items-center gap-3">
                        <div
                          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-sm"
                          :class="rolloutMemberCardStyle(row.item).avatarWrap"
                        >
                          <i class="fas fa-user text-sm" />
                        </div>
                        <div class="min-w-0 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                          <h4
                            class="max-w-full truncate text-base font-bold leading-snug"
                            :class="rolloutMemberCardStyle(row.item).nameClass"
                          >
                            {{ row.profile.name }}
                          </h4>
                          <span
                            class="w-fit rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                            :class="rolloutMemberCardStyle(row.item).rankBadgeClass"
                          >
                            {{ row.profile.rank ?? '—' }}
                          </span>
                        </div>
                      </div>
                      <div class="flex items-center gap-2">
                        <span
                          class="inline-flex w-fit max-w-full items-center rounded-full border px-3 py-1 text-xs font-medium shadow-sm"
                          :class="asmStatusMeta(row.item).badgeClass"
                        >
                          {{ asmStatusMeta(row.item).label }}
                        </span>
                        <button
                          type="button"
                          class="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          :aria-label="isRolloutRowExpanded(idx) ? 'Collapse details' : 'Expand details'"
                          @click.stop="toggleRolloutRow(idx)"
                        >
                          <i
                            class="fas fa-chevron-down text-sm transition-transform duration-300"
                            :class="isRolloutRowExpanded(idx) ? 'rotate-180' : ''"
                          />
                        </button>
                      </div>
                    </div>

                    <div
                      class="grid transition-all duration-300 ease-in-out"
                      :class="
                        isRolloutRowExpanded(idx)
                          ? 'mt-5 grid-rows-[1fr] opacity-100'
                          : 'mt-0 grid-rows-[0fr] opacity-0'
                      "
                    >
                      <div class="overflow-hidden space-y-4">
                        <div class="rounded-lg border border-slate-100 bg-slate-50/70 p-4">
                          <div class="space-y-4">
                            <div class="flex items-end justify-between gap-6">
                              <div class="min-w-0">
                                <p
                                  class="mb-1 text-xs font-semibold text-slate-500"
                                  title="Target allocated to this person for this KPI (when the PM rolled it out)."
                                >
                                  Assigned target
                                </p>
                                <div class="text-2xl font-bold leading-none text-slate-900">
                                  {{ row.item.target }}
                                </div>
                              </div>
                              <div class="min-w-0 shrink-0 text-right">
                                <p class="mb-1 text-xs font-semibold text-slate-500">Actual</p>
                                <div class="flex flex-wrap items-baseline justify-end gap-1">
                                  <span
                                    class="text-2xl font-bold leading-none"
                                    :class="rolloutMemberCardStyle(row.item).actualValueClass"
                                  >
                                    {{ rolloutMetricHeadline(row.item).actualMain }}
                                  </span>
                                  <span
                                    v-if="rolloutMetricHeadline(row.item).actualPct != null"
                                    class="text-sm font-semibold tabular-nums"
                                    :class="rolloutMemberCardStyle(row.item).actualValueClass"
                                  >
                                    ({{ rolloutMetricHeadline(row.item).actualPct }}%)
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div
                              v-if="rolloutProgressPctRounded(row.item) != null"
                              class="relative h-2 w-full overflow-visible rounded-full bg-slate-200/90"
                            >
                                <div
                                  class="relative h-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 shadow-sm transition-[width] duration-500 ease-out"
                                  :style="{
                                    width:
                                      Math.min(
                                        100,
                                        Math.max(0, rolloutProgressPctRounded(row.item) ?? 0),
                                      ) + '%',
                                  }"
                                >
                                  <i
                                    v-if="(rolloutProgressPctRounded(row.item) ?? 0) >= 100"
                                    class="fas fa-check-circle absolute -right-0.5 -top-1 text-[13px] text-emerald-600 drop-shadow-sm ring-2 ring-white"
                                    aria-hidden="true"
                                  />
                                </div>
                              </div>
                              <div
                                v-else-if="
                                  row.item.actualProgressPct &&
                                  !rolloutActualProgressRedundant(row.item)
                                "
                                class="mt-3 flex items-start justify-between gap-3 border-t border-slate-200/60 pt-3 text-xs"
                              >
                                <span class="font-semibold text-slate-500">Actual %</span>
                                <span
                                  class="font-extrabold tabular-nums"
                                  :class="rolloutMemberCardStyle(row.item).actualValueClass"
                                >
                                  {{ row.item.actualProgressPct }}
                                </span>
                              </div>

                            <div class="space-y-2 mt-2 border-t border-slate-200/60 pt-2">
                              <p class="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Evidence / notes
                              </p>

                              <template v-if="usesPmStyleEvidence(row.item)">
                                <div
                                  class="overflow-x-auto rounded-lg border border-indigo-100 bg-white shadow-sm"
                                >
                                  <table class="w-full text-left text-xs">
                                    <thead
                                      class="bg-indigo-50 text-[10px] font-bold uppercase tracking-wider text-indigo-800"
                                    >
                                      <tr>
                                        <th
                                          class="px-3 py-2.5 text-center"
                                          :class="
                                            !isRecordStyleCalcRule(row.item.calcRuleCode)
                                              ? 'w-3/5'
                                              : 'w-2/3'
                                          "
                                        >
                                          Content
                                        </th>
                                        <th
                                          v-if="!isRecordStyleCalcRule(row.item.calcRuleCode)"
                                          class="w-1/5 border-l border-indigo-100/60 px-3 py-2.5 text-center"
                                        >
                                          Plan
                                        </th>
                                        <th
                                          class="border-l border-indigo-100/60 px-3 py-2.5 text-center"
                                          :class="
                                            !isRecordStyleCalcRule(row.item.calcRuleCode)
                                              ? 'w-1/5'
                                              : 'w-1/3'
                                          "
                                        >
                                          Actual
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody class="divide-y divide-slate-100">
                                      <tr
                                        v-for="(ev, eIdx) in row.item.evidenceData"
                                        :key="eIdx"
                                        class="transition-colors hover:bg-slate-50"
                                      >
                                        <td
                                          class="px-3 py-2.5 font-medium leading-snug text-slate-800"
                                        >
                                          {{ evidenceText(ev.content || ev.comment) }}
                                        </td>
                                        <td
                                          v-if="!isRecordStyleCalcRule(row.item.calcRuleCode)"
                                          class="border-l border-slate-100 px-3 py-2.5 text-center text-slate-600"
                                        >
                                          {{ evidenceText(ev.plan) }}
                                        </td>
                                        <td
                                          class="border-l border-slate-100 px-3 py-2.5 text-center font-bold text-emerald-600"
                                        >
                                          {{ evidenceText(ev.actual) }}
                                        </td>
                                      </tr>
                                      <tr
                                        v-if="
                                          (!row.item.evidenceData ||
                                            row.item.evidenceData.length === 0) &&
                                          !row.item.evidenceContent
                                        "
                                      >
                                        <td
                                          :colspan="rolloutEvidenceColspan(row.item)"
                                          class="px-3 py-3 text-center font-medium italic text-slate-400"
                                        >
                                          No tabular evidence details yet.
                                        </td>
                                      </tr>
                                      <tr v-if="row.item.evidenceContent">
                                        <td
                                          :colspan="rolloutEvidenceColspan(row.item)"
                                          class="border-t border-yellow-100 bg-yellow-50/30 px-4 py-3 text-slate-700 whitespace-pre-wrap"
                                        >
                                          <p
                                            class="mb-1 text-[10px] font-bold uppercase text-yellow-700/70"
                                          >
                                            Notes (Comment for Supervisor):
                                          </p>
                                          {{ row.item.evidenceContent }}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>

                                <div
                                  v-if="
                                    row.item.evidenceAttachments &&
                                    row.item.evidenceAttachments.length > 0
                                  "
                                  class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                                >
                                  <p class="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    Attached evidence (URL / file)
                                  </p>
                                  <ul class="flex flex-col gap-3">
                                    <li
                                      v-for="(att, ai) in row.item.evidenceAttachments"
                                      :key="'ev-' + ai"
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
                              </template>

                              <template v-else>
                                <table
                                  v-if="rolloutEvidenceTable(row.item)"
                                  class="w-full overflow-hidden rounded-md border border-slate-200 bg-white text-left text-xs shadow-sm"
                                >
                                  <thead
                                    class="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-600"
                                  >
                                    <tr>
                                      <th
                                        v-for="(h, hi) in rolloutEvidenceTable(row.item)!.headers"
                                        :key="hi"
                                        class="border-b border-slate-200 px-2.5 py-2"
                                        :class="hi > 0 ? 'text-center' : 'text-left'"
                                      >
                                        {{ h }}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody class="divide-y divide-slate-100">
                                    <tr
                                      v-for="(evRow, ri) in rolloutEvidenceTable(row.item)!.rows"
                                      :key="ri"
                                    >
                                      <td
                                        v-for="(cell, ci) in evRow"
                                        :key="ci"
                                        class="px-2.5 py-2 font-medium leading-snug"
                                        :class="
                                          ci > 0
                                            ? 'text-center text-slate-800'
                                            : 'text-slate-700'
                                        "
                                      >
                                        <a
                                          v-if="isEvidenceCellHttpUrl(cell)"
                                          :href="cell.trim()"
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          class="break-all font-semibold text-indigo-600 hover:underline"
                                        >
                                          {{ cell }}
                                        </a>
                                        <template v-else>{{ cell || '—' }}</template>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                                <div
                                  v-else
                                  class="min-h-[44px] rounded-md border border-slate-200 bg-white p-2.5 text-sm text-slate-400"
                                >
                                  —
                                </div>
                              </template>
                            </div>
                          </div>
                        </div>

                        <div class="space-y-2">
                          <ul
                            v-if="
                              !usesPmStyleEvidence(row.item) &&
                              row.item.evidenceAttachments &&
                              row.item.evidenceAttachments.length > 0
                            "
                            class="space-y-2"
                          >
                            <li
                              v-for="(att, ai) in row.item.evidenceAttachments"
                              :key="'ev-' + ai"
                              class="flex gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/30"
                            >
                              <span
                                class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"
                              >
                                <i class="fas fa-link text-sm" />
                              </span>
                              <div class="min-w-0 flex-1 space-y-2">
                                <a
                                  :href="normalizeEvidenceHref(att.url)"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  class="break-all text-[13px] font-semibold text-indigo-700 hover:text-indigo-900 hover:underline"
                                >
                                  {{ att.name || att.url }}
                                </a>
                                <div v-if="isEvidenceImageUrl(att.url)" class="overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                                  <img
                                    :src="normalizeEvidenceHref(att.url)"
                                    :alt="att.name || 'Evidence'"
                                    class="max-h-40 w-full object-contain"
                                  />
                                </div>
                              </div>
                            </li>
                          </ul>

                          <a
                            v-if="row.item.evidenceAttachmentUrl"
                            :href="row.item.evidenceAttachmentUrl"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-2.5 text-xs font-bold text-indigo-800 transition-colors hover:bg-indigo-100"
                          >
                            <i class="fas fa-paperclip" />
                            View attached evidence
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- ─── Một nhân viên + nhiều KPI (legacy) ─── -->
          <template v-else-if="showLegacyPanel && member">
          <!-- Header -->
          <div class="flex shrink-0 items-start justify-between border-b border-slate-200 bg-white px-4 py-3">
            <h2 class="flex items-center gap-2 text-base font-bold text-slate-800">
              <span class="rounded-lg bg-violet-100 p-1.5 text-violet-600">
                <i class="fas fa-file-alt text-sm" />
              </span>
              KPI submission status
            </h2>
            <button
              type="button"
              class="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
              aria-label="Close"
              @click="emit('close')"
            >
              <i class="fas fa-times text-base" />
            </button>
          </div>

          <!-- Profile -->
          <div class="relative shrink-0 overflow-hidden bg-slate-900 px-4 py-5 text-white">
            <div class="pointer-events-none absolute -right-6 -top-10 h-36 w-36 rounded-full bg-white/5" />
            <div class="pointer-events-none absolute -bottom-8 left-1/4 h-28 w-28 rounded-full bg-white/5" />
            <div class="relative z-10 flex items-center gap-4">
              <div
                class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-white/30 bg-white/10 text-white"
              >
                <i class="fas fa-user text-xl text-white/90" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex min-w-0 items-center gap-2">
                  <p class="min-w-0 truncate text-lg font-bold tracking-tight">{{ member.name }}</p>
                  <span
                    v-if="member.rank"
                    class="shrink-0 rounded-md border border-white/25 bg-white/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white/95"
                  >
                    {{ member.rank }}
                  </span>
                </div>
                <p class="mt-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                  <i class="fas fa-building text-[10px] opacity-80" />
                  <span class="truncate">{{ member.departmentLabel ?? member.leader ?? '—' }}</span>
                </p>
              </div>
            </div>
          </div>

          <!-- KPI theo loại -->
          <div class="flex-1 space-y-5 overflow-y-auto p-3 pb-6">
            <section v-for="section in groupedSections" :key="section.kind" class="space-y-2.5">
              <div class="flex items-center justify-between gap-2 px-0.5">
                <div class="flex min-w-0 items-center gap-2">
                  <span class="h-2 w-2 shrink-0 rounded-full" :class="section.meta.dotClass" />
                  <h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    {{ section.meta.title }}
                  </h3>
                </div>
                <span
                  class="shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold"
                  :class="section.sectionBadgeClass"
                >
                  {{ section.sectionBadgeText }}
                </span>
              </div>

              <div class="space-y-2">
                <article
                  v-for="item in section.items"
                  :key="item.code"
                  class="flex flex-col gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                  :class="
                    isMissing(item)
                      ? 'border-rose-300 bg-rose-50/80'
                      : 'border-slate-200/90 bg-white shadow-sm'
                  "
                >
                  <div class="min-w-0 flex-1">
                    <p
                      class="text-sm font-bold leading-snug"
                      :class="isMissing(item) ? 'text-rose-800' : 'text-slate-900'"
                    >
                      <span class="font-extrabold">{{ item.code }}</span>
                      <span class="mx-1 font-normal text-slate-400">·</span>
                      {{ item.obj }}
                    </p>
                    <p
                      class="mt-1.5 whitespace-pre-line text-[11px] leading-relaxed"
                      :class="isMissing(item) ? 'text-rose-700/90' : 'text-slate-500'"
                    >
                      {{ targetLine(item) }}
                    </p>
                    <a
                      v-if="item.evidenceAttachmentUrl"
                      :href="item.evidenceAttachmentUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="mt-2 inline-flex max-w-full items-center gap-1.5 break-all text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      <i class="fas fa-paperclip shrink-0 text-[10px]" />
                      View attached evidence
                    </a>
                  </div>

                  <div
                    class="flex shrink-0 flex-col items-stretch gap-2 sm:items-end"
                    :class="isMissing(item) ? 'sm:w-auto' : ''"
                  >
                    <template v-if="statusBlock(item).kind === 'ok'">
                      <span
                        class="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600 sm:justify-end"
                      >
                        <i :class="[statusBlock(item).icon, 'text-sm']" />
                        {{ statusBlock(item).label }}
                      </span>
                    </template>
                    <template v-else>
                      <div class="flex flex-wrap items-center justify-end gap-2">
                        <span
                          class="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-white px-2.5 py-1 text-[10px] font-bold text-rose-600 shadow-sm"
                        >
                          <i class="fas fa-exclamation-circle text-[10px]" />
                          Missing data
                        </span>
                        <button
                          type="button"
                          class="rounded-lg bg-rose-600 px-3 py-1.5 text-[10px] font-bold text-white shadow-sm transition-colors hover:bg-rose-700"
                          @click="onRemind(item)"
                        >
                          Send reminder
                        </button>
                      </div>
                    </template>
                  </div>
                </article>
              </div>
            </section>

            <p v-if="!groupedSections.length" class="py-12 text-center text-xs font-medium text-slate-500">
              No KPI data for this employee.
            </p>
          </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.gm-member-drawer-enter-active,
.gm-member-drawer-leave-active {
  transition-duration: 0.3s;
}
.gm-member-drawer-enter-active .gm-member-drawer-backdrop,
.gm-member-drawer-leave-active .gm-member-drawer-backdrop {
  transition: opacity 0.3s ease;
}
.gm-member-drawer-enter-active .gm-member-drawer-panel,
.gm-member-drawer-leave-active .gm-member-drawer-panel {
  transition: transform 0.3s ease-out;
}
.gm-member-drawer-enter-from .gm-member-drawer-backdrop,
.gm-member-drawer-leave-to .gm-member-drawer-backdrop {
  opacity: 0;
}
.gm-member-drawer-enter-to .gm-member-drawer-backdrop,
.gm-member-drawer-leave-from .gm-member-drawer-backdrop {
  opacity: 1;
}
.gm-member-drawer-enter-from .gm-member-drawer-panel,
.gm-member-drawer-leave-to .gm-member-drawer-panel {
  transform: translateX(100%);
}
.gm-member-drawer-enter-to .gm-member-drawer-panel,
.gm-member-drawer-leave-from .gm-member-drawer-panel {
  transform: translateX(0);
}

@media (prefers-reduced-motion: reduce) {
  .gm-member-drawer-enter-active,
  .gm-member-drawer-leave-active,
  .gm-member-drawer-enter-active .gm-member-drawer-backdrop,
  .gm-member-drawer-leave-active .gm-member-drawer-backdrop,
  .gm-member-drawer-enter-active .gm-member-drawer-panel,
  .gm-member-drawer-leave-active .gm-member-drawer-panel {
    transition-duration: 0.01ms !important;
  }
}
</style>
