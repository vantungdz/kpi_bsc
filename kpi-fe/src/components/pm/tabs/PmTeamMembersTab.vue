<script setup lang="ts">
import { ref, computed, watch, type PropType } from 'vue'
import { pmKpiService } from '@/services/modules/kpi-pm.service'

import { generateInitials } from '@/utils/common'
import { KPI_STATUS } from '@/config/constants'
import {
  countPmEvaluationSubjectsInHierarchy,
  isPmEvaluationSubject,
} from '@/utils/pmEvaluationSubject'

const props = defineProps({
  year: { type: [Number, String], required: true },
  /** Tăng sau khi gửi đánh giá / cần refetch cây team (không reload trang). */
  reloadNonce: { type: Number, default: 0 },
  kpisCache: { type: Object as PropType<Record<string, any[]>>, default: () => ({}) },
  commentsCache: {
    type: Object as PropType<Record<string, { main: string; promo: string } | string>>,
    default: () => ({}),
  },
  /** Đã gọi xong API pm-portfolio-evaluation-gate. */
  portfolioGateLoaded: { type: Boolean, default: false },
  /** true = mọi member đã nộp KPI Member (individual/team ≥501) cho PM — PM được gửi đánh giá lên GM tab KPI Member. */
  portfolioGateOpen: { type: Boolean, default: false },
  portfolioGatePending: {
    type: Array as PropType<{ userId: string; fullName: string }[]>,
    default: () => [],
  },
})

const emit = defineEmits(['open-member', 'pending-pm-evaluation-count'])

const teamTreeRaw = ref<any[]>([])
const isLoading = ref(false)

const EVALUATION_STATUS_UI: Record<number, any> = {
  [KPI_STATUS.INACTIVE]: { dot: 'bg-slate-300 ring-2 ring-slate-100', chip: 'border-slate-200 bg-slate-50 text-slate-800', label: 'Inactive' },
  [KPI_STATUS.WAITING_PM_APPROVAL]: { dot: 'bg-amber-400 ring-2 ring-amber-100', chip: 'border-amber-200 bg-amber-50 text-amber-950', label: 'Waiting PM approve' },
  [KPI_STATUS.WAITING_GM_APPROVAL]: { dot: 'bg-amber-400 ring-2 ring-amber-100', chip: 'border-amber-200 bg-amber-50 text-amber-950', label: 'Waiting GM approve' },
  [KPI_STATUS.PENDING_ACCEPTANCE]: { dot: 'bg-blue-400 ring-2 ring-blue-100', chip: 'border-blue-200 bg-blue-50 text-blue-950', label: 'Pending acceptance' },
  [KPI_STATUS.ACCEPTED]: { dot: 'bg-emerald-500 ring-2 ring-emerald-100', chip: 'border-emerald-200 bg-emerald-50 text-emerald-950', label: 'Accepted' },
  [KPI_STATUS.REJECTED]: { dot: 'bg-rose-500 ring-2 ring-rose-100', chip: 'border-rose-200 bg-rose-50 text-rose-950', label: 'Rejected' },

  [KPI_STATUS.FIRST_WAITING_PM_APPROVAL]: { dot: 'bg-amber-400 ring-2 ring-amber-100', chip: 'border-amber-200 bg-amber-50 text-amber-950', label: 'Waiting PM approve 1st Half' },
  [KPI_STATUS.FIRST_WAITING_GM_APPROVAL]: { dot: 'bg-amber-400 ring-2 ring-amber-100', chip: 'border-amber-200 bg-amber-50 text-amber-950', label: 'Waiting GM approve 1st Half' },
  [KPI_STATUS.FIRST_COMPLETED]: { dot: 'bg-emerald-500 ring-2 ring-emerald-100', chip: 'border-emerald-200 bg-emerald-50 text-emerald-950', label: 'Completed 1st Half' },

  [KPI_STATUS.SECOND_WAITING_PM_APPROVAL]: { dot: 'bg-amber-400 ring-2 ring-amber-100', chip: 'border-amber-200 bg-amber-50 text-amber-950', label: 'Waiting PM approve Final' },
  [KPI_STATUS.SECOND_WAITING_GM_APPROVAL]: { dot: 'bg-amber-400 ring-2 ring-amber-100', chip: 'border-amber-200 bg-amber-50 text-amber-950', label: 'Waiting GM approve Final' },
  [KPI_STATUS.COMPLETED]: { dot: 'bg-purple-500 ring-2 ring-purple-100', chip: 'border-purple-200 bg-purple-50 text-purple-950', label: 'Completed' },
}

/** Chip status chỉ khi có mã đã map; không có / chưa map → null (ô Status để trống). */
function getEvalStatusChip(statusCode: number | null | undefined) {
  if (statusCode == null || statusCode === 0) return null
  const n = Number(statusCode)
  return EVALUATION_STATUS_UI[n] ?? null
}

