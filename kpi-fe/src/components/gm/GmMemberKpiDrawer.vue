<script setup lang="ts">
import { computed } from 'vue'
import type {
  GmMemberKpiDrawerProfile,
  GmModalKpiItemMock,
  GmPmKpiRolloutPayload,
  GmStrategicKpiKind,
} from '@/types/gm-workspace'

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
      sectionBadgeText: done ? `Hoàn thành ${complete}/${total}` : `Thiếu ${missing}/${total}`,
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
  return item.targetSummary ?? `Mục tiêu: ${item.target} (W: ${item.weight}%)`
}

function statusBlock(item: GmModalKpiItemMock) {
  if (item.submissionStatus === 'submitted_with_file') {
    return { kind: 'ok' as const, label: 'Đã nộp (Có File)', icon: 'fas fa-check-circle' }
  }
  if (item.submissionStatus === 'submitted') {
    return { kind: 'ok' as const, label: 'Đã nộp', icon: 'fas fa-check-circle' }
  }
  return { kind: 'missing' as const, label: 'Thiếu Dữ Liệu', icon: 'fas fa-exclamation-circle' }
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
          ? 'Chờ GM duyệt (tạo mới)'
          : code === 502
            ? '1st Half · Chờ GM'
            : 'Final · Chờ GM',
      badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
    }
  }
  if (code === 402 || code === 404 || code === 501 || code === 601) {
    return {
      label:
        code === 402
          ? 'Chờ PM duyệt (tạo mới)'
          : code === 404
            ? 'Chờ Member Accept'
            : code === 501
              ? 'Đã nộp 1st Half · Chờ PM'
              : 'Final · Chờ PM',
      badgeClass: 'border-amber-200 bg-amber-50 text-amber-900',
    }
  }
  if (code === 405 || code === 503 || code === 603) {
    return {
      label: code === 405 ? 'Đang chạy' : code === 503 ? 'Đã chốt 1st Half' : 'Đã chốt sổ',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    }
  }
  if (code === 406) {
    return {
      label: 'Từ chối',
      badgeClass: 'border-slate-300 bg-slate-100 text-slate-700',
    }
  }
  if (code === 401) {
    return {
      label: 'Chưa kích hoạt',
      badgeClass: 'border-slate-200 bg-slate-100 text-slate-600',
    }
  }
  return {
    label: `Mã ASM ${code}`,
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-600',
  }
}

function extractEvidenceNote(item: GmModalKpiItemMock) {
  const src = item.targetSummary ?? ''
  const m = src.match(/Minh chứng\s*\/\s*ghi chú:\s*(.*?)\s*(?:·\s*PM:|$)/i)
  return m?.[1]?.trim() || ''
}

/**
 * Ghi chú minh chứng (text).
 * Có URL đính kèm nhưng không có ghi chú thật → chuỗi rỗng (chỉ hiện link, tránh «-» gây hiểu nhầm).
 * Không URL và không ghi chú → «-».
 */
function rolloutEvidenceNoteDisplay(item: GmModalKpiItemMock): string {
  const raw = extractEvidenceNote(item).trim()
  const meaningful = raw.length > 0 && raw !== '-' && raw !== '—'
  if (meaningful) return raw
  if (item.evidenceAttachmentUrl) return ''
  return '-'
}

