<script setup lang="ts">
import {computed, nextTick, onMounted, reactive, ref, watch} from "vue";
import {
  getLeaderMyKpiDisplayRows,
  getMockLeaderDashboard,
  LEADER_SELF_EVAL_WARN_DAYS,
  type LeaderMyKpiDisplayRow,
} from "@/mocks/leaderDashboard.mock";
import CreateIndividualKpiDrawer, {
  type CreateIndividualKpiPayload,
} from "@/components/kpi/CreateIndividualKpiDrawer.vue";
import {isReadonlyKpiYear} from "@/mocks/leaderManager.mock";
import type {LeaderKpiDashboard, MemberKpiEvaluationStatus,} from "@/types/kpi";
import PromotionKpiTable from "@/components/leader/table/PromotionKpiTable.vue";
import TeamMemberTable from "@/components/leader/table/TeamMemberTable.vue";
import PersonalKpiTable from "@/components/leader/table/PersonalKpiTable.vue";
import YearSelectionDropdown from "@/components/leader/input/YearSelectionDropdown.vue";
import ProcessTimeline from "@/components/shared/ProcessTimeline.vue";

const loading = ref(true);
const dashboardData = ref<LeaderKpiDashboard | null>(null);
const selectedYear = ref(new Date().getFullYear());
const activeTab = ref<"personal" | "team" | "promotion">("personal");

const leaderExtraKpiRows = ref<LeaderMyKpiDisplayRow[]>([]);
const showCreateIndividualKpiDrawer = ref(false);

const drawerOpen = ref(false);
const drawerRow = ref<LeaderMyKpiDisplayRow | null>(null);
/** Self score theo mã KPI (mock chỉnh trên UI khi không readonly) */
const selfScores = reactive<Record<string, number>>({});

const isReadonly = computed(() => isReadonlyKpiYear(selectedYear.value));

// Defined available years for selection (mock data)
const availableYears = [
  {value: 2026, label: "Năm 2026", isCurrent: true},
  {value: 2025, label: "Năm 2025", isCurrent: false},
];

const selfEvalUrgencyBanner = computed(() => {
  const d = dashboardData.value?.uiHints?.selfEvalDaysRemaining;
  if (d === undefined) return null;
  if (d < 0)
    return {
      kind: "critical" as const,
      days: d,
    };
  if (d <= LEADER_SELF_EVAL_WARN_DAYS)
    return {
      kind: "warning" as const,
      days: d,
    };
  return null;
});

type PendingEvidenceFile = { id: string; file: File };
type PendingEvidenceUrl = { id: string; url: string };

const pendingEvidenceFiles = ref<PendingEvidenceFile[]>([]);
const pendingEvidenceUrls = ref<PendingEvidenceUrl[]>([]);
const evidenceUrlDraft = ref("");
const evidenceNoteDraft = ref("");
const certificateOutcomeDraft = ref("");
const evidenceUploadHint = ref("");
const evidenceUrlHint = ref("");

function resetEvidenceDrafts() {
  pendingEvidenceFiles.value = [];
  pendingEvidenceUrls.value = [];
  evidenceUrlDraft.value = "";
  evidenceUploadHint.value = "";
  evidenceUrlHint.value = "";
  evidenceNoteDraft.value = "";
  certificateOutcomeDraft.value = "";
}

function loadDashboard() {
  loading.value = true;
  try {
    dashboardData.value = getMockLeaderDashboard(selectedYear.value);
  } finally {
    loading.value = false;
  }
}

onMounted(loadDashboard);
watch(selectedYear, () => {
  leaderExtraKpiRows.value = [];
  loadDashboard();
});

