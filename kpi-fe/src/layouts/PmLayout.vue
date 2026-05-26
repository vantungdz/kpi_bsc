<script setup lang="ts">

import { computed, onMounted, onUnmounted, provide, ref, watch } from "vue";

import { useRoute, useRouter } from "vue-router";

import { useAuth } from "@/composables/useAuth";

import PmAssignKpiDrawer from "@/components/pm/drawers/PmAssignKpiDrawer.vue";

import { pmKpiService } from "@/services/modules/kpi-pm.service";

import type { GmKpiCycleOption } from "@/types/gm-kpi-cycle";

import type { GmPromotionCycleOption } from "@/types/gm-promotion-cycle";

import {

  PM_CREATE_KPI_ALLOWED_EVENT,

  type PmCreateKpiAllowedDetail,

} from "@/utils/pmCreateKpiGate";

import { formatPromotionCycleOptionLabel } from "@/utils/promotion-timeline";

import {

  pmHeaderShowsPromotionCycleKey,

  pmSelectedPromotionCycleIdKey,

} from "@/utils/pmLayoutPromotionCycle";



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



/** Tab KPI Promotion — ẩn dropdown kpi_cycles, hiện promotion_cycles. */

const pmHeaderShowsPromotionCycle = ref(false);

const pmPromotionCycleRows = ref<GmPromotionCycleOption[]>([]);

const selectedPromotionCycleId = ref("");

const promotionCyclesHeaderLoading = ref(false);



provide(pmHeaderShowsPromotionCycleKey, pmHeaderShowsPromotionCycle);

provide(pmSelectedPromotionCycleIdKey, selectedPromotionCycleId);



const pmPromotionCycleSelectOptions = computed(() =>

  pmPromotionCycleRows.value.map((r) => ({

    id: r.id,

    label: formatPromotionCycleOptionLabel(r),

  })),

);



const activePromotionCycleLabel = computed(() => {

  const row = pmPromotionCycleRows.value.find(

    (c) => c.id === selectedPromotionCycleId.value,

  );

  return row ? formatPromotionCycleOptionLabel(row) : "";

});



const selectedCycle = computed(() =>

  cycleOptions.value.find((cycle) => Number(cycle.year) === Number(selectedYear.value)) ?? null,

);



const canEditSelectedYear = computed(() => Number(selectedCycle.value?.statusCode) === 201);



/** Gate từ tab KPI Personal — mặc định khóa đến khi portfolio load xong. */

const pmPortfolioCreateGateLoaded = ref(false);

const canCreatePmKpiByPortfolio = ref(false);



const canUseCreateKpiButton = computed(
  () =>
    canEditSelectedYear.value &&
    pmPortfolioCreateGateLoaded.value &&
    canCreatePmKpiByPortfolio.value,
);



const createKpiButtonTitle = computed(() => {

  if (!canEditSelectedYear.value) {

    return "Only create KPI in the current cycle.";

  }

  if (!pmPortfolioCreateGateLoaded.value) {

    return "Loading KPI list…";

  }

  if (!canCreatePmKpiByPortfolio.value) {

    return "Only create KPI when there is no Personal KPI, or every Personal KPI is Pending Acceptance (404) or Rejected by GM (406)";

  }

  return undefined;

});



function onPmCreateKpiAllowed(ev: Event) {

  const detail = (ev as CustomEvent<PmCreateKpiAllowedDetail>).detail;

  if (!detail || Number(detail.year) !== Number(selectedYear.value)) return;

  pmPortfolioCreateGateLoaded.value = true;

  canCreatePmKpiByPortfolio.value = Boolean(detail.allowed);

}



function resetPmPortfolioCreateGate() {

  pmPortfolioCreateGateLoaded.value = false;

  canCreatePmKpiByPortfolio.value = false;

}



async function loadCycleOptions() {

  try {

    const rows = await pmKpiService.getKpiCyclesForHeader();

    cycleOptions.value = Array.isArray(rows) ? rows : [];

    const queryYear = Number(route.query.year);

    const matchedQuery = cycleOptions.value.find((cycle) => Number(cycle.year) === queryYear);

    const openCycle = cycleOptions.value.find((cycle) => Number(cycle.statusCode) === 201);

    const currentCycle = cycleOptions.value.find(

      (cycle) => Number(cycle.year) === new Date().getFullYear(),

    );

    selectedYear.value = Number(

      matchedQuery?.year ?? openCycle?.year ?? currentCycle?.year ?? cycleOptions.value[0]?.year ?? selectedYear.value,

    );

    await syncSelectedYearToRoute();

  } catch (error) {

    console.error("Failed to load PM KPI cycles", error);

  }

}