function rolloutMemberCardStyle(item: GmModalKpiItemMock) {
  const fail = item.submissionStatus === 'missing_data' || item.isFail
  if (fail) {
    return {
      outerCard: 'bg-rose-50/30 rounded-lg border border-rose-200 shadow-sm',
      accentClass: 'bg-rose-500',
      avatarWrap: 'bg-white border border-rose-200 text-rose-500',
      nameClass: 'text-sm font-bold text-rose-800',
      rankBadgeClass: 'border-rose-200 bg-rose-50 text-rose-800',
      actualValueClass: 'font-bold text-rose-700',
    }
  }
  return {
    outerCard: 'bg-white rounded-lg border border-slate-200 shadow-sm',
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
          class="gm-member-drawer-panel absolute bottom-0 right-0 top-0 flex w-full max-w-full flex-col border-l border-slate-200 bg-slate-50 shadow-[0_0_40px_rgba(0,0,0,0.2)] md:w-[500px] lg:w-[600px]"
        >
          <!-- ─── PM + một KPI (diagnostics) — bám submission-detail-drawer trong index.html ─── -->
          <template v-if="showRolloutPanel && pmKpiRollout">
            <div
              class="z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white p-4 shadow-sm"
            >
              <h2 class="flex items-center gap-2 text-base font-bold text-slate-800">
                <i class="fas fa-file-lines text-base text-indigo-500" />
                Chi tiết thực hiện KPI (Theo Nhóm/PM)
              </h2>
              <button
                type="button"
                class="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Đóng"
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
                    Quản lý ({{ pmKpiRollout.rollupRoleLabel || '—' }}):
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

            <div class="custom-scrollbar flex-1 space-y-2 overflow-y-auto bg-slate-50/50 p-3 sm:p-4">
              <div class="mb-0.5 flex items-center justify-between">
                <h3 class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                  Danh sách nhân sự thực hiện
                </h3>
                <span
                  class="rounded-full border border-emerald-200 bg-emerald-100/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
                >
                  {{ pmKpiRollout.rows.length }} Members
                </span>
              </div>

              <div
                v-for="(row, idx) in pmKpiRollout.rows"
                :key="`${row.item.code}-${idx}`"
                class="group relative overflow-hidden transition-colors"
                :class="rolloutMemberCardStyle(row.item).outerCard"
              >
                <div
                  class="pointer-events-none absolute bottom-0 left-0 top-0 w-0.5"
                  :class="rolloutMemberCardStyle(row.item).accentClass"
                />
                <div class="px-3 py-2.5 pl-3.5">
                  <div class="flex min-w-0 gap-2.5">
                    <div
                      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border"
                      :class="rolloutMemberCardStyle(row.item).avatarWrap"
                    >
                      <i class="fas fa-user text-[11px]" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex min-w-0 items-center gap-1.5">
                        <h4 class="min-w-0 truncate leading-tight" :class="rolloutMemberCardStyle(row.item).nameClass">
                          {{ row.profile.name }}
                        </h4>
                        <span
                          class="shrink-0 rounded border px-1.5 py-px text-[10px] font-extrabold tabular-nums leading-none"
                          :class="rolloutMemberCardStyle(row.item).rankBadgeClass"
                        >
                          {{ row.profile.rank ?? '—' }}
                        </span>
                      </div>
                      <div class="mt-2 space-y-1.5 border-t border-slate-100 pt-2 text-[12px] leading-snug">
                        <div class="flex items-start justify-between gap-2">
                          <span class="shrink-0 font-medium text-slate-500">Target (PM)</span>
                          <span class="min-w-0 text-right font-bold tabular-nums text-slate-800">
                            {{ row.item.target }}
                          </span>
                        </div>
                        <div class="flex items-start justify-between gap-2">
                          <span class="shrink-0 font-medium text-slate-500">Actual</span>
                          <span
                            class="min-w-0 text-right tabular-nums font-bold"
                            :class="rolloutMemberCardStyle(row.item).actualValueClass"
                          >
                            {{ row.item.actual }}
                          </span>
                        </div>
                        <div class="flex items-start justify-between gap-2">
                          <span class="shrink-0 font-medium text-slate-500">Trạng thái KPI</span>
                          <span
                            class="inline-flex min-w-0 max-w-[65%] items-center justify-end rounded-full border px-2 py-0.5 text-right text-[10px] font-bold leading-tight"
                            :class="asmStatusMeta(row.item).badgeClass"
                          >
                            {{ asmStatusMeta(row.item).label }}
                          </span>
                        </div>
                        <div
                          v-if="row.item.actualProgressPct"
                          class="flex items-start justify-between gap-2 rounded-md bg-slate-50/90 px-1.5 py-1"
                        >
                          <span class="shrink-0 font-semibold text-slate-500">Tỷ lệ Actual</span>
                          <span
                            class="font-extrabold tabular-nums"
                            :class="rolloutMemberCardStyle(row.item).actualValueClass"
                          >
                            {{ row.item.actualProgressPct }}
                          </span>
                        </div>
                        <div
                          class="flex items-start justify-between gap-2 border-t border-slate-100 pt-1.5 leading-snug"
                        >
                          <span class="shrink-0 font-medium text-slate-500">Minh chứng / ghi chú</span>
                          <div class="flex min-w-0 flex-col items-end gap-0.5 text-right">
                            <span
                              v-if="rolloutEvidenceNoteDisplay(row.item)"
                              class="max-w-full font-medium text-slate-700 break-words"
                            >
                              {{ rolloutEvidenceNoteDisplay(row.item) }}
                            </span>
                            <a
                              v-if="row.item.evidenceAttachmentUrl"
                              :href="row.item.evidenceAttachmentUrl"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="inline-flex max-w-full items-center justify-end gap-1 break-all font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                            >
                              <i class="fas fa-paperclip shrink-0 text-[12px]" />
                              Xem bằng chứng đính kèm
                            </a>
                          </div>
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
              Chi tiết tình trạng Nộp KPI
            </h2>
            <button
              type="button"
              class="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
              aria-label="Đóng"
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
                      class="mt-1.5 text-[11px] leading-relaxed"
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
                      Xem bằng chứng đính kèm
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
                          Thiếu Dữ Liệu
                        </span>
                        <button
                          type="button"
                          class="rounded-lg bg-rose-600 px-3 py-1.5 text-[10px] font-bold text-white shadow-sm transition-colors hover:bg-rose-700"
                          @click="onRemind(item)"
                        >
                          Gửi Remind
                        </button>
                      </div>
                    </template>
                  </div>
                </article>
              </div>
            </section>

            <p v-if="!groupedSections.length" class="py-12 text-center text-xs font-medium text-slate-500">
              Chưa có dữ liệu KPI cho nhân viên này.
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
