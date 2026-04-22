<script setup lang="ts">
import { ref, onMounted, watch, computed, reactive, nextTick } from "vue";
import {
  getMockLeaderDashboard,
  getLeaderMyKpiDisplayRows,
  getTeamMemberKpiPanelGroups,
  getTeamMemberPromotionKpiItems,
  LEADER_SELF_EVAL_WARN_DAYS,
  type LeaderMyKpiDisplayRow,
  type TeamMemberKpiPanelGroup,
} from "@/mocks/leaderDashboard.mock";
import CreateIndividualKpiDrawer, {
  type CreateIndividualKpiPayload,
} from "@/components/kpi/CreateIndividualKpiDrawer.vue";
import { isReadonlyKpiYear } from "@/mocks/leaderManager.mock";
import type {
  LeaderKpiDashboard,
  LeaderTeamMember,
  KpiItem,
  MemberKpiEvaluationStatus,
} from "@/types/kpi";
import PromotionKpiTable from "./components/PromotionKpiTable.vue";
import MemberPromotionTab from "./components/MemberPromotionTab.vue";
import MemberPerformanceTab from "./components/MemberPerformanceTab.vue";
import TeamMemberTable from "./components/TeamMemberTable.vue";
import PersonalKpiTable from "./components/PersonalKpiTable.vue";

const loading = ref(true);
const dashboardData = ref<LeaderKpiDashboard | null>(null);
const selectedYear = ref(new Date().getFullYear());
const activeTab = ref<"personal" | "team" | "promotion">("personal");
const memberDrawerActiveTab = ref<"performance" | "promotion">("performance");

const leaderExtraKpiRows = ref<LeaderMyKpiDisplayRow[]>([]);
const showCreateIndividualKpiDrawer = ref(false);

const drawerOpen = ref(false);
const drawerRow = ref<LeaderMyKpiDisplayRow | null>(null);
/** Self score theo mã KPI (mock chỉnh trên UI khi không readonly) */
const selfScores = reactive<Record<string, number>>({});

/** Right-side drawer: KPI chi tiết thành viên (giống PM — chỉ xem) */
const leaderMemberDrawerOpen = ref(false);
const leaderMemberDrawerMember = ref<LeaderTeamMember | null>(null);
/** Drawer chỉ xem: KPI Promotion (nhóm P) của một thành viên */
const promotionMemberDrawerMember = ref<LeaderTeamMember | null>(null);
const openMemberEvidence = reactive<Record<string, boolean>>({});

const isReadonly = computed(() => isReadonlyKpiYear(selectedYear.value));

const myKpiRows = computed(() => {
  if (!dashboardData.value) return [];
  const base = getLeaderMyKpiDisplayRows(dashboardData.value.year);
  const extras = leaderExtraKpiRows.value.map((r, i) => ({
    ...r,
    groupBanner: i === 0 ? "(I) Individual KPI (tự tạo)" : undefined,
  }));
  return [...base, ...extras];
});

const pendingMyKpiCount = computed(
  () => myKpiRows.value.filter((r) => r.evaluationStatus !== "approved").length,
);

/** Tổng trọng số & điểm self / PM có trọng số (bảng Chi tiết KPI cá nhân) */
const myKpiTotals = computed(() => {
  let totalWeight = 0;
  let weighted = 0;
  let pmWeighted = 0;
  let pmWeightSum = 0;
  for (const r of myKpiRows.value) {
    totalWeight += r.weight;
    const s = selfScores[r.code] ?? r.selfScore ?? 1;
    weighted += s * r.weight;
    if (r.pmScore != null) {
      pmWeighted += r.pmScore * r.weight;
      pmWeightSum += r.weight;
    }
  }
  const averageScore = totalWeight > 0 ? weighted / totalWeight : 0;
  const averagePmScore = pmWeightSum > 0 ? pmWeighted / pmWeightSum : null;
  return {
    totalWeight,
    weightedSelfPoints: Math.round(weighted * 10) / 10,
    averageScore,
    averagePmScore:
      averagePmScore !== null ? Math.round(averagePmScore * 100) / 100 : null,
  };
});

const leaderKpiEmployeeComment = ref("");
const leaderKpiSupervisorComment = ref("");

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

const uploadOnlyMode = computed(
  () => drawerRow.value?.caseType === "upload_only",
);

const attachmentHubTitle = computed(() =>
  uploadOnlyMode.value
    ? "Chứng chỉ / Bằng cấp Đính kèm"
    : "Tài liệu Minh chứng Đính kèm (Bổ trợ)",
);

const EVIDENCE_MAX_FILES = 5;
const EVIDENCE_MAX_URLS = 5;
const EVIDENCE_ACCEPT_ATTR = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png";

type PendingEvidenceFile = { id: string; file: File };
type PendingEvidenceUrl = { id: string; url: string };

const pendingEvidenceFiles = ref<PendingEvidenceFile[]>([]);
const pendingEvidenceUrls = ref<PendingEvidenceUrl[]>([]);
const evidenceUrlDraft = ref("");
const evidenceNoteDraft = ref("");
const certificateOutcomeDraft = ref("");
const evidenceUploadHint = ref("");
const evidenceUrlHint = ref("");

const allowedEvidenceExtensions = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "jpg",
  "jpeg",
  "png",
]);

const allowedEvidenceMimes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/jpeg",
  "image/png",
]);

function isEvidenceFileAllowed(file: File): boolean {
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase()
    : "";
  if (ext && allowedEvidenceExtensions.has(ext)) return true;
  return !!file.type && allowedEvidenceMimes.has(file.type);
}

function formatEvidenceFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function onEvidenceFilesChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const picked = input.files ? Array.from(input.files) : [];
  input.value = "";
  if (!picked.length) return;
  evidenceUploadHint.value = "";
  let slot = EVIDENCE_MAX_FILES - pendingEvidenceFiles.value.length;
  if (slot <= 0) {
    evidenceUploadHint.value = `Đã đủ ${EVIDENCE_MAX_FILES} file. Xóa bớt để thêm file mới.`;
    return;
  }
  const rejected: string[] = [];
  let truncated = false;
  for (const file of picked) {
    if (slot <= 0) {
      truncated = true;
      break;
    }
    if (!isEvidenceFileAllowed(file)) {
      rejected.push(file.name);
      continue;
    }
    pendingEvidenceFiles.value.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
    });
    slot--;
  }
  const parts: string[] = [];
  if (rejected.length)
    parts.push(
      `Loại file không hỗ trợ (PDF, Word, Excel, CSV, JPG, PNG): ${rejected.join(", ")}`,
    );
  if (truncated)
    parts.push(
      `Chỉ được tối đa ${EVIDENCE_MAX_FILES} file; một số file chưa được thêm.`,
    );
  if (parts.length) evidenceUploadHint.value = parts.join(" ");
}