async function loadPmHeaderPromotionCycles() {

  const year = Number(selectedYear.value);

  if (!Number.isFinite(year) || year <= 0) {

    pmPromotionCycleRows.value = [];

    return;

  }

  promotionCyclesHeaderLoading.value = true;

  try {

    const rows = await pmKpiService.getPromotionCycles(year);

    pmPromotionCycleRows.value = Array.isArray(rows) ? rows : [];

  } catch (error) {

    console.error("Failed to load PM promotion cycles", error);

    pmPromotionCycleRows.value = [];

  } finally {

    promotionCyclesHeaderLoading.value = false;

  }

}



watch(pmPromotionCycleRows, (rows) => {

  if (!rows.length) {

    selectedPromotionCycleId.value = "";

    return;

  }

  const cur = String(selectedPromotionCycleId.value ?? "").trim();

  if (cur && rows.some((r) => r.id === cur)) return;

  selectedPromotionCycleId.value = rows[0]!.id;

});



watch(

  () => [pmHeaderShowsPromotionCycle.value, selectedYear.value] as const,

  ([showPromo, year]) => {

    if (!showPromo || !year) return;

    void loadPmHeaderPromotionCycles();

  },

  { immediate: true },

);



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

  if (!canUseCreateKpiButton.value) return;

  showCreateDrawer.value = true;

}



const handleKpiCreated = () => {

  window.dispatchEvent(new CustomEvent("pm-kpi-created"));

};



watch(selectedYear, () => {

  if (!canEditSelectedYear.value) {

    showCreateDrawer.value = false;

  }

  resetPmPortfolioCreateGate();

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

  window.addEventListener(PM_CREATE_KPI_ALLOWED_EVENT, onPmCreateKpiAllowed);

  void loadCycleOptions();

});



onUnmounted(() => {

  window.removeEventListener(PM_CREATE_KPI_ALLOWED_EVENT, onPmCreateKpiAllowed);

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

          Logout

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

          <p

            v-if="pmHeaderShowsPromotionCycle && activePromotionCycleLabel"

            class="mt-0.5 text-xs font-medium text-slate-500"

          >

            Promotion:

            <span class="text-slate-700">{{ activePromotionCycleLabel }}</span>

          </p>

        </div>

        <div class="flex items-center gap-4">

          <div

            v-if="!pmHeaderShowsPromotionCycle"

            class="flex items-center gap-2"

          >

            <label

              for="pm-kpi-cycle-select"

              class="whitespace-nowrap text-xs font-bold text-slate-500"

              >Cycle</label

            >

            <select

              id="pm-kpi-cycle-select"

              v-model.number="selectedYear"

              class="h-9 min-w-[11rem] rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-xs font-bold text-slate-700 shadow-sm outline-none transition focus:border-purple-500"

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

          </div>

          <div

            v-else

            class="flex items-center gap-2"

          >

            <label

              for="pm-promotion-cycle-select"

              class="whitespace-nowrap text-xs font-bold text-slate-500"

              >Promotion cycle</label

            >

            <select

              id="pm-promotion-cycle-select"

              v-model="selectedPromotionCycleId"

              class="h-9 min-w-[12rem] max-w-[18rem] rounded-lg border border-violet-200 bg-white pl-3 pr-8 text-xs font-bold text-slate-700 shadow-sm outline-none transition focus:border-violet-500"

              :disabled="

                promotionCyclesHeaderLoading ||

                pmPromotionCycleSelectOptions.length === 0

              "

            >

              <option

                v-if="pmPromotionCycleSelectOptions.length === 0"

                value=""

              >

                {{

                  promotionCyclesHeaderLoading

                    ? "Loading…"

                    : "No promotion cycles"

                }}

              </option>

              <option

                v-for="c in pmPromotionCycleSelectOptions"

                :key="c.id"

                :value="c.id"

              >

                {{ c.label }}

              </option>

            </select>

          </div>

          <button

            :disabled="!canUseCreateKpiButton"

            :title="createKpiButtonTitle"

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


