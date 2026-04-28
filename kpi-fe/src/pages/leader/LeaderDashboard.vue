<script setup lang="ts">
import {computed, ref} from "vue";
import CreateIndividualKpiDrawer from "@/components/leader/drawer/CreateIndividualKpiDrawer.vue";
import PromotionKpiTable from "@/components/leader/table/PromotionKpiTable.vue";
import TeamMemberTable from "@/components/leader/table/TeamMemberTable.vue";
import PersonalKpiTable from "@/components/leader/table/PersonalKpiTable.vue";
import YearSelectionDropdown from "@/components/leader/input/YearSelectionDropdown.vue";
import ProcessTimeline from "@/components/shared/ProcessTimeline.vue";
import {isReadonlyKpiYear} from "@/utils/kpi-year";

// ==========================================
// 1. CORE DASHBOARD STATE
// ==========================================
const selectedYear = ref(new Date().getFullYear());
const activeTab = ref<"personal" | "team" | "promotion">("personal");

// ==========================================
// 2. COMPUTED HELPERS
// ==========================================
const isReadonly = computed(() => isReadonlyKpiYear(selectedYear.value));

const currentYear = new Date().getFullYear();
const availableYears = Array.from({length: 5}, (_, i) => {
  const year = currentYear - 3 + i;
  return {
    value: year,
    label: `Năm ${year}`,
    isCurrent: year === currentYear,
  };
}).reverse();

// ==========================================
// 3. CREATE INDIVIDUAL KPI LOGIC
// ==========================================
const showCreateIndividualKpiDrawer = ref(false);
const personalTableKey = ref(0);

function onLeaderIndividualKpiSaved() {
  personalTableKey.value += 1;
}
</script>

<template>
  <div class="p-6 max-w-[1500px] mx-auto space-y-6 animate-fade-in">

    <div v-if="isReadonly"
         class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-4 shadow-sm">
      <div class="flex items-start gap-3 min-w-0">
        <div class="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-slate-200 text-slate-600">
          <i class="fas fa-lock text-lg"/>
        </div>
        <div class="min-w-0">
          <p class="font-bold text-sm text-slate-800">
            Chế độ chỉ xem (năm {{ selectedYear }})
          </p>
          <p class="text-sm mt-1 leading-snug text-slate-600">
            Bảng KPI cá nhân và drawer hiện đang bị khóa — không thể chỉnh sửa hay lưu dữ liệu.
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 shrink-0 justify-end">
        <span
            class="px-4 py-2 rounded-lg text-sm font-bold bg-slate-200/70 text-slate-500 border border-slate-300/50 cursor-not-allowed flex items-center gap-1.5">
          <i class="fas fa-eye text-xs"/> Chỉ xem
        </span>
      </div>
    </div>

    <div class="flex justify-between items-start mb-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">Leader Dashboard</h2>
        <p class="text-slate-500 text-sm mt-1">Tổng quan team và KPI cá nhân của Leader.</p>
      </div>
      <YearSelectionDropdown v-model="selectedYear" :years="availableYears"/>
    </div>

    <div class="mb-6">
      <ProcessTimeline :year="selectedYear"/>
    </div>

    <div
        class="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 bg-white rounded-t-xl shadow-sm px-2 -mt-2 mb-6">
      <div class="flex gap-2">
        <button
            type="button"
            class="px-5 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2"
            :class="activeTab === 'personal' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'"
            @click="activeTab = 'personal'"
        >
          <i class="fas fa-bullseye text-base"/> Personal KPI
        </button>
        <button
            type="button"
            class="px-5 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2"
            :class="activeTab === 'team' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'"
            @click="activeTab = 'team'"
        >
          <i class="fas fa-sitemap text-base"/> Team Members
        </button>
        <button
            type="button"
            class="px-5 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2"
            :class="activeTab === 'promotion' ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-800'"
            @click="activeTab = 'promotion'"
        >
          <i class="fas fa-arrow-trend-up text-base"/> Promotion KPI
        </button>
      </div>
      <button
          v-if="!isReadonly && activeTab === 'personal'"
          type="button"
          class="mb-2 mr-2 flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
          @click="showCreateIndividualKpiDrawer = true"
      >
        <i class="fas fa-plus text-xs" aria-hidden="true"/> Tạo KPI
      </button>
    </div>

    <CreateIndividualKpiDrawer
        v-model="showCreateIndividualKpiDrawer"
        :cycle-year="String(selectedYear)"
        @saved="onLeaderIndividualKpiSaved"
    />

    <div v-show="activeTab === 'team'"
         class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
            <i class="fas fa-users text-emerald-600"/> Team Performance Overview
          </h3>
          <p class="text-xs text-slate-500 mt-0.5">Nhấn vào thành viên để xem chi tiết KPI (chỉ xem).</p>
        </div>
      </div>
      <TeamMemberTable :year="selectedYear"/>
    </div>

    <div v-show="activeTab === 'promotion'" id="leader-my-kpi-section-promotion"
         class="max-w-375 mx-auto space-y-6 animate-fade-in scroll-mt-24">
      <PromotionKpiTable :year="selectedYear" :is-readonly="isReadonly"/>
    </div>

    <div v-show="activeTab === 'personal'" id="leader-my-kpi-section"
         class="max-w-[1500px] mx-auto space-y-6 animate-fade-in scroll-mt-24">
      <PersonalKpiTable :key="personalTableKey" :year="selectedYear" :is-readonly="isReadonly"/>
    </div>

  </div>
</template>