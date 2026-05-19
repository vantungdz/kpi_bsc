<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuth } from "@/composables/useAuth";
import PmAssignKpiDrawer from "@/components/pm/drawers/PmAssignKpiDrawer.vue";
import { pmKpiService } from "@/services/modules/kpi-pm.service";
import type { GmKpiCycleOption } from "@/types/gm-kpi-cycle";

const route = useRoute();
const router = useRouter();
const { user, logout } = useAuth();

const navItems = [
  { name: "Dashboard", icon: "fas fa-chart-pie", to: "/pm/dashboard" },
];

const isActive = (path: string) => route.path.startsWith(path);

// State điều khiển Drawer tạo mới KPI
const showCreateDrawer = ref(false);
const cycleOptions = ref<GmKpiCycleOption[]>([]);
const selectedYear = ref<number>(new Date().getFullYear());

const selectedCycle = computed(() =>
  cycleOptions.value.find((cycle) => Number(cycle.year) === Number(selectedYear.value)) ?? null,
);

const canEditSelectedYear = computed(() => Number(selectedCycle.value?.statusCode) === 201);

async function loadCycleOptions() {
  try {
    const rows = await pmKpiService.getKpiCyclesForHeader();
    cycleOptions.value = Array.isArray(rows) ? rows : [];
    const queryYear = Number(route.query.year);
    const matchedQuery = cycleOptions.value.find((cycle) => Number(cycle.year) === queryYear);
    const openCycle = cycleOptions.value.find((cycle) => Number(cycle.statusCode) === 201);
    const currentCycle = cycleOptions.value.find((cycle) => Number(cycle.year) === new Date().getFullYear());
    selectedYear.value = Number(
      matchedQuery?.year ?? openCycle?.year ?? currentCycle?.year ?? cycleOptions.value[0]?.year ?? selectedYear.value,
    );
    await syncSelectedYearToRoute();
  } catch (error) {
    console.error("Failed to load PM KPI cycles", error);
  }
}

async function syncSelectedYearToRoute() {
  if (!route.path.startsWith("/pm")) return;
  const nextYear = String(selectedYear.value);
  if (String(route.query.year ?? "") === nextYear) return;
  await router.replace({
    query: {
      ...route.query,
      year: nextYear,
    },
  });
}

function openCreateDrawer() {
  if (!canEditSelectedYear.value) return;
  showCreateDrawer.value = true;
}

const handleKpiCreated = () => {
  window.dispatchEvent(new CustomEvent('pm-kpi-created'));
}

watch(selectedYear, () => {
  if (!canEditSelectedYear.value) {
    showCreateDrawer.value = false;
  }
  void syncSelectedYearToRoute();
});

watch(
  () => route.query.year,
  (year) => {
    const n = Number(year);
    if (Number.isFinite(n) && n > 0 && n !== selectedYear.value) {
      selectedYear.value = n;
    }
  },
);

onMounted(() => {
  void loadCycleOptions();
});
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <aside
      class="w-64 bg-white border-r border-slate-200 flex flex-col z-10 shrink-0 shadow-sm"
    >
      <div class="h-16 flex items-center px-6 border-b border-slate-200">
        <div
          class="bg-gradient-to-br from-purple-600 to-indigo-600 text-white p-1.5 rounded-lg shadow-md mr-3"
        >
          <i class="fas fa-bullseye text-sm" />
        </div>
        <div>
          <span class="text-lg font-bold text-slate-900 tracking-tight"
            >KPI System</span
          >
          <p
            class="text-[10px] text-slate-400 font-medium uppercase tracking-wider"
          >
            PM Portal
          </p>
        </div>
      </div>

      <nav class="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <p
          class="px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3"
        >
          Navigation
        </p>
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group border"
          :class="
            isActive(item.to)
              ? 'bg-purple-50 text-purple-700 border-purple-100 shadow-sm'
              : 'text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900 hover:border-slate-200'
          "
        >
          <span
            class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            :class="
              isActive(item.to)
                ? 'bg-purple-100 text-purple-600'
                : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
            "
          >
            <i :class="[item.icon, 'text-xs']" />
          </span>
          <span class="flex-1">{{ item.name }}</span>
          <span
            v-if="isActive(item.to)"
            class="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0"
          />
        </RouterLink>
      </nav>

      <div class="p-4 border-t border-slate-200">
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors text-xs font-medium"
          @click="logout"
        >
          <span
            class="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"
          >
            <i class="fas fa-sign-out-alt text-xs" />
          </span>
          Đăng xuất
        </button>
      </div>
    </aside>

    <main class="flex-1 flex flex-col h-screen min-w-0">
      <header
        class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-10"
      >
        <div>
          <p
            class="text-xs font-bold text-purple-600 uppercase tracking-widest"
          >
            PM Portal
          </p>
          <h2 class="text-xl font-bold text-slate-800">KPI Management</h2>
        </div>
        <div class="flex items-center gap-4">
          <select
            v-model.number="selectedYear"
            class="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm outline-none transition focus:border-purple-500"
            title="Evaluation cycle"
          >
            <option
              v-for="cycle in cycleOptions"
              :key="cycle.id"
              :value="cycle.year"
            >
              {{ cycle.name || `Evaluation cycle ${cycle.year}` }}
            </option>
          </select>
          <button
            :disabled="!canEditSelectedYear"
            :title="canEditSelectedYear ? undefined : 'Chỉ được tạo KPI trong kỳ đang mở.'"
            class="flex shrink-0 items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
            @click="openCreateDrawer"
          >
            <i class="fas fa-plus text-xs" /> Create KPI
          </button>

          <div class="text-right pl-4 border-l border-slate-200">
            <p class="text-sm font-bold text-slate-800">
              {{ user?.name ?? "–" }}
            </p>
            <p class="text-xs text-slate-500">{{ user?.rank ?? "PM" }}</p>
          </div>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto bg-slate-50 relative">
        <RouterView />
      </div>

      <PmAssignKpiDrawer 
        :open="showCreateDrawer" 
        mode="create" 
        :readonly="!canEditSelectedYear"
        @close="showCreateDrawer = false" 
        @refresh="handleKpiCreated" 
      />
    </main>
  </div>
</template>