function removePendingEvidenceFile(id: string) {
  pendingEvidenceFiles.value = pendingEvidenceFiles.value.filter(
    (f) => f.id !== id,
  );
}

function normalizeEvidenceUrlInput(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function isValidEvidenceHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function addPendingEvidenceUrl() {
  evidenceUrlHint.value = "";
  const normalized = normalizeEvidenceUrlInput(evidenceUrlDraft.value);
  if (!normalized) {
    evidenceUrlHint.value = "Nhập URL (http hoặc https).";
    return;
  }
  if (!isValidEvidenceHttpUrl(normalized)) {
    evidenceUrlHint.value =
      "URL không hợp lệ. Ví dụ: https://drive.google.com/...";
    return;
  }
  if (pendingEvidenceUrls.value.length >= EVIDENCE_MAX_URLS) {
    evidenceUrlHint.value = `Tối đa ${EVIDENCE_MAX_URLS} URL. Xóa bớt để thêm.`;
    return;
  }
  if (pendingEvidenceUrls.value.some((x) => x.url === normalized)) {
    evidenceUrlHint.value = "URL này đã có trong danh sách.";
    return;
  }
  pendingEvidenceUrls.value.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    url: normalized,
  });
  evidenceUrlDraft.value = "";
}

function removePendingEvidenceUrl(id: string) {
  pendingEvidenceUrls.value = pendingEvidenceUrls.value.filter(
    (u) => u.id !== id,
  );
}

function onEvidenceUrlDraftKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();
    addPendingEvidenceUrl();
  }
}

const hasEvidenceAttachments = computed(
  () =>
    pendingEvidenceFiles.value.length > 0 ||
    pendingEvidenceUrls.value.length > 0,
);

function resetEvidenceDrafts() {
  pendingEvidenceFiles.value = [];
  pendingEvidenceUrls.value = [];
  evidenceUrlDraft.value = "";
  evidenceUploadHint.value = "";
  evidenceUrlHint.value = "";
  evidenceNoteDraft.value = "";
  certificateOutcomeDraft.value = "";
}

watch(
  dashboardData,
  (d) => {
    if (!d) return;
    for (const r of getLeaderMyKpiDisplayRows(d.year)) {
      selfScores[r.code] = r.selfScore ?? 1;
    }
  },
  { immediate: true },
);

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

function openLeaderMemberDrawer(member: LeaderTeamMember) {
  closePromotionMemberDrawer();
  leaderMemberDrawerMember.value = member;
  leaderMemberDrawerOpen.value = true;
}

function closeLeaderMemberDrawer() {
  leaderMemberDrawerOpen.value = false;
  leaderMemberDrawerMember.value = null;
}

function openPromotionMemberDrawer(member: LeaderTeamMember) {
  closeLeaderMemberDrawer();
  promotionMemberDrawerMember.value = member;
}

function closePromotionMemberDrawer() {
  promotionMemberDrawerMember.value = null;
}

function resolveKpiItemEvalStatus(item: KpiItem): MemberKpiEvaluationStatus {
  return item.evaluationStatus ?? "not_started";
}

function stripHtmlTarget(s: string): string {
  const t = s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return t || "—";
}

function formatPromotionActualResult(item: KpiItem): string {
  const r = item.result?.toString().trim();
  if (r) return r.length > 80 ? `${r.slice(0, 79)}…` : r;
  const a = item.actual?.toString().trim();
  if (a) return a.length > 80 ? `${a.slice(0, 79)}…` : a;
  return "—";
}

function promotionMetricsForMemberId(memberId: string) {
  const items = getTeamMemberPromotionKpiItems(memberId);
  const weightSum = items.reduce((s, i) => s + i.weight, 0);
  const rowsSelf = items.filter((i) => i.selfScore !== null);
  let selfAvg: number | null = null;
  if (rowsSelf.length) {
    let num = 0;
    let den = 0;
    for (const i of rowsSelf) {
      num += (i.selfScore ?? 0) * i.weight;
      den += i.weight;
    }
    selfAvg = den ? num / den : null;
  }
  const rowsPm = items.filter((i) => i.pmScore !== null);
  let pmAvg: number | null = null;
  if (rowsPm.length) {
    let num = 0;
    let den = 0;
    for (const i of rowsPm) {
      num += (i.pmScore ?? 0) * i.weight;
      den += i.weight;
    }
    pmAvg = den ? num / den : null;
  }
  return {
    count: items.length,
    weightSum,
    selfAvg,
    pmAvg,
  };
}

const promotionDrawerItems = computed(() => {
  const m = promotionMemberDrawerMember.value;
  if (!m) return [] as KpiItem[];
  return getTeamMemberPromotionKpiItems(m.id);
});

const leaderPromotionOverviewRows = computed(() => {
  if (!dashboardData.value) return [];
  return dashboardData.value.teamMembers.map((member) => ({
    member,
    ...promotionMetricsForMemberId(member.id),
  }));
});

const promotionDrawerFooter = computed(() => {
  const items = promotionDrawerItems.value;
  const weightSum = items.reduce((s, i) => s + i.weight, 0);
  const rowsSelf = items.filter((i) => i.selfScore !== null);
  let selfAvg: number | null = null;
  if (rowsSelf.length) {
    let num = 0;
    let den = 0;
    for (const i of rowsSelf) {
      num += (i.selfScore ?? 0) * i.weight;
      den += i.weight;
    }
    selfAvg = den ? num / den : null;
  }
  const rowsPm = items.filter((i) => i.pmScore !== null);
  let pmAvg: number | null = null;
  if (rowsPm.length) {
    let num = 0;
    let den = 0;
    for (const i of rowsPm) {
      num += (i.pmScore ?? 0) * i.weight;
      den += i.weight;
    }
    pmAvg = den ? num / den : null;
  }
  return { weightSum, selfAvg, pmAvg };
});

function getTeamMemberInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const SHEET_STATUS_UI: Record<
  string,
  { label: string; dot: string; badge: string }
> = {
  approved: {
    label: "Đã duyệt",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  submitted: {
    label: "Đã nộp",
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-800 border-blue-200",
  },
  draft: {
    label: "Bản nháp",
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-900 border-amber-200",
  },
};

function getSheetStatusUi(status: string) {
  return (
    SHEET_STATUS_UI[status] ?? {
      label: status,
      dot: "bg-slate-400",
      badge: "bg-slate-50 text-slate-700 border-slate-200",
    }
  );
}

function getProgressColor(pct: number) {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-blue-500";
  if (pct >= 30) return "bg-amber-400";
  return "bg-red-400";
}

function getMemberKpiGroups(
  member: LeaderTeamMember,
): TeamMemberKpiPanelGroup[] {
  return getTeamMemberKpiPanelGroups(member.id);
}

function memberEvidenceKey(memberId: string, lineId: string) {
  return `${memberId}:${lineId}`;
}

function toggleMemberEvidence(memberId: string, lineId: string) {
  const k = memberEvidenceKey(memberId, lineId);
  openMemberEvidence[k] = !openMemberEvidence[k];
}

function isMemberEvidenceOpen(memberId: string, lineId: string) {
  return !!openMemberEvidence[memberEvidenceKey(memberId, lineId)];
}

function openDrawer(row: LeaderMyKpiDisplayRow) {
  drawerRow.value = row;
  resetEvidenceDrafts();
  evidenceNoteDraft.value = row.evidenceNote ?? "";
  certificateOutcomeDraft.value = row.certificateOutcomeNote ?? "";
  drawerOpen.value = true;
}

function closeDrawer() {
  drawerOpen.value = false;
  drawerRow.value = null;
  resetEvidenceDrafts();
}

function closeAnyOverlay() {
  closeDrawer();
  closeLeaderMemberDrawer();
  closePromotionMemberDrawer();
}

function scrollToLeaderMyKpi() {
  activeTab.value = "personal";
  nextTick(() => {
    document
      .getElementById("leader-my-kpi-section")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function submitLeaderKpiEvaluationToPm() {
  if (isReadonly.value) return;
  console.log("Submit Đánh Giá lên PM (mock)", {
    totals: myKpiTotals.value,
    employeeComment: leaderKpiEmployeeComment.value,
    supervisorComment: leaderKpiSupervisorComment.value,
  });
}

function leaderTeamListQuery() {
  return {
    name: "leader-team" as const,
    query: { year: String(selectedYear.value) },
  };
}

function actionBtnClass() {
  return "w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors mx-auto";
}

function actionIcon() {
  return "fas fa-pen";
}

function sheetStatusVi(status: string) {
  if (status === "approved") return "Đã duyệt sheet";
  if (status === "submitted") return "Đã nộp chờ duyệt";
  if (status === "draft") return "Bản nháp";
  return status || "—";
}

/** Đồng bộ MemberDashboard — dot = nền + ring Tailwind; chip = khung badge */
const LEADER_EVALUATION_STATUS_UI: Record<
  MemberKpiEvaluationStatus,
  { dot: string; chip: string; labelVi: string; labelEn: string }
> = {
  not_started: {
    dot: "bg-slate-300 ring-2 ring-slate-100",
    chip: "border-slate-200 bg-slate-50 text-slate-800",
    labelVi: "Chưa đánh giá",
    labelEn: "Not Started",
  },
  pending_approval: {
    dot: "bg-amber-400 ring-2 ring-amber-100",
    chip: "border-amber-200 bg-amber-50 text-amber-950",
    labelVi: "Chờ duyệt",
    labelEn: "Pending Approval",
  },
  approved: {
    dot: "bg-emerald-500 ring-2 ring-emerald-100",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-950",
    labelVi: "Đã duyệt",
    labelEn: "Approved",
  },
  revision: {
    dot: "bg-orange-500 ring-2 ring-orange-100",
    chip: "border-orange-200 bg-orange-50 text-orange-950",
    labelVi: "Cần làm lại",
    labelEn: "Revision",
  },
  overdue: {
    dot: "bg-rose-600 ring-2 ring-rose-100",
    chip: "border-rose-200 bg-rose-50 text-rose-950",
    labelVi: "Quá hạn",
    labelEn: "Overdue",
  },
};

function leaderEvalUi(s: MemberKpiEvaluationStatus) {
  return LEADER_EVALUATION_STATUS_UI[s];
}
</script>

<template>
  <div class="p-6 max-w-[1500px] mx-auto space-y-6 animate-fade-in">
    <div v-if="loading" class="flex items-center justify-center py-24">
      <i class="fas fa-spinner fa-spin text-emerald-500 text-2xl mr-3" />
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
      <div
        v-if="isReadonly"
        class="mb-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-100/90 px-4 py-3 text-sm text-slate-700"
      >
        <i class="fas fa-lock text-slate-500 mt-0.5" />
        <div>
          <p class="font-bold text-slate-800">
            Chế độ chỉ xem (năm {{ selectedYear }})
          </p>
          <p class="text-slate-600 mt-0.5">
            Bảng KPI cá nhân và drawer chỉ xem — không chỉnh sửa / không lưu.
          </p>
        </div>
      </div>

      <!-- ── Tiêu đề + chọn năm ─────────────────────────────────────────── -->
      <div class="flex justify-between items-end mb-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-800">Leader Dashboard</h2>
          <p class="text-slate-500 text-sm mt-1">
            Tổng quan team và KPI cá nhân của Leader.
          </p>
        </div>
        <select
          v-model.number="selectedYear"
          class="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 shadow-sm cursor-pointer"
          :class="isReadonly ? 'opacity-90' : ''"
        >
          <option :value="2025">Năm: 2025</option>
          <option :value="2026">Năm: 2026</option>
        </select>
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
            <i class="fas fa-bullseye text-base" />
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
            <i class="fas fa-sitemap text-base" />
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
            <i class="fas fa-arrow-trend-up text-base" />
            Promotion KPI
          </button>
        </div>
        <button
          v-if="!isReadonly"
          type="button"
          class="mb-2 mr-2 flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
          @click="showCreateIndividualKpiDrawer = true"
        >
          <i class="fas fa-plus text-xs" aria-hidden="true" />
          Tạo Individual KPI
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
              <i class="fas fa-users text-emerald-600" />
              Team Performance Overview
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">
              Nhấn vào thành viên để xem chi tiết KPI (chỉ xem).
            </p>
          </div>
        </div>

        <TeamMemberTable
          :members="dashboardData.teamMembers"
          @open-member-drawer="openLeaderMemberDrawer"
        />
      </div>

      <!-- Promotion KPI -->
      <div
        v-show="activeTab === 'promotion'"
        id="leader-my-kpi-section"
        class="max-w-[1500px] mx-auto space-y-6 animate-fade-in scroll-mt-24"
      >
        <div class="flex justify-between items-center mb-4 flex-wrap gap-3">
          <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
            <i class="fas fa-list-check text-indigo-500" />
            Chi Tiết Bảng KPI Cá Nhân
          </h2>
        </div>

        <PromotionKpiTable
          :rows="myKpiRows" 
          :totals="myKpiTotals"
          :is-readonly="isReadonly"
          :self-scores="selfScores"
          :employee-comment="leaderKpiEmployeeComment"
          :supervisor-comment="leaderKpiSupervisorComment"
          @update:employee-comment="leaderKpiEmployeeComment = $event"
          @open-drawer="openDrawer"
          @submit="submitLeaderKpiEvaluationToPm"
        />
      </div>

      <!-- Chi Tiết Bảng KPI Cá Nhân — theo prototype HTML (Member View) -->
      <div
        v-show="activeTab === 'personal'"
        id="leader-my-kpi-section"
        class="max-w-[1500px] mx-auto space-y-6 animate-fade-in scroll-mt-24"
      >
        <div class="flex justify-between items-center mb-4 flex-wrap gap-3">
          <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
            <i class="fas fa-list-check text-indigo-500" />
            Chi Tiết Bảng KPI Cá Nhân
          </h2>
        </div>

        <PersonalKpiTable
          :rows="myKpiRows"
          :totals="myKpiTotals"
          :is-readonly="isReadonly"
          :self-scores="selfScores"
          :employee-comment="leaderKpiEmployeeComment"
          :supervisor-comment="leaderKpiSupervisorComment"
          @update:employee-comment="leaderKpiEmployeeComment = $event"
          @open-drawer="openDrawer"
          @submit="submitLeaderKpiEvaluationToPm"
        />
      </div>

      <!-- Drawer Evidence Hub — đa case như HTML -->
      <Teleport to="body">
        <Transition name="fade">
          <div
            v-if="drawerOpen || leaderMemberDrawerOpen || promotionMemberDrawerMember"
            class="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm transition-opacity"
            aria-hidden="true"
            @click="closeAnyOverlay"
          />
        </Transition>
        <Transition name="slide">
          <aside
            v-if="drawerOpen && drawerRow"
            class="fixed top-0 right-0 z-[70] h-full w-full max-w-[700px] bg-slate-50 shadow-2xl flex flex-col"
          >
            <!-- Header -->
            <div
              class="px-6 py-4 border-b border-slate-200 bg-white flex justify-between items-center shrink-0 shadow-sm"
            >
              <div>
                <h2
                  class="text-lg font-bold text-slate-800 flex items-center gap-2"
                >
                  <i class="fas fa-file-alt text-indigo-600" />
                  Chi tiết Evidence
                </h2>
                <p class="text-xs text-slate-500 mt-0.5">
                  Khai báo số liệu và Đính kèm tài liệu minh chứng
                </p>
              </div>
              <button
                type="button"
                class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                aria-label="Đóng"
                @click="closeDrawer"
              >
                <i class="fas fa-times" />
              </button>
            </div>

            <!-- KPI banner -->
            <div
              class="bg-slate-800 text-white p-5 shrink-0 relative overflow-hidden"
            >
              <div
                class="absolute -right-4 -bottom-4 opacity-[0.03] pointer-events-none"
              >
                <i class="fas fa-bullseye text-[10rem] text-white" />
              </div>
              <div class="relative z-10">
                <span
                  class="bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shadow-sm"
                  >{{ drawerRow.code }}</span
                >
                <h3 class="text-xl font-bold mb-1 mt-2">
                  {{ drawerRow.evidenceDrawerName }}
                </h3>
                <p class="text-slate-300 text-sm flex items-center gap-1.5">
                  <i class="fas fa-crosshairs text-indigo-400 text-sm" />
                  <span>Target: {{ drawerRow.evidenceTargetDesc }}</span>
                </p>
              </div>
            </div>

            <div
              class="flex-1 overflow-y-auto p-6 space-y-6 text-sm"
              :class="isReadonly ? 'opacity-95' : ''"
            >
              <div
                v-if="uploadOnlyMode"
                class="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/90 p-4 text-sm text-slate-800 shadow-sm"
              >
                <div class="flex items-start gap-3">
                  <i
                    class="fas fa-id-card mt-0.5 shrink-0 text-lg text-indigo-600"
                  />
                  <div class="min-w-0">
                    <p class="font-bold text-indigo-950">
                      Mục tiêu theo bảng KPI (đã đăng ký)
                    </p>
                    <p class="mt-1 font-medium text-slate-800">
                      {{ drawerRow.evidenceTargetDesc }}
                    </p>
                  </div>
                </div>
                <p
                  class="border-t border-indigo-100/90 pt-3 text-xs leading-relaxed text-slate-600"
                >
                  Nếu kết quả thực tế <strong>khác</strong> mục tiêu — ví dụ
                  đăng ký <strong>TOEIC 700</strong> nhưng chưa đạt, trong khi
                  bạn có <strong>JLPT N2</strong> — hãy ghi rõ chứng chỉ / điểm
                  thực tế ở ô dưới và đính kèm scan hoặc link tra cứu để PM đối
                  chiếu.
                </p>
                <div>
                  <label class="mb-1 block text-xs font-bold text-slate-700">
                    Chứng chỉ / trình độ thực tế (minh chứng đi kèm)
                  </label>
                  <textarea
                    v-model="certificateOutcomeDraft"
                    rows="2"
                    placeholder="Ví dụ: JLPT N2 (12/2025) — đính kèm scan; mục tiêu TOEIC 700 chưa đạt."
                    class="w-full resize-none rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500"
                    :readonly="isReadonly"
                  />
                </div>
              </div>

              <!-- CASE monthly -->
              <div
                v-show="drawerRow.caseType === 'monthly'"
                class="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
              >
                <div class="bg-blue-50/50 px-4 py-3 border-b border-blue-100">
                  <h4
                    class="font-bold text-blue-800 text-sm flex items-center gap-2"
                  >
                    <i class="fas fa-calendar-alt text-blue-600" />
                    Khai báo thời gian theo Tháng (Timesheet)
                  </h4>
                </div>
                <div class="p-4">
                  <div
                    class="grid grid-cols-12 gap-3 items-end bg-blue-50/30 border border-blue-100 p-3 rounded-lg mb-4"
                  >
                    <div class="col-span-12 sm:col-span-4">
                      <label
                        class="block text-[10px] font-bold text-slate-500 uppercase mb-1"
                        >Dự án</label
                      >
                      <input
                        type="text"
                        placeholder="Tên dự án..."
                        class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                        :readonly="isReadonly"
                      />
                    </div>
                    <div class="col-span-6 sm:col-span-3">
                      <label
                        class="block text-[10px] font-bold text-slate-500 uppercase mb-1"
                        >Tháng</label
                      >
                      <select
                        class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                        :disabled="isReadonly"
                      >
                        <option>Tháng 1</option>
                        <option>Tháng 2</option>
                        <option>Tháng 3</option>
                      </select>
                    </div>
                    <div class="col-span-6 sm:col-span-2">
                      <label
                        class="block text-[10px] font-bold text-slate-500 uppercase mb-1"
                        >Spent (h)</label
                      >
                      <input
                        type="number"
                        placeholder="0"
                        class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                        :readonly="isReadonly"
                      />
                    </div>
                    <div class="col-span-12 sm:col-span-3">
                      <button
                        type="button"
                        class="w-full bg-blue-600 text-white rounded px-2 py-1.5 text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-1"
                        :disabled="isReadonly"
                      >
                        <i class="fas fa-plus text-xs" /> Thêm
                      </button>
                    </div>
                  </div>
                  <table
                    class="w-full text-left text-sm border border-slate-200 rounded-lg overflow-hidden"
                  >
                    <thead class="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th
                          class="py-2 px-3 font-medium border-b border-slate-200"
                        >
                          Dự án
                        </th>
                        <th
                          class="py-2 px-3 font-medium border-b border-slate-200 text-center"
                        >
                          Tháng
                        </th>
                        <th
                          class="py-2 px-3 font-medium border-b border-slate-200 text-right"
                        >
                          Spent Time
                        </th>
                        <th
                          class="py-2 px-3 font-medium border-b border-slate-200 text-right"
                        >
                          Standard Time
                        </th>
                        <th
                          class="py-2 px-3 font-medium border-b border-slate-200 text-center"
                        >
                          Thao tác
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      <tr>
                        <td class="py-2 px-3">E-Commerce Web</td>
                        <td class="py-2 px-3 text-center">Jan</td>
                        <td class="py-2 px-3 text-right font-medium">160h</td>
                        <td class="py-2 px-3 text-right text-slate-400">
                          160h
                        </td>
                        <td class="py-2 px-3 text-center">
                          <button
                            type="button"
                            class="text-slate-400 hover:text-red-500"
                            :disabled="isReadonly"
                          >
                            <i class="fas fa-trash-alt" />
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td class="py-2 px-3">E-Commerce Web</td>
                        <td class="py-2 px-3 text-center">Feb</td>
                        <td
                          class="py-2 px-3 text-right font-medium text-red-600"
                        >
                          140h
                        </td>
                        <td class="py-2 px-3 text-right text-slate-400">
                          160h
                        </td>
                        <td class="py-2 px-3 text-center">
                          <button
                            type="button"
                            class="text-slate-400 hover:text-red-500"
                            :disabled="isReadonly"
                          >
                            <i class="fas fa-trash-alt" />
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- CASE project_metrics -->
              <div
                v-show="drawerRow.caseType === 'project_metrics'"
                class="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
              >
                <div
                  class="bg-purple-50/50 px-4 py-3 border-b border-purple-100"
                >
                  <h4
                    class="font-bold text-purple-800 text-sm flex items-center gap-2"
                  >
                    <i class="fas fa-chart-line text-purple-600" />
                    Khai báo Chỉ số (Metrics) theo Dự án
                  </h4>
                </div>
                <div class="p-4">
                  <div
                    class="grid grid-cols-12 gap-3 items-end bg-purple-50/30 border border-purple-100 p-3 rounded-lg mb-4"
                  >
                    <div class="col-span-12 sm:col-span-3">
                      <label
                        class="block text-[10px] font-bold text-slate-500 uppercase mb-1"
                        >Dự án</label
                      >
                      <input
                        type="text"
                        placeholder="Tên dự án..."
                        class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                        :readonly="isReadonly"
                      />
                    </div>
                    <div class="col-span-4 sm:col-span-2">
                      <label
                        class="block text-[10px] font-bold text-slate-500 uppercase mb-1"
                        >Rework %</label
                      >
                      <input
                        type="number"
                        placeholder="0%"
                        class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                        :readonly="isReadonly"
                      />
                    </div>
                    <div class="col-span-4 sm:col-span-2">
                      <label
                        class="block text-[10px] font-bold text-slate-500 uppercase mb-1"
                        >UT Bug %</label
                      >
                      <input
                        type="number"
                        placeholder="0%"
                        class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                        :readonly="isReadonly"
                      />
                    </div>
                    <div class="col-span-4 sm:col-span-2">
                      <label
                        class="block text-[10px] font-bold text-slate-500 uppercase mb-1"
                        >Degraded %</label
                      >
                      <input
                        type="number"
                        placeholder="0%"
                        class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                        :readonly="isReadonly"
                      />
                    </div>
                    <div class="col-span-12 sm:col-span-3">
                      <button
                        type="button"
                        class="w-full bg-purple-600 text-white rounded px-2 py-1.5 text-sm font-medium hover:bg-purple-700 flex items-center justify-center gap-1"
                        :disabled="isReadonly"
                      >
                        <i class="fas fa-plus text-xs" /> Cập nhật
                      </button>
                    </div>
                  </div>
                  <table
                    class="w-full text-left text-sm border border-slate-200 rounded-lg overflow-hidden"
                  >
                    <thead class="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th
                          class="py-2 px-3 font-medium border-b border-slate-200"
                        >
                          Dự án
                        </th>
                        <th
                          class="py-2 px-3 font-medium border-b border-slate-200 text-center"
                        >
                          Rework
                        </th>
                        <th
                          class="py-2 px-3 font-medium border-b border-slate-200 text-center"
                        >
                          UT Bug
                        </th>
                        <th
                          class="py-2 px-3 font-medium border-b border-slate-200 text-center"
                        >
                          Degraded
                        </th>
                        <th
                          class="py-2 px-3 font-medium border-b border-slate-200 text-center"
                        >
                          Xóa
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td
                          colspan="5"
                          class="py-4 text-center text-slate-400 text-xs italic bg-slate-50"
                        >
                          Chưa có dự án nào được khai báo
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- CASE general -->
              <div
                v-show="drawerRow.caseType === 'general'"
                class="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
              >
                <div class="bg-teal-50/50 px-4 py-3 border-b border-teal-100">
                  <h4
                    class="font-bold text-teal-800 text-sm flex items-center gap-2"
                  >
                    <i class="fas fa-comment-dots text-teal-600" />
                    Khai báo Hành vi / Sự kiện
                  </h4>
                </div>
                <div class="p-4 space-y-4">
                  <div
                    class="bg-teal-50/30 border border-teal-100 rounded-lg p-4"
                  >
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <label
                          class="block text-xs font-bold text-slate-600 mb-1"
                          >Mục tiêu (Plan/Target)</label
                        >
                        <textarea
                          rows="2"
                          class="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                          placeholder="E.g. Không có vi phạm bảo mật..."
                          :readonly="isReadonly"
                        />
                      </div>
                      <div>
                        <label
                          class="block text-xs font-bold text-slate-600 mb-1"
                          >Thực tế (Actual/Result)</label
                        >
                        <textarea
                          rows="2"
                          class="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                          placeholder="E.g. Hoàn thành 100%..."
                          :readonly="isReadonly"
                        />
                      </div>
                    </div>
                    <div class="flex justify-end">
                      <button
                        type="button"
                        class="bg-teal-600 text-white rounded px-4 py-1.5 text-sm font-medium hover:bg-teal-700 flex items-center gap-1"
                        :disabled="isReadonly"
                      >
                        <i class="fas fa-plus text-xs" /> Thêm Record
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Upload hub — đồng bộ MemberDashboard: multi-file, URL, danh sách chung -->
              <div
                class="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div
                  class="absolute left-0 top-0 h-1 w-full bg-pink-500 transition-opacity"
                  :class="
                    uploadOnlyMode
                      ? 'opacity-100'
                      : 'opacity-0 pointer-events-none'
                  "
                />
                <div
                  class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <h4
                    class="flex items-center text-sm font-bold"
                    :class="uploadOnlyMode ? 'text-pink-600' : 'text-slate-700'"
                  >
                    <i class="fas fa-paperclip mr-2 text-slate-500" />
                    {{ attachmentHubTitle }}
                  </h4>
                  <span
                    v-if="uploadOnlyMode"
                    class="rounded bg-pink-100 px-2 py-0.5 text-[10px] font-bold uppercase text-pink-700"
                    >Bắt buộc</span
                  >
                </div>
                <div class="space-y-4 p-5">
                  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label
                      class="group relative block rounded-lg border-2 border-dashed border-slate-300 bg-white p-5 text-center transition-colors"
                      :class="
                        pendingEvidenceFiles.length >= EVIDENCE_MAX_FILES ||
                        isReadonly
                          ? 'cursor-not-allowed opacity-60'
                          : 'cursor-pointer hover:border-indigo-400 hover:bg-slate-50'
                      "
                    >
                      <input
                        v-if="
                          pendingEvidenceFiles.length < EVIDENCE_MAX_FILES &&
                          !isReadonly
                        "
                        type="file"
                        multiple
                        :accept="EVIDENCE_ACCEPT_ATTR"
                        class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        title="Chọn file (tối đa 5 file)"
                        @change="onEvidenceFilesChange"
                      />
                      <div
                        class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500 transition-transform group-hover:scale-110"
                      >
                        <i class="fas fa-cloud-upload-alt text-2xl" />
                      </div>
                      <p class="text-sm font-bold text-slate-700">
                        Tải File Lên (PC)
                      </p>
                      <p
                        class="mt-1 text-[10px] uppercase tracking-wider text-slate-400"
                      >
                        PDF, Word, Excel, CSV, JPG, PNG — tối đa
                        {{ EVIDENCE_MAX_FILES }} file
                      </p>
                    </label>
                    <div
                      class="flex flex-col rounded-lg border border-slate-200 bg-slate-50 p-5"
                    >
                      <label class="mb-1 block text-sm font-bold text-slate-700"
                        >Thêm link URL</label
                      >
                      <p
                        class="mb-3 text-[10px] uppercase tracking-wider text-slate-400"
                      >
                        Jira, Confluence, Drive… — tối đa
                        {{ EVIDENCE_MAX_URLS }} link
                      </p>
                      <div
                        class="flex flex-col gap-2 sm:flex-row sm:items-stretch"
                      >
                        <div class="relative min-w-0 flex-1">
                          <i
                            class="fas fa-link pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                          />
                          <input
                            v-model="evidenceUrlDraft"
                            type="text"
                            inputmode="url"
                            autocomplete="url"
                            placeholder="https://..."
                            class="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:ring-1 focus:ring-indigo-500"
                            :disabled="
                              isReadonly ||
                              pendingEvidenceUrls.length >= EVIDENCE_MAX_URLS
                            "
                            @keydown="onEvidenceUrlDraftKeydown"
                          />
                        </div>
                        <button
                          type="button"
                          class="shrink-0 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                          :disabled="
                            isReadonly ||
                            pendingEvidenceUrls.length >= EVIDENCE_MAX_URLS
                          "
                          @click="addPendingEvidenceUrl"
                        >
                          Thêm URL
                        </button>
                      </div>
                      <p
                        v-if="evidenceUrlHint"
                        class="mt-2 text-xs text-amber-700"
                      >
                        {{ evidenceUrlHint }}
                      </p>
                    </div>
                  </div>

                  <div class="space-y-2">
                    <div
                      class="flex flex-wrap items-center justify-between gap-2"
                    >
                      <p class="text-xs font-semibold text-slate-600">
                        Minh chứng đã chọn:
                        {{ pendingEvidenceFiles.length }}/{{
                          EVIDENCE_MAX_FILES
                        }}
                        file · {{ pendingEvidenceUrls.length }}/{{
                          EVIDENCE_MAX_URLS
                        }}
                        URL
                      </p>
                    </div>
                    <p v-if="evidenceUploadHint" class="text-xs text-amber-700">
                      {{ evidenceUploadHint }}
                    </p>
                    <ul
                      v-if="hasEvidenceAttachments"
                      class="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white"
                    >
                      <li
                        v-for="row in pendingEvidenceFiles"
                        :key="'f-' + row.id"
                        class="flex items-center gap-3 px-3 py-2.5"
                      >
                        <span
                          class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500"
                          >File</span
                        >
                        <i class="fas fa-file-alt shrink-0 text-slate-400" />
                        <div class="min-w-0 flex-1">
                          <p
                            class="truncate text-sm font-medium text-slate-800"
                            :title="row.file.name"
                          >
                            {{ row.file.name }}
                          </p>
                          <p class="text-xs text-slate-500">
                            {{ formatEvidenceFileSize(row.file.size) }}
                          </p>
                        </div>
                        <button
                          v-if="!isReadonly"
                          type="button"
                          class="shrink-0 rounded p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          title="Xóa file"
                          @click="removePendingEvidenceFile(row.id)"
                        >
                          <i class="fas fa-times" />
                        </button>
                      </li>
                      <li
                        v-for="row in pendingEvidenceUrls"
                        :key="'u-' + row.id"
                        class="flex items-center gap-2 px-3 py-2.5"
                      >
                        <span
                          class="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-600"
                          >URL</span
                        >
                        <i
                          class="fas fa-external-link-alt shrink-0 text-xs text-slate-400"
                        />
                        <a
                          :href="row.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="min-w-0 flex-1 truncate text-sm font-medium text-indigo-700 hover:underline"
                          :title="row.url"
                          >{{ row.url }}</a
                        >
                        <button
                          v-if="!isReadonly"
                          type="button"
                          class="shrink-0 rounded p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          title="Xóa URL"
                          @click="removePendingEvidenceUrl(row.id)"
                        >
                          <i class="fas fa-times" />
                        </button>
                      </li>
                    </ul>
                    <p
                      v-else
                      class="rounded border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-center text-xs text-slate-500"
                    >
                      Chưa có file hoặc URL — thêm ở hai ô phía trên
                    </p>
                  </div>

                  <div>
                    <label
                      class="mb-1 block text-xs font-semibold text-slate-600"
                      >Ghi chú (Comment cho PM)</label
                    >
                    <textarea
                      v-model="evidenceNoteDraft"
                      rows="2"
                      placeholder="Nhập diễn giải thêm về bằng chứng của bạn..."
                      class="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500"
                      :readonly="isReadonly"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              class="p-4 border-t border-slate-200 bg-white shrink-0 flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
            >
              <button
                type="button"
                class="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                @click="closeDrawer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                class="px-5 py-2 text-sm font-bold text-white bg-slate-800 rounded-lg hover:bg-slate-900 shadow-md transition-colors flex items-center gap-2"
                :class="isReadonly ? 'opacity-50 cursor-not-allowed' : ''"
                :disabled="isReadonly"
              >
                <i class="fas fa-save text-sm" /> Lưu Evidence
              </button>
            </div>
          </aside>
        </Transition>

        <Transition name="slide">
          <aside
            v-if="leaderMemberDrawerOpen && leaderMemberDrawerMember"
            class="fixed top-0 right-0 z-[72] flex h-full w-full max-w-3xl flex-col border-l border-slate-200 bg-slate-50 shadow-2xl"
          >
            <div
              class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 shadow-sm relative z-20"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-base shrink-0">
                  {{ getTeamMemberInitials(leaderMemberDrawerMember.name) }}
                </div>
                <div class="min-w-0">
                  <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Chi tiết KPI thành viên
                  </p>
                  <h2 class="mt-0.5 text-base font-bold text-slate-900 truncate">
                    {{ leaderMemberDrawerMember.name }}
                  </h2>
                  <p class="text-xs text-slate-500">
                    {{ leaderMemberDrawerMember.role ?? "" }}
                    <span v-if="leaderMemberDrawerMember.role">·</span>
                    {{ leaderMemberDrawerMember.rank }}
                  </p>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <span class="inline-block rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                  <i class="fas fa-eye mr-1" />Chỉ xem
                </span>
                <button
                  type="button"
                  class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                  aria-label="Đóng"
                  @click="closeLeaderMemberDrawer"
                >
                  <i class="fas fa-times" />
                </button>
              </div>
            </div>

            <div class="flex shrink-0 border-b border-slate-200 bg-slate-50/80 px-5 pt-3 gap-6 relative z-10 shadow-sm">
              <button
                type="button"
                class="pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 outline-none"
                :class="memberDrawerActiveTab === 'performance' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'"
                @click="memberDrawerActiveTab = 'performance'"
              >
                <i class="fas fa-sitemap" /> Performance
              </button>
              <button
                type="button"
                class="pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 outline-none"
                :class="memberDrawerActiveTab === 'promotion' ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-800'"
                @click="memberDrawerActiveTab = 'promotion'"
              >
                <i class="fas fa-arrow-trend-up" /> Promotion
              </button>
            </div>

            <div class="flex-1 overflow-y-auto bg-slate-50">
              <MemberPerformanceTab
                v-if="memberDrawerActiveTab === 'performance'"
                :member="leaderMemberDrawerMember"
                :groups="getMemberKpiGroups(leaderMemberDrawerMember)"
              />
              
              <MemberPromotionTab
                v-else-if="memberDrawerActiveTab === 'promotion'"
                :member="leaderMemberDrawerMember"
                :groups="getMemberKpiGroups(leaderMemberDrawerMember)" 
              />
            </div>

            <div class="flex shrink-0 justify-end border-t border-slate-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] relative z-20">
              <button
                type="button"
                class="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                @click="closeLeaderMemberDrawer"
              >
                Đóng
              </button>
            </div>
          </aside>
        </Transition>

        <Transition name="slide">
          <aside
            v-if="promotionMemberDrawerMember"
            class="fixed top-0 right-0 z-[74] flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-slate-50 shadow-2xl"
          >
            <div
              class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 shadow-sm"
            >
              <div class="flex min-w-0 flex-1 items-center gap-3">
                <div
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-base font-bold text-violet-800"
                >
                  {{ getTeamMemberInitials(promotionMemberDrawerMember.name) }}
                </div>
                <div class="min-w-0">
                  <p
                    class="text-[10px] font-bold uppercase tracking-wider text-slate-500"
                  >
                    KPI Promotion (chỉ xem)
                  </p>
                  <h2 class="mt-0.5 truncate text-base font-bold text-slate-900">
                    {{ promotionMemberDrawerMember.name }}
                  </h2>
                  <p class="text-xs text-slate-500">
                    {{ promotionMemberDrawerMember.role ?? "" }}
                    <span v-if="promotionMemberDrawerMember.role">·</span>
                    {{ promotionMemberDrawerMember.rank }}
                  </p>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <span
                  class="inline-block rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600"
                >
                  <i class="fas fa-eye mr-1" aria-hidden="true" />Read-only
                </span>
                <button
                  type="button"
                  class="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Đóng"
                  @click="closePromotionMemberDrawer"
                >
                  <i class="fas fa-times" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto bg-white">
              <div
                v-if="promotionDrawerItems.length === 0"
                class="px-6 py-16 text-center text-sm text-slate-500"
              >
                <i class="fas fa-medal mb-3 text-3xl text-violet-200" aria-hidden="true" />
                <p class="font-medium text-slate-600">Chưa có KPI Promotion</p>
              </div>

              <div v-else class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                  <thead class="border-b border-slate-200 bg-slate-50">
                    <tr
                      class="text-[11px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      <th class="w-12 px-4 py-3 text-center">#</th>
                      <th class="min-w-[180px] px-4 py-3">Hạng mục</th>
                      <th class="min-w-[140px] px-4 py-3">Chỉ tiêu (Target)</th>
                      <th class="w-20 px-4 py-3 text-center">W</th>
                      <th class="min-w-[6rem] px-4 py-3 text-center">Actual</th>
                      <th class="w-24 px-4 py-3 text-center">Self</th>
                      <th class="w-24 px-4 py-3 text-center">PM</th>
                      <th class="w-28 px-4 py-3 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr
                      v-for="(item, idx) in promotionDrawerItems"
                      :key="item.id"
                      class="hover:bg-slate-50/80"
                    >
                      <td class="px-4 py-3 text-center text-xs font-semibold text-slate-400">
                        {{ idx + 1 }}
                      </td>
                      <td class="px-4 py-3">
                        <p class="text-sm font-bold text-slate-900">
                          {{ item.code }} {{ item.name }}
                        </p>
                        <p
                          v-if="item.description"
                          class="mt-0.5 line-clamp-2 text-[11px] text-slate-500"
                        >
                          {{ item.description }}
                        </p>
                      </td>
                      <td class="max-w-[12rem] px-4 py-3 text-xs text-slate-700">
                        {{ stripHtmlTarget(item.target) }}
                      </td>
                      <td class="px-4 py-3 text-center">
                        <span
                          class="inline-block rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700"
                        >
                          {{ item.weight.toFixed(1) }}
                        </span>
                      </td>
                      <td
                        class="px-4 py-3 text-center text-xs font-semibold text-slate-700"
                        :title="formatPromotionActualResult(item)"
                      >
                        {{ formatPromotionActualResult(item) }}
                      </td>
                      <td class="px-4 py-3 text-center text-sm font-bold text-slate-800">
                        {{ item.selfScore ?? "—" }}
                      </td>
                      <td class="px-4 py-3 text-center text-sm text-slate-600">
                        {{ item.pmScore !== null ? item.pmScore : "—" }}
                      </td>
                      <td class="px-4 py-3 text-center align-middle">
                        <div
                          class="mx-auto inline-flex max-w-[9rem] flex-col items-center gap-0.5 rounded-lg border px-2 py-1 text-center text-[10px] font-bold shadow-sm"
                          :class="leaderEvalUi(resolveKpiItemEvalStatus(item)).chip"
                        >
                          <span
                            class="inline-flex items-center justify-center gap-1 leading-tight"
                          >
                            <span
                              class="h-1.5 w-1.5 shrink-0 rounded-full"
                              :class="leaderEvalUi(resolveKpiItemEvalStatus(item)).dot"
                              aria-hidden="true"
                            />
                            {{ leaderEvalUi(resolveKpiItemEvalStatus(item)).labelVi }}
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot class="border-t-2 border-slate-200 bg-violet-50/40 font-bold">
                    <tr>
                      <td
                        colspan="3"
                        class="px-4 py-3 text-right text-xs uppercase tracking-wider text-slate-700"
                      >
                        Tổng trọng số (Promotion)
                      </td>
                      <td class="px-4 py-3 text-center text-sm text-slate-900">
                        {{ promotionDrawerFooter.weightSum.toFixed(1) }}
                      </td>
                      <td class="px-4 py-3 text-center text-xs text-slate-400">
                        —
                      </td>
                      <td class="px-4 py-3 text-center text-sm text-slate-700">
                        {{
                          promotionDrawerFooter.selfAvg != null
                            ? promotionDrawerFooter.selfAvg.toFixed(2)
                            : "—"
                        }}
                      </td>
                      <td class="px-4 py-3 text-center text-sm text-slate-700">
                        {{
                          promotionDrawerFooter.pmAvg != null
                            ? promotionDrawerFooter.pmAvg.toFixed(2)
                            : "—"
                        }}
                      </td>
                      <td class="px-4 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div
              class="flex shrink-0 justify-end border-t border-slate-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
            >
              <button
                type="button"
                class="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                @click="closePromotionMemberDrawer"
              >
                Đóng
              </button>
            </div>
          </aside>
        </Transition>
      </Teleport>
    </template>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
