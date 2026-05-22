<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import GmStrategicKpiTypeTag from '@/components/gm/GmStrategicKpiTypeTag.vue'
import type { GmStrategicKpiKind } from '@/types/gm-workspace'
import { kpiCreatorCardBgClass } from '@/utils/kpiCreatorRowBg'

type RequestRow = {
  id: string
  userId: string
  user: string
  avatar: string
  kpiName: string
  kpiType: GmStrategicKpiKind
  type: string
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
  creatorRoleCode?: string
}

type MemberApprovalPayload = {
  userFullName: string
  avatar: string
  kpis: RequestRow[]
}

const props = defineProps({
  open: { type: Boolean, default: false },
  memberApproval: { type: Object as () => MemberApprovalPayload | null, default: null },
  actionBusy: { type: Boolean, default: false },
})

const emit = defineEmits<{
  close: []
  approve: [req: RequestRow]
  reject: [payload: { req: RequestRow; reason: string }]
  'approve-all': [rows: RequestRow[]]
  'reject-all': [payload: { rows: RequestRow[]; reason: string }]
}>()

const selectedKpi = ref<RequestRow | null>(null)
const rejectDialog = ref<{ open: boolean; targetId: string | 'all' | null }>({
  open: false,
  targetId: null,
})
const rejectReason = ref('')
const rejectError = ref('')

const pendingKpis = computed(() =>
  (props.memberApproval?.kpis ?? []).filter((k) => k.status === 'PENDING'),
)

const selectedKpiRuleBands = computed(() =>
  selectedKpi.value ? parseScoringRuleBands(selectedKpi.value.scoringRuleText) : [],
)

const selectedKpiRuleLinesFallback = computed(() =>
  selectedKpi.value ? scoringRuleLines(selectedKpi.value.scoringRuleText) : [],
)

function openKpiDetail(req: RequestRow) {
  selectedKpi.value = req
}

function closeKpiDetail() {
  selectedKpi.value = null
}

function initiateReject(targetId: string | 'all') {
  rejectDialog.value = { open: true, targetId }
  rejectReason.value = ''
  rejectError.value = ''
}

function closeRejectDialog() {
  rejectDialog.value = { open: false, targetId: null }
  rejectReason.value = ''
  rejectError.value = ''
}

function confirmReject() {
  const reason = rejectReason.value.trim()
  if (!reason) {
    rejectError.value = 'Enter a rejection reason.'
    return
  }
  if (rejectDialog.value.targetId === 'all') {
    emit('reject-all', { rows: pendingKpis.value, reason })
  } else {
    const req = (props.memberApproval?.kpis ?? []).find((k) => k.id === rejectDialog.value.targetId)
    if (req) emit('reject', { req, reason })
  }
  closeRejectDialog()
}

watch(
  () => props.open,
  (val) => {
    document.body.style.overflow = val ? 'hidden' : ''
    if (!val) {
      selectedKpi.value = null
      closeRejectDialog()
    }
  },
)

watch(
  () => props.memberApproval?.kpis,
  (kpis) => {
    if (!selectedKpi.value) return
    const exists = Array.isArray(kpis) && kpis.some((k) => k.id === selectedKpi.value?.id)
    if (!exists) selectedKpi.value = null
  },
)

onUnmounted(() => {
  document.body.style.overflow = ''
})

function scoringRuleLines(text: string): string[] {
  if (!text?.trim()) return []
  return text
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

type ScoringRuleBand = { levelLabel: string; rangeText: string }

/** Parse "5: >4.5" / "5 : > 4.5" → ô MỨC 5 (ảnh thiết kế). */
function parseScoringRuleBands(text: string): ScoringRuleBand[] {
  const lines = scoringRuleLines(text)
  const bands: ScoringRuleBand[] = []
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\s*[:：]\s*(.+)$/)
    if (m) {
      const num = m[1]
      let range = m[2].trim()
      range = range.replace(/\s+/g, ' ')
      bands.push({ levelLabel: `LEVEL ${num}`, rangeText: range })
    }
  }
  bands.sort((a, b) => {
    const na = parseInt(a.levelLabel.replace(/\D/g, ''), 10) || 0
    const nb = parseInt(b.levelLabel.replace(/\D/g, ''), 10) || 0
    return nb - na
  })
  return bands
}

