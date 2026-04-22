<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import {
  getTeamMembersForYear,
  isReadonlyKpiYear,
  MOCK_TEAM_MEMBERS,
  TOTAL_KPI_WEIGHT,
  type KpiGroupMock,
  type TeamMemberMock,
} from '@/mocks/leaderManager.mock'

const route = useRoute()
const selectedYear = ref(new Date().getFullYear())
const nameQuery = ref('')
type FilterTab = 'all' | 'pending'
const filterTab = ref<FilterTab>('all')
const expandedId = ref<string | null>(null)
const openEvidence = ref<Set<string>>(new Set())

function getGroups(member: TeamMemberMock): KpiGroupMock[] {
  if (member.groups.length > 0) return member.groups
  if (member.id === '812') return []
  return MOCK_TEAM_MEMBERS[0].groups
}

function allLines(groups: KpiGroupMock[]) {
  return groups.flatMap((g) => g.lines)
}

const teamMembers = computed(() => getTeamMembersForYear(selectedYear.value))
const isPastYear = computed(() => isReadonlyKpiYear(selectedYear.value))

watch(selectedYear, () => {
  expandedId.value = null
  openEvidence.value = new Set()
  nextTick(() => maybeExpandFromQuery())
})

function weightedSelfAvg(groups: KpiGroupMock[]): string {
  let sum = 0
  for (const line of allLines(groups)) {
    sum += line.selfScore * line.weight
  }
  return (sum / TOTAL_KPI_WEIGHT).toFixed(2)
}

/** Điểm PM (hiển thị từ mock — Leader không nhập tại màn này) */
function displayPmWeighted(member: TeamMemberMock, groups: KpiGroupMock[]): string {
  if (member.leaderPmByLineId) {
    let sum = 0
    for (const line of allLines(groups)) {
      const raw = member.leaderPmByLineId[line.id]
      const v = raw ? parseFloat(raw) : NaN
      if (!Number.isNaN(v) && v > 0) sum += v * line.weight
    }
    const s = (sum / TOTAL_KPI_WEIGHT).toFixed(2)
    return s === '0.00' ? '—' : s
  }
  if (member.leaderScoreDisplay != null && member.leaderScoreDisplay !== '—') {
    return member.leaderScoreDisplay
  }
  return '—'
}

function liveLeaderPreview(member: TeamMemberMock): string {
  const groups = getGroups(member)
  if (!groups.length) {
    if (member.leaderScoreDisplay != null && member.leaderScoreDisplay !== '—') return member.leaderScoreDisplay
    return '—'
  }
  return displayPmWeighted(member, groups)
}

const filteredMembers = computed(() => {
  const q = nameQuery.value.trim().toLowerCase()
  return teamMembers.value.filter((m) => {
    if (filterTab.value === 'pending' && m.status !== 'pending_review') return false
    if (!q) return true
    return m.name.toLowerCase().includes(q) || m.code.includes(q)
  })
})

const totalCount = computed(() => teamMembers.value.length)
const pendingCount = computed(() =>
  teamMembers.value.filter((m) => m.status === 'pending_review').length,
)