function onLeaderIndividualKpiSaved(payload: CreateIndividualKpiPayload) {
  if (!dashboardData.value) return;
  const n = leaderExtraKpiRows.value.length + 1;
  const code = `I.${n}`;
  const lineId = `ind-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const baseRows = getLeaderMyKpiDisplayRows(dashboardData.value.year);
  const maxIndex = Math.max(
      ...baseRows.map((r) => r.index),
      ...leaderExtraKpiRows.value.map((r) => r.index),
      0,
  );
  const hintParts = [`Đơn vị: ${payload.unit}`, payload.calculationSummary];
  if (payload.description) hintParts.push(payload.description);

  leaderExtraKpiRows.value.push({
    index: maxIndex + 1,
    lineId,
    caseLabel: "(I) IND",
    caseType: "general",
    caseBadgeClass: "bg-sky-100 text-sky-800",
    code,
    title: `${code} ${payload.kpiName}`,
    targetSummary: "—",
    targetHint: hintParts.join(" · "),
    weight: payload.weight,
    evidenceStatus: "missing",
    selfScore: null,
    evidenceDrawerName: payload.kpiName,
    evidenceTargetDesc:
        payload.description || `Individual KPI · ${payload.calculationSummary}`,
    evaluationStatus: "not_started",
    pmScore: null,
    evidenceNote: "",
    certificateOutcomeNote: undefined,
    groupBanner: undefined,
  });
  selfScores[code] = 1;
}

function openDrawer(row: LeaderMyKpiDisplayRow) {
  drawerRow.value = row;
  resetEvidenceDrafts();
  evidenceNoteDraft.value = row.evidenceNote ?? "";
  certificateOutcomeDraft.value = row.certificateOutcomeNote ?? "";
  drawerOpen.value = true;
}

function scrollToLeaderMyKpi() {
  activeTab.value = "personal";
  nextTick(() => {
    document
        .getElementById("leader-my-kpi-section")
        ?.scrollIntoView({behavior: "smooth", block: "start"});
  });
}

</script>

<template>
  <div class="p-6 max-w-[1500px] mx-auto space-y-6 animate-fade-in">
    <div v-if="loading" class="flex items-center justify-center py-24">
      <i class="fas fa-spinner fa-spin text-emerald-500 text-2xl mr-3"/>
      <span class="text-slate-500 font-medium">Đang tải dữ liệu...</span>
    </div>

    <template v-else-if="dashboardData">
      <!-- ── Alert: Urgency Banner — hiển thị TẠI TOP PAGE ────────────── -->
      <div
          v-if="selfEvalUrgencyBanner"
          class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border px-4 py-4 shadow-sm"
          :class="
          selfEvalUrgencyBanner.kind === 'critical'
            ? 'border-red-200 bg-red-50/90'
            : 'border-amber-200 bg-amber-50/90'
        "
      >
        <div class="flex items-start gap-3 min-w-0">
          <div
              class="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
              :class="
              selfEvalUrgencyBanner.kind === 'critical'
                ? 'bg-red-100 text-red-700'
                : 'bg-amber-100 text-amber-800'
            "
          >
            <i
                class="fas text-lg"
                :class="
                selfEvalUrgencyBanner.kind === 'critical'
                  ? 'fa-exclamation-circle'
                  : 'fa-clock'
              "
            />
          </div>
          <div class="min-w-0">
            <p
                class="font-bold text-sm"
                :class="
                selfEvalUrgencyBanner.kind === 'critical'
                  ? 'text-red-900'
                  : 'text-amber-950'
              "
            >
              {{
                selfEvalUrgencyBanner.kind === "critical"
                    ? "Đã quá hạn tự đánh giá KPI"
                    : "Kỳ đánh giá KPI đang diễn ra"
              }}
            </p>
            <p
                class="text-sm mt-1 leading-snug"
                :class="
                selfEvalUrgencyBanner.kind === 'critical'
                  ? 'text-red-900/90'
                  : 'text-amber-950/90'
              "
            >
              <template v-if="selfEvalUrgencyBanner.kind === 'warning'">
                Còn
                <strong>{{ selfEvalUrgencyBanner.days }} ngày</strong>
                để bạn tự đánh giá KPI.
              </template>
              <template v-else>
                Bạn đã trễ
                <strong>{{ Math.abs(selfEvalUrgencyBanner.days) }} ngày</strong>
                so với hạn tự đánh giá. Vui lòng hoàn tất ngay.
              </template>
            </p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 shrink-0 justify-end">
          <button
              type="button"
              class="px-4 py-2 rounded-lg text-sm font-bold text-white shadow-sm transition-colors"
              :class="
              selfEvalUrgencyBanner.kind === 'critical'
                ? 'bg-red-700 hover:bg-red-800'
                : 'bg-amber-800 hover:bg-amber-900'
            "
              @click="scrollToLeaderMyKpi"
          >
            Đánh giá ngay
          </button>
        </div>
      </div>

      <!-- ── Readonly Banner ────────────────────────────────────────────── -->
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
            <i class="fas fa-eye text-xs"/>
            Chỉ xem
          </span>
        </div>
      </div>

      <!-- ── Tiêu đề + chọn năm ─────────────────────────────────────────── -->
      <div class="flex justify-between items-start mb-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-800">Leader Dashboard</h2>
          <p class="text-slate-500 text-sm mt-1">
            Tổng quan team và KPI cá nhân của Leader.
          </p>
        </div>
        <YearSelectionDropdown
            v-model="selectedYear"
            :years="availableYears"
        />
      </div>

      <div class="mb-6">
        <ProcessTimeline
            :year="selectedYear"
        />
      </div>

      <!-- ── Tab bar: Personal KPI / Team Members + Tạo Individual KPI ───────── -->
      <div
          class="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 bg-white rounded-t-xl shadow-sm px-2 -mt-2 mb-6"
      >
        <div class="flex gap-2">
          <button
              type="button"
              class="px-5 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2"
              :class="
              activeTab === 'personal'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            "
              @click="activeTab = 'personal'"
          >
            <i class="fas fa-bullseye text-base"/>
            Personal KPI
          </button>
          <button
              type="button"
              class="px-5 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2"
              :class="
              activeTab === 'team'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            "
              @click="activeTab = 'team'"
          >
            <i class="fas fa-sitemap text-base"/>
            Team Members
          </button>
          <button
              type="button"
              class="px-5 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2"
              :class="
              activeTab === 'promotion'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            "
              @click="activeTab = 'promotion'"
          >
            <i class="fas fa-arrow-trend-up text-base"/>
            Promotion KPI
          </button>
        </div>
        <button
            v-if="!isReadonly"
            type="button"
            class="mb-2 mr-2 flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
            @click="showCreateIndividualKpiDrawer = true"
        >
          <i class="fas fa-plus text-xs" aria-hidden="true"/>
          Tạo KPI
        </button>
      </div>

      <CreateIndividualKpiDrawer
          v-model="showCreateIndividualKpiDrawer"
          :cycle-id="String(selectedYear)"
          @saved="onLeaderIndividualKpiSaved"
      />

      <!-- Team Performance Overview -->
      <div
          v-show="activeTab === 'team'"
          class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6"
      >
        <div
            class="px-5 py-4 border-b border-slate-100 flex items-center justify-between"
        >
          <div>
            <h3
                class="text-base font-bold text-slate-900 flex items-center gap-2"
            >
              <i class="fas fa-users text-emerald-600"/>
              Team Performance Overview
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">
              Nhấn vào thành viên để xem chi tiết KPI (chỉ xem).
            </p>
          </div>
        </div>

        <TeamMemberTable :year="selectedYear"/>
      </div>

      <!-- Promotion KPI -->
      <div
          v-show="activeTab === 'promotion'"
          id="leader-my-kpi-section-promotion"
          class="max-w-375 mx-auto space-y-6 animate-fade-in scroll-mt-24"
      >
        <PromotionKpiTable
            :year="selectedYear"
            :is-readonly="isReadonly"
            @open-drawer="openDrawer"
        />
      </div>

      <!-- Chi Tiết Bảng KPI Cá Nhân — theo prototype HTML (Member View) -->
      <div
          v-show="activeTab === 'personal'"
          id="leader-my-kpi-section"
          class="max-w-[1500px] mx-auto space-y-6 animate-fade-in scroll-mt-24"
      >
        <PersonalKpiTable
            :year="selectedYear"
            :is-readonly="isReadonly"
            @open-drawer="openDrawer"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>

</style>
