<script setup lang="ts">
import {onMounted, ref} from "vue";
import {leaderKpiService} from "@/services/modules/kpi-leader.service";
import type {LeaderKpiInformationResponse} from "@/types/kpi";
import MemberPerformanceTab from "@/components/leader/tab/MemberPerformanceTab.vue";
import MemberPromotionTab from "@/components/leader/tab/MemberPromotionTab.vue";

const props = defineProps<{
  year: number;
}>();

// ==========================================
// STATES & FETCH DANH SÁCH MEMBER
// ==========================================
const loading = ref(true);
const members = ref<LeaderMember[]>([]);

async function fetchMembers() {
  loading.value = true;
  try {
    const response = await leaderKpiService.getMemberList();
    members.value = response.members || [];
  } catch (error) {
    console.error("Lỗi khi lấy danh sách Team Member:", error);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchMembers();
});

// ==========================================
// STATES & LOGIC DRAWER (KPI CHI TIẾT)
// ==========================================
const drawerOpen = ref(false);
const selectedMember = ref<LeaderMember | null>(null);
const activeTab = ref<"performance" | "promotion">("performance");
const individualData = ref<LeaderKpiInformationResponse | null>(null);
const promotionData = ref<LeaderKpiInformationResponse | null>(null);
const isFetchingKpi = ref(false);

async function handleMemberClick(member: LeaderMember) {
  selectedMember.value = member;
  drawerOpen.value = true;
  activeTab.value = 'performance';
  isFetchingKpi.value = true;

  try {
    const [indData, proData] = await Promise.all([
      leaderKpiService.getKpiInfo(props.year, 'INDIVIDUAL', member.memberId),
      leaderKpiService.getKpiInfo(props.year, 'PROMOTION', member.memberId)
    ]);
    individualData.value = indData;
    promotionData.value = proData;
  } catch (error) {
    console.error("Lỗi fetch member KPI:", error);
    individualData.value = null;
    promotionData.value = null;
  } finally {
    isFetchingKpi.value = false;
  }
}

function closeDrawer() {
  drawerOpen.value = false;
  selectedMember.value = null;
}

// ==========================================
// HELPER UI
// ==========================================
function getTeamMemberInitials(name?: string) {
  if (!name) return "NA";
  return name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
}
</script>

<template>
  <div class="relative min-h-[250px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div v-if="loading" class="absolute inset-0 bg-white/80 z-10 flex items-center justify-center backdrop-blur-sm">
      <i class="fas fa-spinner fa-spin text-emerald-500 text-3xl"></i>
    </div>

    <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
      <h3 class="flex items-center gap-2 text-lg font-bold text-slate-800">
        <i class="fas fa-users text-slate-400" />
        Danh sách Team Members
      </h3>
      <span class="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">
        {{ members.length }} members
      </span>
    </div>

    <table class="w-full border-collapse text-left text-sm">
      <thead>
      <tr class="border-b border-slate-200 bg-white text-xs font-bold uppercase tracking-wider text-slate-500">
        <th class="px-5 py-3">Thành viên</th>
        <th class="px-5 py-3">Vai trò</th>
        <th class="px-5 py-3">Cấp bậc</th>
        <th class="px-5 py-3 text-center">Điểm</th>
      </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
      <tr v-if="members.length === 0 && !loading">
        <td colspan="4" class="p-8 text-center text-slate-500">Chưa có thành viên nào trong nhóm.</td>
      </tr>

      <tr v-for="member in members" :key="member.memberId"
          class="group cursor-pointer transition-colors hover:bg-slate-50/80"
          @click="handleMemberClick(member)">
        <td class="px-5 py-4">
          <div class="flex items-center gap-3">
            <div
                class="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
              {{ getTeamMemberInitials(member.fullName) }}
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-800 group-hover:text-indigo-700">{{ member.fullName }}</p>
              <p class="text-xs text-slate-500">{{ member.email }}</p>
            </div>
          </div>
        </td>
        <td class="px-5 py-4 text-sm text-slate-600">{{ member.jobTitle || '-' }}</td>
        <td class="px-5 py-4">
          <p class="text-sm font-medium text-slate-700">{{ member.jobLevel || member.rank || '-' }}</p>
        </td>
        <td class="px-5 py-4 text-center font-bold text-slate-800">
          {{ member.score != null ? member.score.toFixed(2) : '-' }}
        </td>
      </tr>
      </tbody>
    </table>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="drawerOpen" class="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm transition-opacity"
             @click="closeDrawer"/>
      </Transition>
      <Transition name="slide">
        <aside v-if="drawerOpen && selectedMember"
               class="fixed right-0 top-0 z-[72] flex h-full w-full max-w-full flex-col border-l border-slate-200 bg-slate-50 shadow-2xl lg:w-[1100px] xl:w-[1280px]">
          <div
              class="relative z-20 flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div class="flex items-center gap-3 min-w-0">
              <div
                  class="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-base shrink-0">
                {{ getTeamMemberInitials(selectedMember.fullName) }}
              </div>
              <div class="min-w-0">
                <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Chi tiết KPI thành viên</p>
                <h2 class="mt-0.5 text-base font-bold text-slate-900 truncate">
                  {{ selectedMember.fullName }}
                </h2>
                <p class="text-xs text-slate-500">
                  {{ selectedMember.jobTitle || "" }}
                  <span v-if="selectedMember.jobTitle">·</span>
                  {{ selectedMember.jobLevel || selectedMember.rank || "" }}
                </p>
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <button type="button"
                      class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                      @click="closeDrawer">
                <i class="fas fa-times"/>
              </button>
            </div>
          </div>

          <div class="relative z-10 flex shrink-0 gap-6 border-b border-slate-200 bg-slate-50/80 px-5 pt-3 shadow-sm">
            <button type="button"
                    class="pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 outline-none"
                    :class="activeTab === 'performance' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'"
                    @click="activeTab = 'performance'">
              <i class="fas fa-sitemap"/> Performance
            </button>
            <button type="button"
                    class="pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 outline-none"
                    :class="activeTab === 'promotion' ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-800'"
                    @click="activeTab = 'promotion'">
              <i class="fas fa-arrow-trend-up"/> Promotion
            </button>
          </div>

          <div class="flex-1 overflow-y-auto bg-slate-50 relative">
            <div v-if="isFetchingKpi"
                 class="absolute inset-0 z-50 bg-white/70 flex items-center justify-center backdrop-blur-sm">
              <i class="fas fa-spinner fa-spin text-emerald-500 text-3xl"></i>
            </div>
            <MemberPerformanceTab v-if="activeTab === 'performance'" :member="selectedMember" :data="individualData"/>
            <MemberPromotionTab v-else-if="activeTab === 'promotion'" :member="selectedMember" :data="promotionData"/>
          </div>

          <div
              class="flex shrink-0 justify-end border-t border-slate-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] relative z-20">
            <button type="button"
                    class="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                    @click="closeDrawer">
              Đóng
            </button>
          </div>
        </aside>
      </Transition>
    </Teleport>
  </div>
</template>