function canExpandDetails(member: TeamMemberMock): boolean {
  return getGroups(member).length > 0
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function toggleEvidence(key: string) {
  const next = new Set(openEvidence.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  openEvidence.value = next
}

function statusBadge(member: TeamMemberMock) {
  if (member.status === 'pending_review') {
    return {
      cls: 'bg-rose-50 text-rose-700 border border-rose-200',
      dot: true,
      label: 'Chờ PM duyệt',
    }
  }
  if (member.status === 'self_scoring') {
    return {
      cls: 'bg-slate-100 text-slate-600 border border-slate-200',
      dot: false,
      label: 'Đang tự chấm',
    }
  }
  if (member.status === 'approved') {
    return {
      cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      dot: false,
      label: 'Đã duyệt',
    }
  }
  return {
    cls: 'bg-blue-50 text-blue-700 border border-blue-200',
    dot: false,
    label: 'Đã nộp',
  }
}

function leaderLineScore(member: TeamMemberMock, lineId: string): string {
  if (member.leaderPmByLineId?.[lineId]) return member.leaderPmByLineId[lineId]
  return '—'
}

const ALLOWED_YEARS = [2025, 2026] as const

function syncYearFromRoute() {
  const raw = route.query.year
  if (raw == null || raw === '') return
  const s = Array.isArray(raw) ? raw[0] : String(raw)
  const n = parseInt(s as any, 10)
  if (!Number.isNaN(n) && (ALLOWED_YEARS as readonly number[]).includes(n)) {
    selectedYear.value = n
  }
}

function syncFilterFromRoute() {
  const raw = route.query.q ?? route.query.member
  if (typeof raw !== 'string' || !raw.trim()) return
  nameQuery.value = decodeURIComponent(raw.trim())
}

function maybeExpandFromQuery() {
  const raw = route.query.q ?? route.query.member
  if (typeof raw !== 'string' || !raw.trim()) return
  const q = nameQuery.value.trim().toLowerCase()
  if (!q) return
  const matches = teamMembers.value.filter(
    (m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q),
  )
  if (matches.length === 1 && getGroups(matches[0]).length) {
    expandedId.value = matches[0].id
  }
}

onMounted(() => {
  syncYearFromRoute()
  syncFilterFromRoute()
  nextTick(() => maybeExpandFromQuery())
})

watch(
  () => route.query,
  () => {
    syncYearFromRoute()
    syncFilterFromRoute()
    nextTick(() => maybeExpandFromQuery())
  },
  { deep: true },
)
</script>

<template>
  <div class="p-4 md:p-8 max-w-[1500px] mx-auto animate-fade-in">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-900 tracking-tight">
          Quản lý KPI của Team
        </h2>
        <p class="text-slate-500 text-sm mt-1">
          Xem tiến độ và chi tiết KPI nhân viên (Leader không chấm điểm tại đây).
        </p>
      </div>
      <select
        v-model="selectedYear"
        class="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 shadow-sm outline-none cursor-pointer focus:ring-2 focus:ring-indigo-100"
      >
        <option :value="2025">
          Năm: 2025
        </option>
        <option :value="2026">
          Năm: 2026
        </option>
      </select>
    </div>

    <div
      class="mb-4 flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-950"
    >
      <i class="fas fa-eye text-indigo-600 mt-0.5" />
      <div>
        <p class="font-bold">
          Chế độ xem
        </p>
        <p class="text-indigo-900/80 mt-0.5">
          Leader chỉ được xem KPI của team; đánh giá điểm do PM / quy trình khác thực hiện.
        </p>
      </div>
    </div>

    <div
      v-if="isPastYear"
      class="mb-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-100/80 px-4 py-3 text-sm text-slate-700"
    >
      <i class="fas fa-lock text-slate-500 mt-0.5" />
      <div>
        <p class="font-bold text-slate-800">
          Kỳ năm {{ selectedYear }} đã khóa
        </p>
        <p class="text-slate-600 mt-0.5">
          Dữ liệu hiển thị theo snapshot đã lưu.
        </p>
      </div>
    </div>

    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div class="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap justify-between items-center gap-4">
        <div class="relative w-full sm:w-64 shrink-0">
          <i class="fas fa-search w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <input
            v-model="nameQuery"
            type="text"
            placeholder="Lọc theo tên nhân viên..."
            class="pl-9 pr-4 py-2 bg-white border border-slate-300 shadow-sm rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 outline-none w-full text-slate-700"
          >
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="px-3 py-1.5 border shadow-sm rounded-lg text-sm font-bold transition-colors"
            :class="filterTab === 'all'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'"
            @click="filterTab = 'all'"
          >
            Tất cả ({{ totalCount }})
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5 border"
            :class="filterTab === 'pending'
              ? 'bg-rose-600 text-white border-rose-600'
              : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'"
            @click="filterTab = 'pending'"
          >
            <span class="w-2 h-2 rounded-full bg-rose-500" />
            Chờ PM ({{ pendingCount }})
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left whitespace-nowrap">
          <thead>
            <tr class="bg-white border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              <th class="py-4 px-6 w-10">
                Mã NV
              </th>
              <th class="py-4 px-6">
                Tên Nhân viên
              </th>
              <th class="py-4 px-6 text-center">
                Rank
              </th>
              <th class="py-4 px-6 text-center">
                Tiến độ
              </th>
              <th class="py-4 px-6 text-center bg-slate-50">
                Điểm tự chấm
              </th>
              <th class="py-4 px-6 text-center bg-indigo-50/50 text-indigo-800">
                Điểm PM
              </th>
              <th class="py-4 px-6 text-right w-40">
                Chi tiết
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 text-sm">
            <template v-for="member in filteredMembers" :key="member.id">
              <tr
                class="hover:bg-slate-50/50 transition-colors group master-row"
                :class="[
                  expandedId === member.id ? 'bg-slate-100/50 border-l-4 border-indigo-500' : '',
                  canExpandDetails(member) ? 'cursor-pointer' : '',
                ]"
                @click="canExpandDetails(member) ? toggleExpand(member.id) : undefined"
              >
                <td class="py-4 px-6 text-slate-400 font-bold">
                  {{ member.code }}
                </td>
                <td class="py-4 px-6">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs shrink-0"
                      :class="member.avatarClass"
                    >
                      {{ member.initials }}
                    </div>
                    <div>
                      <p class="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {{ member.name }}
                      </p>
                      <p class="text-xs text-slate-500">
                        {{ member.roleLine }}
                      </p>
                    </div>
                  </div>
                </td>
                <td class="py-4 px-6 text-center">
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded">{{ member.rank }}</span>
                </td>
                <td class="py-4 px-6 text-center">
                  <span
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full"
                    :class="statusBadge(member).cls"
                  >
                    <span
                      v-if="statusBadge(member).dot"
                      class="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"
                    />
                    <i v-else-if="member.status === 'self_scoring'" class="fas fa-edit text-[10px]" />
                    {{ statusBadge(member).label }}
                  </span>
                </td>
                <td class="py-4 px-6 text-center bg-slate-50">
                  <span class="font-bold text-slate-700">{{ member.selfScoreDisplay }}</span>
                </td>
                <td class="py-4 px-6 text-center bg-indigo-50/50">
                  <span
                    class="font-medium"
                    :class="liveLeaderPreview(member) === '—'
                      ? 'text-slate-300'
                      : 'text-indigo-700 font-bold'"
                  >{{ liveLeaderPreview(member) }}</span>
                </td>
                <td class="py-4 px-6 text-right" @click.stop>
                  <button
                    v-if="canExpandDetails(member)"
                    type="button"
                    class="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg border shadow-sm transition-colors w-full justify-between"
                    :class="expandedId === member.id
                      ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                      : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'"
                    @click="toggleExpand(member.id)"
                  >
                    <span>Xem chi tiết</span>
                    <i
                      class="fas fa-chevron-down text-xs transition-transform duration-200"
                      :class="expandedId === member.id ? 'rotate-180' : ''"
                    />
                  </button>
                  <button
                    v-else
                    type="button"
                    disabled
                    class="inline-flex items-center justify-center px-4 py-1.5 bg-white border border-slate-300 text-slate-600 text-xs font-bold rounded-lg shadow-sm opacity-50 cursor-not-allowed w-full"
                  >
                    {{ member.status === 'self_scoring' ? 'Chưa có sheet' : 'Không khả dụng' }}
                  </button>
                </td>
              </tr>

              <tr v-if="expandedId === member.id && getGroups(member).length">
                <td colspan="7" class="p-0 border-b-4 border-indigo-600">
                  <div class="bg-slate-100 p-4 md:p-8 shadow-inner">
                    <div
                      v-if="member.id !== '834' && member.groups.length === 0"
                      class="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3"
                    >
                      <i class="fas fa-info-circle mr-2" />
                      Đang dùng bộ KPI mẫu giống NV <strong>834</strong> để demo giao diện (mock).
                    </div>

                    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                      <div class="p-4 border-b border-slate-200 bg-slate-50/80 flex justify-between items-center">
                        <h3 class="font-bold text-slate-800 flex items-center gap-2">
                          <i class="fas fa-list-check text-indigo-600" />
                          Chi tiết các mục tiêu KPI
                        </h3>
                      </div>

                      <div class="overflow-x-auto">
                        <table class="w-full text-left">
                          <thead>
                            <tr class="bg-slate-100/50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                              <th class="py-4 px-4 w-10 text-center">
                                #
                              </th>
                              <th class="py-4 px-4 min-w-[200px]">
                                Hạng mục
                              </th>
                              <th class="py-4 px-4 text-center w-20">
                                Trọng số
                              </th>
                              <th class="py-4 px-4 text-center w-32">
                                Bằng chứng
                              </th>
                              <th class="py-4 px-4 text-center w-24">
                                Self
                              </th>
                              <th class="py-4 px-4 text-center w-32 bg-indigo-50/50 text-indigo-800 border-l border-indigo-100">
                                <span>PM Score</span>
                                <span class="block text-[10px] font-normal text-slate-500 normal-case">(chỉ xem)</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-slate-200 text-sm">
                            <template v-for="group in getGroups(member)" :key="group.label">
                              <tr class="bg-slate-50 border-y border-slate-200">
                                <td colspan="6" class="py-2.5 px-5 text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                                  {{ group.label }}
                                </td>
                              </tr>
                              <template v-for="line in group.lines" :key="line.id">
                                <tr class="hover:bg-slate-50/50 transition-colors">
                                  <td class="py-4 px-4 text-center font-bold text-slate-400">
                                    {{ line.index }}
                                  </td>
                                  <td class="py-4 px-4">
                                    <p class="font-bold text-slate-900">
                                      {{ line.title }}
                                    </p>
                                    <p class="text-[11px] text-slate-500">
                                      {{ line.subtitle }}
                                    </p>
                                  </td>
                                  <td class="py-4 px-4 text-center">
                                    <span class="bg-slate-100 px-2 py-1 rounded font-bold text-slate-700">{{ line.weight }}</span>
                                  </td>
                                  <td class="py-4 px-4 text-center">
                                    <button
                                      type="button"
                                      class="inline-flex items-center justify-between w-full px-3 py-1.5 border text-[11px] font-bold rounded-lg transition-colors shadow-sm"
                                      :class="line.evidenceVariant === 'blue'
                                        ? 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700'
                                        : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-700'"
                                      @click.stop="toggleEvidence(`${member.id}-${line.id}`)"
                                    >
                                      <span class="flex items-center gap-1.5">
                                        <i :class="[line.evidenceIcon, 'text-xs']" />
                                        {{ line.evidenceLabel }}
                                      </span>
                                      <i
                                        class="fas fa-chevron-down text-xs transition-transform duration-200"
                                        :class="openEvidence.has(`${member.id}-${line.id}`) ? 'rotate-180' : ''"
                                      />
                                    </button>
                                  </td>
                                  <td class="py-4 px-4 text-center">
                                    <div class="font-bold text-slate-500 bg-slate-100 px-2 py-1.5 rounded text-base inline-block min-w-[2.5rem]">
                                      {{ line.selfScore }}
                                    </div>
                                  </td>
                                  <td class="py-4 px-4 text-center bg-indigo-50/30 border-l border-indigo-50">
                                    <div
                                      class="inline-flex min-h-[2.75rem] min-w-[3rem] items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-50 px-2 text-base font-bold text-slate-800"
                                    >
                                      {{ leaderLineScore(member, line.id) }}
                                    </div>
                                  </td>
                                </tr>
                                <tr
                                  v-show="openEvidence.has(`${member.id}-${line.id}`)"
                                  class="bg-slate-100/50"
                                >
                                  <td colspan="6" class="p-0 border-b-2 border-indigo-200">
                                    <div
                                      class="p-5 border-l-4 bg-indigo-50/20"
                                      :class="line.evidenceDetail.accent === 'emerald' ? 'border-emerald-500' : 'border-indigo-500'"
                                    >
                                      <h4
                                        class="font-bold text-sm mb-3 flex items-center gap-2"
                                        :class="line.evidenceDetail.accent === 'emerald' ? 'text-emerald-900' : 'text-indigo-900'"
                                      >
                                        <i :class="[line.evidenceDetail.titleIcon, 'text-indigo-600']" />
                                        {{ line.evidenceDetail.title }}
                                      </h4>
                                      <div class="overflow-x-auto">
                                        <table class="w-full text-left text-sm bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                                          <thead class="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                                            <tr>
                                              <th
                                                v-for="(h, hi) in line.evidenceDetail.headers"
                                                :key="hi"
                                                class="p-3 border-b border-slate-200"
                                                :class="hi > 0 ? 'text-center' : ''"
                                              >
                                                {{ h }}
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody class="divide-y divide-slate-100">
                                            <tr v-for="(row, ri) in line.evidenceDetail.rows" :key="ri">
                                              <td
                                                v-for="(cell, ci) in row"
                                                :key="ci"
                                                class="p-3"
                                                :class="ci > 0 ? 'text-center text-slate-700' : 'font-medium'"
                                              >
                                                {{ cell }}
                                              </td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              </template>
                            </template>
                          </tbody>
                          <tfoot class="bg-slate-100/80 border-t-2 border-slate-200 font-bold text-sm">
                            <tr>
                              <td colspan="2" class="py-4 px-4 text-right text-slate-700 uppercase tracking-wider">
                                Tổng trọng số:
                              </td>
                              <td class="py-4 px-4 text-center text-slate-800">
                                {{ TOTAL_KPI_WEIGHT }} <span class="text-[10px]">pts</span>
                              </td>
                              <td colspan="3" />
                            </tr>
                            <span class="text-lg text-slate-700 font-bold">{{ weightedSelfAvg(getGroups(member)) }}</span>
                            <tr class="bg-slate-200/50 border-t border-slate-200">
                              <td colspan="4" class="py-4 px-4 text-right text-slate-700 uppercase tracking-wider">
                                Điểm TB tự chấm (Self-Avg):
                              </td>
                              <td class="py-4 px-4 text-center bg-white shadow-sm border-x border-slate-200">
                              </td>
                              <td />
                            </tr>
                            <tr class="bg-indigo-50 border-t border-slate-200">
                              <td colspan="4" class="py-5 px-4 text-right text-indigo-900 uppercase tracking-wider">
                                Điểm Trung Bình (PM Avg Score):
                              </td>
                               <td class="py-5 px-4 text-right text-indigo-900 uppercase tracking-wider">
                              </td>
                              <td class="py-5 px-4 text-center bg-indigo-100 shadow-inner">
                                <span class="text-xl text-indigo-700 font-black">{{ displayPmWeighted(member, getGroups(member)) }}</span>
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <div class="p-6 border-t border-slate-200 bg-slate-50/50">
                        <h4 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                          <i class="fas fa-comment text-indigo-600" />
                          Ghi chú (chỉ xem)
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div class="space-y-2">
                            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider">Nhân viên</label>
                            <div class="w-full min-h-[5rem] p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 whitespace-pre-wrap">
                              {{ member.employeeComment || '—' }}
                            </div>
                          </div>
                          <div class="space-y-2">
                            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider">PM / Quản lý</label>
                            <div class="w-full min-h-[5rem] p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">
                              {{ member.supervisorCommentSaved || '—' }}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>

              <tr v-else-if="expandedId === member.id && !getGroups(member).length">
                <td colspan="7" class="p-0 border-b border-slate-200">
                  <div class="bg-slate-100 p-8 text-center text-slate-600 text-sm">
                    <i class="fas fa-user-clock text-2xl mb-2 text-slate-400" />
                    <p>Chưa có bảng KPI chi tiết để xem (mock).</p>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