/** Chỉ ghi đè PM comment từ cache khi đã vào đợt đánh giá (≥501); tránh nhầm draft/localStorage khi KPI còn 404… */
const PM_COMMENT_CACHE_OVERLAY_MIN_STATUS = KPI_STATUS.FIRST_WAITING_PM_APPROVAL

function pmSupervisorDraftFromCache(nodeId: string): string {
  const raw = props.commentsCache[nodeId]
  if (raw === undefined || raw === null) return ''
  if (typeof raw === 'string') return raw
  const main = String(raw.main ?? '').trim()
  const promo = String(raw.promo ?? '').trim()
  if (main && promo) return `${main}\n${promo}`
  return main || promo
}

// Gọi API lấy danh sách Team
const fetchTeamHierarchy = async () => {
  isLoading.value = true
  try {
    const response = await pmKpiService.getTeamHierarchy(String(props.year || new Date().getFullYear()))

    const filterTree = (nodes: any[]): any[] => {
      return nodes.map(node => {
        const filteredChildren = node.children ? filterTree(node.children) : []
        const hasKpi = node.statusCode != null && node.statusCode !== 0
        if (hasKpi || filteredChildren.length > 0) {
          return { ...node, children: filteredChildren }
        }
        return null
      }).filter(Boolean)
    }

    teamTreeRaw.value = filterTree(response)
    emit(
      'pending-pm-evaluation-count',
      countPmEvaluationSubjectsInHierarchy(teamTreeRaw.value),
    )
  } catch (error) {
    console.error('Failed to fetch team hierarchy:', error)
    emit('pending-pm-evaluation-count', 0)
  } finally {
    isLoading.value = false
  }
}

watch(
  () => [props.year, props.reloadNonce] as const,
  () => {
    fetchTeamHierarchy()
  },
  { immediate: true },
)

// Convert tree structure to a flat list for table rendering, while keeping track of depth for indentation
const visibleTeamMembers = computed(() => {
  let result: any[] = [];
    const traverse = (node: any) => {
    // Clone to override pmScore with real-time cache if available
    const displayNode = { ...node }
    /** Giữ pm_comment từ BE trước khi ghi đè bằng draft localStorage — drawer cần để tránh nhầm sau khi đổi KPI. */
    displayNode.apiPmComment = node.pmComment ?? ''

    if (props.kpisCache && props.kpisCache[node.id]) {
      const kpis = props.kpisCache[node.id];
      const scoredKpis = kpis.filter((k: any) => k.pmScore != null);
      if (scoredKpis.length > 0) {
        displayNode.pmScore = scoredKpis.reduce((sum: number, k: any) => sum + k.pmScore, 0) / scoredKpis.length;
      }
    }

    const statusNum = node.statusCode != null ? Number(node.statusCode) : 0
    if (
      props.commentsCache &&
      props.commentsCache[node.id] !== undefined &&
      statusNum >= PM_COMMENT_CACHE_OVERLAY_MIN_STATUS
    ) {
      displayNode.pmComment = pmSupervisorDraftFromCache(node.id)
    }

    displayNode.statusChipUi = getEvalStatusChip(displayNode.statusCode)

    result.push(displayNode);
    if (node.expanded && node.children && node.children.length > 0) {
      node.children.forEach((child: any) => traverse(child));
    }
  };

  teamTreeRaw.value.forEach(root => traverse(root));
  return result;
})

// Calculate progress % based on raw statusCode milestones
const labelcalculateProgress = (statusCode: number | null): number => {
  if (!statusCode) return 0;
  if (statusCode >= KPI_STATUS.COMPLETED) return 100;
  if (statusCode >= KPI_STATUS.SECOND_WAITING_GM_APPROVAL) return 50;
  if (statusCode >= KPI_STATUS.FIRST_WAITING_GM_APPROVAL) return 20;
  return 0;
}

const getProgressColor = (progress: number) => {
  return progress >= 80 ? 'bg-emerald-500' : progress >= 50 ? 'bg-orange-400' : 'bg-rose-500'
}

// ACTIONS
const toggleMember = (member: any) => {
  member.expanded = !member.expanded
}

const openMemberDetail = (member: any) => {
  emit('open-member', {
    memberId: member.id,
    year: String(props.year ?? new Date().getFullYear()),
    ...member
  })
}

const portfolioGatePendingLabel = computed(() => {
  const list = props.portfolioGatePending ?? []
  return list
    .map((p) => String(p?.fullName ?? '').trim())
    .filter(Boolean)
    .join(' · ')
})
</script>