/** Hiển thị phần % trong modal (vd "10% trọng số" → "10%"). */
function weightDisplayShort(weightLabel: string): string {
  const m = weightLabel.match(/([\d.]+\s*%)/)
  if (m) return m[1].replace(/\s+/g, '')
  return weightLabel.replace(/\s*weight\s*/gi, '').trim() || weightLabel
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pm-drawer">
      <div v-if="open && memberApproval" class="fixed inset-0 z-[100] flex justify-end">
        <div
          class="pm-drawer-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
          @click="emit('close')"
        />

        <div class="pm-drawer-panel will-change-transform relative flex h-full w-full flex-col border-l border-slate-200 bg-slate-50 shadow-2xl md:w-[520px] lg:w-[640px]">
          <div class="z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 class="flex items-center gap-2 text-lg font-bold text-slate-800">
                <span class="rounded-lg bg-orange-100 p-1.5 text-orange-600 shadow-sm">
                  <i class="fas fa-inbox text-sm"></i>
                </span>
                Pending Proposals
              </h2>
            </div>
            <button
              type="button"
              class="rounded-full p-2 text-slate-400 hover:bg-slate-100"
              aria-label="Close"
              @click="emit('close')"
            >
              <i class="fas fa-times text-base"></i>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-4 space-y-3">
            <div class="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-lg font-bold text-slate-600"
              >
                {{ memberApproval.avatar }}
              </div>
              <div class="min-w-0">
                <p class="truncate text-base font-bold text-slate-800">{{ memberApproval.userFullName }}</p>
                <p class="text-xs font-semibold uppercase text-slate-500">
                  {{ pendingKpis.length }} KPIs pending action
                </p>
              </div>
            </div>

            <div v-if="pendingKpis.length > 0" class="grid grid-cols-2 gap-2">
              <button
                type="button"
                :disabled="actionBusy"
                class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                @click="emit('approve-all', pendingKpis)"
              >
                <i class="fas fa-list-check mr-1.5 text-xs" />
                Approve all
              </button>
              <button
                type="button"
                :disabled="actionBusy"
                class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                @click="initiateReject('all')"
              >
                <i class="fas fa-circle-xmark mr-1.5 text-xs" />
                Reject all
              </button>
            </div>

            <div v-if="memberApproval.kpis.length === 0" class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              No pending KPIs remain for this member.
            </div>

            <div
              v-for="req in memberApproval.kpis"
              :key="req.id"
              class="rounded-xl border border-slate-200 p-4 text-left shadow-sm"
              :class="kpiCreatorCardBgClass(req.creatorRoleCode)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <span class="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-800">
                    {{ req.status }}
                  </span>
                  <div class="mt-2 flex flex-wrap items-center gap-2">
                    <h4 class="truncate text-sm font-bold text-slate-800">{{ req.kpiName }}</h4>
                    <GmStrategicKpiTypeTag :type="req.kpiType" size="sm" />
                  </div>
                  <p class="mt-1 text-[10px] font-medium text-slate-400">Sent: {{ req.date }}</p>
                </div>
                <button
                  type="button"
                  class="shrink-0 rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                  @click="openKpiDetail(req)"
                >
                  <i class="fas fa-chevron-right text-[10px]" />
                </button>
              </div>

              <!-- Per-KPI approve/reject actions are intentionally hidden for now.
              <div v-if="req.status === 'PENDING'" class="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  :disabled="actionBusy"
                  class="rounded-md px-3 py-1.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  @click="initiateReject(req.id)"
                >
                  Reject
                </button>
                <button
                  type="button"
                  :disabled="actionBusy"
                  class="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  @click="emit('approve', req)"
                >
                  Approve
                </button>
              </div>
              -->
            </div>
          </div>

          <Transition name="fade">
            <div
              v-if="selectedKpi"
              class="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-[2px]"
              @click.self="closeKpiDetail"
            >
              <div
                class="flex max-h-[min(90vh,560px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                @click.stop
              >
                <!-- Header gọn -->
                <div class="flex shrink-0 items-start justify-between border-b border-slate-100 px-4 py-3">
                  <div class="min-w-0 pr-2">
                    <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Pending KPI Details
                    </p>
                    <h2 class="mt-0.5 flex flex-wrap items-center gap-2 text-lg font-bold leading-snug text-slate-900">
                      <span class="min-w-0 truncate">{{ selectedKpi.kpiName }}</span>
                      <GmStrategicKpiTypeTag :type="selectedKpi.kpiType" size="sm" />
                    </h2>
                    <div class="mt-2 flex flex-wrap gap-1.5">
                      <span
                        v-if="selectedKpi.status === 'PENDING'"
                        class="rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700"
                      >
                        PENDING
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close KPI details"
                    @click="closeKpiDetail"
                  >
                    <i class="fas fa-times text-sm leading-none" />
                  </button>
                </div>

                <!-- Body: 2 thẻ, padding vừa -->
                <div class="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                  <!-- Thẻ 1: 4 hàng icon | nhãn | giá trị -->
                  <div class="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <div class="flex items-center gap-3 px-3 py-2.5">
                      <i class="fas fa-bullseye w-4 shrink-0 text-center text-[13px] text-slate-400" />
                      <span class="min-w-0 flex-1 text-xs font-medium text-slate-500">Member Target</span>
                      <span class="max-w-[55%] text-right text-sm font-bold text-slate-900">{{
                        selectedKpi.memberTarget
                      }}</span>
                    </div>
                    <div class="flex items-center gap-3 px-3 py-2.5">
                      <i class="fas fa-percent w-4 shrink-0 text-center text-[13px] text-slate-400" />
                      <span class="min-w-0 flex-1 text-xs font-medium text-slate-500">Weight</span>
                      <span class="text-right text-sm font-bold text-blue-600">{{
                        weightDisplayShort(selectedKpi.weightLabel)
                      }}</span>
                    </div>
                    <div class="flex items-center gap-3 px-3 py-2.5">
                      <i class="fas fa-book w-4 shrink-0 text-center text-[13px] text-slate-400" />
                      <span class="min-w-0 flex-1 text-xs font-medium text-slate-500">BSC Aspect</span>
                      <span class="max-w-[58%] text-right text-xs font-bold leading-snug text-slate-900">{{
                        selectedKpi.bscAspect
                      }}</span>
                    </div>
                    <div class="flex items-center gap-3 px-3 py-2.5">
                      <i class="fas fa-calculator w-4 shrink-0 text-center text-[13px] text-slate-400" />
                      <span class="min-w-0 flex-1 text-xs font-medium text-slate-500">Calculation Method</span>
                      <span class="max-w-[58%] text-right text-xs font-bold leading-snug text-slate-900">{{
                        selectedKpi.calculationMethodLabel
                      }}</span>
                    </div>
                  </div>

                  <!-- Thẻ 2: quy tắc — hàng ô MỨC -->
                  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <div class="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                      <i class="fas fa-list-check text-[13px] text-slate-600" />
                      <span class="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                        Scoring Rules
                      </span>
                    </div>
                    <div class="px-3 py-3">
                      <div
                        v-if="selectedKpiRuleBands.length"
                        class="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      >
                        <div
                          v-for="(band, idx) in selectedKpiRuleBands"
                          :key="idx"
                          class="min-w-[4.25rem] flex-1 shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-center sm:min-w-0"
                        >
                          <div class="text-[10px] font-bold uppercase leading-tight text-slate-500">
                            {{ band.levelLabel }}
                          </div>
                          <div class="mt-1 text-[11px] font-bold leading-tight text-slate-900">
                            {{ band.rangeText }}
                          </div>
                        </div>
                      </div>
                      <p
                        v-else-if="selectedKpiRuleLinesFallback.length"
                        class="font-mono text-[11px] leading-relaxed text-slate-600 whitespace-pre-line"
                      >
                        {{ selectedKpi.scoringRuleText }}
                      </p>
                      <p v-else class="text-center text-xs text-slate-400">—</p>
                    </div>
                  </div>
                </div>

                <!-- Footer gọn -->
                <div
                  class="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-2.5"
                >
                  <button
                    type="button"
                    class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    @click="closeKpiDetail"
                  >
                    Close
                  </button>
                  <!-- <button
                    v-if="selectedKpi.status === 'PENDING'"
                    type="button"
                    :disabled="actionBusy"
                    class="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    @click="initiateReject(selectedKpi.id)"
                  >
                    <i class="fas fa-circle-xmark text-sm leading-none" />
                    Reject
                  </button> -->
                  <!-- <button
                    v-if="selectedKpi.status === 'PENDING'"
                    type="button"
                    :disabled="actionBusy"
                    class="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    @click="emit('approve', selectedKpi)"
                  >
                    <i class="fas fa-circle-check text-sm leading-none" />
                    Approve
                  </button> -->
                </div>
              </div>
            </div>
          </Transition>

          <Transition name="fade">
            <div
              v-if="rejectDialog.open"
              class="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm"
              @click.self="closeRejectDialog"
            >
              <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
                <div class="mb-3 flex items-center gap-3">
                  <div class="rounded-full bg-rose-100 p-2 text-rose-600">
                    <i class="fas fa-circle-exclamation text-lg" />
                  </div>
                  <h3 class="text-lg font-bold text-slate-900">Confirm Rejection</h3>
                </div>
                <p class="mb-3 text-sm text-slate-600">
                  {{
                    rejectDialog.targetId === 'all'
                      ? 'You are rejecting ALL pending KPIs. Enter a reason.'
                      : 'Enter the reason for rejecting this KPI.'
                  }}
                </p>
                <label class="mb-1 block text-sm font-semibold text-slate-700">
                  Rejection Reason <span class="text-rose-500">*</span>
                </label>
                <textarea
                  v-model="rejectReason"
                  class="min-h-[110px] w-full resize-none rounded-lg border p-3 text-sm outline-none focus:ring-2"
                  :class="rejectError ? 'border-rose-400 focus:ring-rose-100' : 'border-slate-300 focus:ring-rose-100'"
                  placeholder="Enter detailed reason..."
                />
                <p v-if="rejectError" class="mt-1 text-xs font-medium text-rose-600">{{ rejectError }}</p>
                <div class="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    class="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                    @click="closeRejectDialog"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    :disabled="actionBusy"
                    class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                    @click="confirmReject"
                  >
                    Confirm rejection
                  </button>
                </div>
              </div>
            </div>
          </Transition>

          <div class="z-10 shrink-0 border-t border-slate-200 bg-white p-4 shadow-sm">
            <button
              type="button"
              class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
              @click="emit('close')"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
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
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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
</style>