<template>
  <div class="animate-fade-in bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
    <div class="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
      <div>
        <h3 class="font-bold text-slate-800 text-lg flex items-center gap-2">
          <i class="fas fa-users text-slate-400"></i> Team Hierarchy & Performance
        </h3>
      </div>
    </div>

    <div
      v-if="portfolioGateLoaded && !portfolioGateOpen"
      class="px-5 py-3 border-b border-amber-100 bg-amber-50 text-sm text-amber-950"
    >
      <p class="font-semibold leading-snug">
        <i class="fas fa-user-clock mr-2 text-amber-600" aria-hidden="true" />
        Để gửi đánh giá KPI Member lên GM từng nhân viên, toàn bộ thành viên trong team phải đã nộp kết quả KPI Member
      </p>
      <p v-if="portfolioGatePendingLabel" class="mt-2 text-amber-900">
        Còn thiếu kết quả từ: <strong>{{ portfolioGatePendingLabel }}</strong>
      </p>
    </div>

    <div v-if="isLoading" class="p-10 text-center text-slate-500">
      <i class="fas fa-circle-notch fa-spin text-2xl text-purple-600 mb-3 block"></i>
      Loading...
    </div>

    <table v-else class="w-full text-left">
      <thead class="bg-white border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <tr>
          <th class="py-4 px-5 w-1/4">Employee Name & Role</th>
          <th class="py-4 px-5 text-center w-32">Self Score</th>
          <th class="py-4 px-5 text-center w-32">PM Score</th>
          <th class="py-4 px-5 min-w-[150px]">PM Comment</th>
          <th class="py-4 px-5 text-left w-48">Status</th>
        </tr>
      </thead>
      <TransitionGroup name="list" tag="tbody" class="divide-y divide-slate-100 relative">
        <tr v-for="member in visibleTeamMembers" :key="member.id"
          class="transition-colors cursor-pointer group"
          :class="[
            isPmEvaluationSubject(member)
              ? 'bg-amber-50 hover:bg-amber-100/90'
              : 'bg-white hover:bg-slate-50',
            !isPmEvaluationSubject(member) ? 'text-slate-500' : '',
          ]"
          :title="
            isPmEvaluationSubject(member)
              ? 'Đang chờ PM đánh giá: '
              : 'Không có KPI đang chờ PM đánh giá — chỉ hiển thị trong org chart.'
          "
          @click="openMemberDetail(member)">

          <td class="py-4 px-5 flex items-center gap-3 relative"
            :style="{ paddingLeft: (member.depth * 2.5 + 1.25) + 'rem' }">
            <div v-if="member.depth > 0" class="absolute top-0 bottom-0 w-px bg-slate-200"
              :style="{ left: ((member.depth - 1) * 2.5 + 2) + 'rem' }"></div>
            <div v-if="member.depth > 0" class="absolute top-1/2 h-px bg-slate-200"
              :style="{ left: ((member.depth - 1) * 2.5 + 2) + 'rem', width: '1.25rem' }"></div>

            <button @click.stop="toggleMember(member)"
              class="w-5 h-5 flex items-center justify-center rounded bg-slate-100 text-slate-400 hover:bg-purple-100 hover:text-purple-600 transition-colors z-10"
              :class="{ 'invisible': !member.children || member.children.length === 0 }">
              <i class="fas text-[10px]" :class="member.expanded ? 'fa-minus' : 'fa-plus'"></i>
            </button>

            <div
              class="w-9 h-9 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shadow-sm z-10 group-hover:border-purple-100 transition-all">
              {{ generateInitials(member.name) }}
            </div>

            <div class="z-10">
              <p class="text-sm font-bold text-slate-800">{{ member.name }}</p>
              <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">{{ member.role }}</p>
            </div>
          </td>

          <td class="py-4 px-5 text-center align-middle">
            <span class="text-sm font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg">
              {{ member.selfScore != null ? Number(member.selfScore).toFixed(1) : '-' }}
            </span>
          </td>
          <td class="py-4 px-5 text-center align-middle">
            <span class="text-sm font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-lg">
              {{ member.pmScore != null ? Number(member.pmScore).toFixed(1) : '-' }}
            </span>
          </td>
          <td class="py-4 px-5 align-middle">
            <div class="text-xs text-slate-600 line-clamp-2" :title="member.pmComment">
              {{ member.pmComment || '-' }}
            </div>
          </td>

          <td class="py-4 px-5 text-right align-middle">
            <div
              v-if="member.statusChipUi"
              class="ml-auto inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-center shadow-sm"
              :class="member.statusChipUi.chip">
              <span class="h-2 w-2 shrink-0 rounded-full" :class="member.statusChipUi.dot" />
              <span class="text-[10px] font-bold">{{ member.statusChipUi.label }}</span>
            </div>
          </td>

        </tr>

        <tr v-if="visibleTeamMembers.length === 0 && !isLoading" key="empty-state">
          <td colspan="5" class="py-8 text-center text-slate-500 text-sm">
            Don't have any team members in the list.
          </td>
        </tr>
      </TransitionGroup>
    </table>
  </div>
</template>

<style scoped>
/* Row expansion animation */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.list-leave-active {
  position: absolute;
  width: 100%;
}
</style>