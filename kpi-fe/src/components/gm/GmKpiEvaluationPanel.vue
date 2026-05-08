<script setup lang="ts">
import {
  computed,
  inject,
  onMounted,
  reactive,
  ref,
  watch,
  type ComputedRef,
  type Ref,
} from "vue";
import { useRoute } from "vue-router";
import {
  flattenGmKpiItems,
  isGmEvalPromotionKpiGroup,
  type GmEvalMember,
  type GmEvalPmBranch,
  type GmKpiGroup,
  type GmKpiItem,
} from "@/mocks/gmEmployeeEvaluation.mock";
import { isReadonlyKpiYear } from "@/utils/kpi-year";
import { gmKpiService } from "@/services/modules/kpi-gm.service";

const props = withDefaults(
  defineProps<{
    employees: GmEvalMember[];
    contextSubtitle?: string;
    /** `pm` = hub: cột và copy dùng “PM” thay cho “nhân viên”. */
    listEntity?: "member" | "pm";
    /** Khi có dữ liệu: bảng hub hiển thị dạng PM → Leader → Member (expand). */
    pmBranches?: GmEvalPmBranch[] | null;
  }>(),
  {
    contextSubtitle: "",
    listEntity: "member",
    pmBranches: null,
  },
);

const emit = defineEmits<{
  reloadEvaluationHub: [];
}>();

const route = useRoute();
const layoutYear = inject<ComputedRef<number> | undefined>(
  "gmEvaluationYear",
  undefined,
);
const selectedCycleId = inject<Ref<string>>("gmSelectedCycleId", ref(""));
const useMockHub = import.meta.env.VITE_USE_MOCK === "true";
const employees = computed(() => props.employees);
const isPmList = computed(() => props.listEntity === "pm");
const usePmTree = computed(
  () =>
    isPmList.value &&
    Array.isArray(props.pmBranches) &&
    props.pmBranches.length > 0,
);
const codeColumnLabel = computed(() => (isPmList.value ? "Mã PM" : "Mã NV"));
const nameColumnLabel = computed(() =>
  isPmList.value ? "Tên PM" : "Tên Nhân viên",
);
const gmScoreColumnLabel = computed(() =>
  isPmList.value ? "Điểm GM" : "Điểm PM",
);
const gmScoreDetailLabel = computed(() =>
  isPmList.value ? "GM Score" : "PM Score",
);
const searchPlaceholder = computed(() =>
  usePmTree.value
    ? "Lọc theo section, PM, Leader, nhân viên hoặc mã..."
    : isPmList.value
      ? "Lọc theo tên PM hoặc đơn vị ..."
      : "Lọc theo tên nhân viên ...",
);
const emptyFilterMessage = computed(() => "Không có nhân viên khớp bộ lọc.");

/** Chỉ dùng khi panel không nằm trong GM layout (không có inject năm). */
const selectedYear = ref(2026);
const showYearDropdown = computed(() => layoutYear == null);
const effectiveYear = computed(() =>
  layoutYear != null ? layoutYear.value : selectedYear.value,
);
const nameFilter = ref("");
const listFilter = ref<"all" | "pending">("all");
const drawerEmpId = ref<string | null>(null);
/** Tab nội dung drawer: KPI individual/cascading vs Promotion. */
const drawerEvalTab = ref<"cascade" | "promotion">("cascade");
/** Expand PM / Leader trong chế độ cây hub. */
const expandedPmIds = reactive<Record<string, boolean>>({});
const expandedLeaderKeys = reactive<Record<string, boolean>>({});
/** Section (đồng bộ Strategic layout) — mặc định thu gọn, chỉ thấy danh sách section. */
const expandedSectionIds = reactive<Record<string, boolean>>({});
const openEvidence = reactive<Record<string, boolean>>({});
const pmScores = reactive<Record<string, Record<string, number | null>>>({});
const gmScoreTouched = reactive<Record<string, Record<string, boolean>>>({});
const gmKpiComments = reactive<Record<string, Record<string, string>>>({});
const supervisorComments = reactive<Record<string, string>>({});
const banner = ref<{ type: "ok" | "info"; text: string } | null>(null);
const confirmBusy = ref(false);
const pageLoading = ref(true);

const isReadonly = computed(() => isReadonlyKpiYear(effectiveYear.value));

function readRouteIntoUi() {
  const q = route.query.q;
  if (typeof q === "string" && q.trim()) nameFilter.value = q.trim();
  if (layoutYear != null) return;
  const y = route.query.year;
  if (typeof y === "string") {
    const n = parseInt(y, 10);
    if (!Number.isNaN(n)) selectedYear.value = n;
  }
}

watch(
  () => route.query,
  () => readRouteIntoUi(),
  { deep: true },
);

readRouteIntoUi();

watch(
  () => nameFilter.value.trim(),
  (q) => {
    if (!usePmTree.value) return;
    if (q) {
      for (const br of displayedPmBranches.value) {
        expandedSectionIds[br.sectionId ?? br.pm.id] = true;
      }
    }
  },
);

function hasKpis(emp: GmEvalMember) {
  return flattenGmKpiItems(emp).length > 0;
}

/** ASM 602: GM chấm điểm + bắt buộc comment; 502 chỉ review. */
function hubRowGmScoreEnabled(item: GmKpiItem): boolean {
  return item.hubAssignmentStatusCode === 602;
}

/** Hiển thị điểm GM ở bảng tổng hợp cho cả dòng đang chấm (602) và đã chốt (603). */
function hubRowGmScoreDisplayEnabled(item: GmKpiItem): boolean {
  const code = Number(item.hubAssignmentStatusCode)
  return code === 602 || code === 603
}

/** ASM 502/602: GM có thể ghi comment theo từng KPI. */
function hubRowGmCommentEnabled(item: GmKpiItem): boolean {
  return item.hubAssignmentStatusCode === 502 || item.hubAssignmentStatusCode === 602;
}

function drawerRequiresGmFinalGrading(emp: GmEvalMember): boolean {
  return flattenGmKpiItems(emp).some(hubRowGmScoreEnabled);
}

function evidenceKey(empId: string, kpiId: string) {
  return `${empId}:${kpiId}`;
}

/** Chỉ cho phép http(s) — tránh `javascript:` trong ô mock. */
function isEvidenceCellHttpUrl(raw: unknown): raw is string {
  const s = String(raw ?? "").trim();
  return /^https?:\/\//i.test(s);
}

function ensurePmScoreKeys() {
  for (const emp of employees.value) {
    if (!pmScores[emp.id]) pmScores[emp.id] = {};
    if (!gmScoreTouched[emp.id]) gmScoreTouched[emp.id] = {};
    for (const item of flattenGmKpiItems(emp)) {
      if (pmScores[emp.id][item.id] === undefined)
        pmScores[emp.id][item.id] = item.pmSeedScore ?? item.pmScore ?? null;
      if (gmScoreTouched[emp.id][item.id] === undefined)
        gmScoreTouched[emp.id][item.id] = false;
    }
  }
}

function initGmCommentDraft(emp: GmEvalMember, reset = false) {
  if (!gmKpiComments[emp.id]) gmKpiComments[emp.id] = {};
  for (const item of flattenGmKpiItems(emp)) {
    const fromEvidence = String(item.gmComment ?? "");
    if (reset || gmKpiComments[emp.id][item.id] === undefined) {
      gmKpiComments[emp.id][item.id] = fromEvidence;
    }
  }
}

function ensureGmCommentKeys(reset = false) {
  for (const emp of employees.value) {
    initGmCommentDraft(emp, reset);
  }
}

function resetPmScores() {
  for (const emp of employees.value) {
    if (!pmScores[emp.id]) pmScores[emp.id] = {};
    if (!gmScoreTouched[emp.id]) gmScoreTouched[emp.id] = {};
    for (const item of flattenGmKpiItems(emp)) {
      pmScores[emp.id][item.id] = item.pmSeedScore ?? item.pmScore ?? null;
      gmScoreTouched[emp.id][item.id] = false;
    }
  }
}

function prefillLockedPmScores() {
  ensurePmScoreKeys();
  for (const emp of employees.value) {
    for (const item of flattenGmKpiItems(emp)) {
      pmScores[emp.id][item.id] = item.selfScore;
      gmScoreTouched[emp.id][item.id] = false;
    }
  }
}

function currentDisplayableGmScore(emp: GmEvalMember, item: GmKpiItem): number | null {
  const persisted = item.pmScore;
  if (persisted != null && persisted > 0) return persisted;
  if (gmScoreTouched[emp.id]?.[item.id]) {
    const v = pmScores[emp.id]?.[item.id];
    if (v != null && v > 0) return v;
  }
  return null;
}

function initSupervisorCommentDraft(emp: GmEvalMember, reset = false) {
  if (reset || supervisorComments[emp.id] === undefined) {
    supervisorComments[emp.id] = String(emp.supervisorComment ?? "");
  }
}

function ensureSupervisorCommentKeys(reset = false) {
  for (const emp of employees.value) {
    initSupervisorCommentDraft(emp, reset);
  }
}

watch(
  effectiveYear,
  (y) => {
    if (isReadonlyKpiYear(y)) prefillLockedPmScores();
    else resetPmScores();
  },
  { immediate: true },
);

watch(
  employees,
  () => {
    ensurePmScoreKeys();
    ensureGmCommentKeys(true);
    ensureSupervisorCommentKeys(true);
  },
  { immediate: true },
);

onMounted(async () => {
  await new Promise((r) => setTimeout(r, 380));
  pageLoading.value = false;
});

function scaledWeightedAvgItems(
  emp: GmEvalMember,
  items: GmKpiItem[],
  mode: "pm" | "self",
): { value: number; filledPmSlots: number; totalPmSlots: number } {
  const iterItems =
    mode === "pm" ? items.filter((i) => hubRowGmScoreDisplayEnabled(i)) : items;
  const totalSlots = iterItems.length;
  let weighted = 0;
  let filledPm = 0;
  for (const item of iterItems) {
    if (mode === "self") {
      weighted += item.selfScore * (item.weight / 100);
    } else {
      const v = currentDisplayableGmScore(emp, item);
      if (v != null && v > 0) {
        weighted += v * (item.weight / 100);
        filledPm++;
      }
    }
  }
  const totalW = iterItems.reduce((s, i) => s + i.weight, 0);
  const denom = totalW / 100;
  return {
    value: denom > 0 ? weighted / denom : 0,
    filledPmSlots: filledPm,
    totalPmSlots: totalSlots,
  };
}

function scaledWeightedAvg(
  emp: GmEvalMember,
  mode: "pm" | "self",
): { value: number; filledPmSlots: number; totalPmSlots: number } {
  return scaledWeightedAvgItems(emp, flattenGmKpiItems(emp), mode);
}

function formatAvg(n: number) {
  return n.toFixed(2);
}

function totalKpiWeightFor(emp: GmEvalMember) {
  return flattenGmKpiItems(emp).reduce((s, i) => s + i.weight, 0);
}

function flattenGmKpiItemsFromGroups(groups: GmKpiGroup[]): GmKpiItem[] {
  return groups.flatMap((g) => g.items);
}

function totalKpiWeightForGroupList(groups: GmKpiGroup[]) {
  return flattenGmKpiItemsFromGroups(groups).reduce((s, i) => s + i.weight, 0);
}

function selfAvgForGroupList(emp: GmEvalMember, groups: GmKpiGroup[]) {
  const items = flattenGmKpiItemsFromGroups(groups);
  if (!items.length) return "—";
  return formatAvg(scaledWeightedAvgItems(emp, items, "self").value);
}

function pmAvgForGroupList(emp: GmEvalMember, groups: GmKpiGroup[]) {
  const items = flattenGmKpiItemsFromGroups(groups);
  if (!items.length) return "—";
  const { value, filledPmSlots } = scaledWeightedAvgItems(emp, items, "pm");
  if (filledPmSlots === 0) return "—";
  return formatAvg(value);
}

function pmPreviewText(emp: GmEvalMember) {
  if (!hasKpis(emp)) return "—";
  const { value, filledPmSlots } = scaledWeightedAvg(emp, "pm");
  if (filledPmSlots === 0) return "—";
  return formatAvg(value);
}

function pmPreviewClass(emp: GmEvalMember) {
  const { filledPmSlots } = scaledWeightedAvg(emp, "pm");
  if (!hasKpis(emp) || filledPmSlots === 0) return "text-slate-300 font-medium";
  return "text-indigo-700 font-bold";
}

function selfAvgInPanel(emp: GmEvalMember) {
  return formatAvg(scaledWeightedAvg(emp, "self").value);
}

function pmAvgInPanel(emp: GmEvalMember) {
  return formatAvg(scaledWeightedAvg(emp, "pm").value);
}

function pmSelectClass(emp: GmEvalMember, item: GmKpiItem) {
  if (!hubRowGmScoreEnabled(item)) {
    return "border-slate-200 bg-slate-50 text-slate-500";
  }
  const v = pmScores[emp.id]?.[item.id];
  const ok = v != null && v > 0;
  return ok
    ? "border-indigo-200 text-indigo-700"
    : "border-rose-400 bg-rose-50 text-rose-700";
}

function setPmScore(empId: string, kpiId: string, raw: string) {
  if (isReadonly.value) return;
  if (!pmScores[empId]) pmScores[empId] = {};
  if (!gmScoreTouched[empId]) gmScoreTouched[empId] = {};
  const n = parseInt(raw, 10);
  pmScores[empId][kpiId] = Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
  gmScoreTouched[empId][kpiId] = true;
}

function flattenPmBranchSheetHolders(br: GmEvalPmBranch): GmEvalMember[] {
  return [
    br.pm,
    ...br.leaders.flatMap((l) => [l.sheet, ...l.members]),
    ...br.directMembers,
  ];
}

function isAwaitingGmEvaluation(emp: GmEvalMember): boolean {
  if (!hasKpis(emp)) return false;
  const visibleStatus = new Set([502, 503, 602, 603]);
  return flattenGmKpiItems(emp).some((item) =>
    visibleStatus.has(Number(item.hubAssignmentStatusCode)),
  );
}

function sectionMembers(br: GmEvalPmBranch): GmEvalMember[] {
  return flattenPmBranchSheetHolders(br).filter(isAwaitingGmEvaluation);
}

function pmBranchHasChildren(br: GmEvalPmBranch) {
  return br.leaders.length > 0 || br.directMembers.length > 0;
}

function pmBranchMatchesSearch(br: GmEvalPmBranch, q: string): boolean {
  const parts: string[] = [
    br.sectionName ?? "",
    br.sectionId ?? "",
    br.pm.name,
    br.pm.code,
    br.pm.role,
    ...br.leaders.flatMap((l) => [
      l.sheet.name,
      l.sheet.code,
      l.sheet.role,
      ...l.members.flatMap((m) => [m.name, m.code, m.role]),
    ]),
    ...br.directMembers.flatMap((m) => [m.name, m.code, m.role]),
  ];
  return parts.join(" ").toLowerCase().includes(q);
}

function pmBranchHasPending(br: GmEvalPmBranch): boolean {
  return sectionMembers(br).length > 0;
}

const displayedPmBranches = computed(() => {
  if (!usePmTree.value || !props.pmBranches?.length) return [];
  const q = nameFilter.value.trim().toLowerCase();
  return props.pmBranches.filter((br) => {
    if (listFilter.value === "pending" && !pmBranchHasPending(br)) return false;
    if (q && !pmBranchMatchesSearch(br, q)) return false;
    return true;
  });
});

/** Một section Strategic layout + một nhánh PM (mock hub). */
interface GmPmEvalLayoutSection {
  sectionId: string;
  sectionName: string;
  branch: GmEvalPmBranch;
}

const pmEvalSectionsForDisplay = computed((): GmPmEvalLayoutSection[] =>
  displayedPmBranches.value
    .map((br) => ({
      sectionId: br.sectionId ?? br.pm.id,
      sectionName: br.sectionName ?? "Section",
      branch: br,
    }))
    .filter((sec) => sectionMembers(sec.branch).length > 0),
);

function ensureSectionExpandDefaults() {
  for (const sec of pmEvalSectionsForDisplay.value) {
    if (expandedSectionIds[sec.sectionId] === undefined) {
      expandedSectionIds[sec.sectionId] = true;
    }
  }
}

watch(
  pmEvalSectionsForDisplay,
  () => {
    if (!usePmTree.value) return;
    ensureSectionExpandDefaults();
  },
  { immediate: true },
);

const filteredEmployees = computed(() => {
  if (usePmTree.value) {
    return pmEvalSectionsForDisplay.value.flatMap((sec) => sectionMembers(sec.branch));
  }
  const q = nameFilter.value.trim().toLowerCase();
  return employees.value.filter((emp) => {
    if (listFilter.value === "pending" && emp.status !== "pending_pm")
      return false;
    if (q) {
      const hay = `${emp.name} ${emp.role}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
});

function togglePmBranchExpand(pmId: string) {
  expandedPmIds[pmId] = !expandedPmIds[pmId];
}

function toggleSectionExpand(sectionId: string) {
  expandedSectionIds[sectionId] = !expandedSectionIds[sectionId];
}

function toggleLeaderBranchExpand(leaderKey: string) {
  expandedLeaderKeys[leaderKey] = !expandedLeaderKeys[leaderKey];
}

function roleTagClass(kind: "pm" | "leader" | "member") {
  const base =
    "inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide sm:text-[10px]";
  if (kind === "pm")
    return `${base} border-indigo-200 bg-indigo-50 text-indigo-800`;
  if (kind === "leader")
    return `${base} border-amber-200 bg-amber-50 text-amber-900`;
  return `${base} border-slate-200 bg-slate-50 text-slate-700`;
}

const totalCount = computed(() => employees.value.length);

const pendingCount = computed(
  () => employees.value.filter((e) => e.status === "pending_pm").length,
);

/** Nhân viên/PM đang mở drawer đánh giá (phải còn trong danh sách sau lọc). */
const drawerEmployee = computed(() => {
  const id = drawerEmpId.value;
  if (!id) return null;
  return filteredEmployees.value.find((e) => e.id === id) ?? null;
});

watch(drawerEmpId, () => {
  drawerEvalTab.value = "cascade";
});

const drawerCascadeGroups = computed((): GmKpiGroup[] => {
  const e = drawerEmployee.value;
  if (!e) return [];
  return e.groups.filter((g) => !isGmEvalPromotionKpiGroup(g));
});

const drawerPromotionGroups = computed((): GmKpiGroup[] => {
  const e = drawerEmployee.value;
  if (!e) return [];
  return e.groups.filter((g) => isGmEvalPromotionKpiGroup(g));
});

const drawerActiveKpiGroups = computed((): GmKpiGroup[] =>
  drawerEvalTab.value === "cascade"
    ? drawerCascadeGroups.value
    : drawerPromotionGroups.value,
);

const drawerCascadeItemCount = computed(() =>
  drawerCascadeGroups.value.reduce((s, g) => s + g.items.length, 0),
);

const drawerPromotionItemCount = computed(() =>
  drawerPromotionGroups.value.reduce((s, g) => s + g.items.length, 0),
);

function statusBadgeClass(emp: GmEvalMember) {
  const base =
    "inline-flex max-w-[12rem] items-center gap-1 whitespace-normal rounded-full border px-2 py-0.5 text-left text-[10px] font-bold leading-snug sm:max-w-[16rem] sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-xs";
  if (emp.status === "pending_pm") {
    return `${base} border-rose-200 bg-rose-50 text-rose-700`;
  }
  if (emp.status === "self_scoring") {
    return `${base} border-slate-200 bg-slate-100 text-slate-600`;
  }
  return `${base} border-emerald-200 bg-emerald-50 text-emerald-800`;
}

/** Cột Tiến độ: `sys_status_codes.name` (API / mock), không map nhãn cố định. */
function assignmentProgressLabel(emp: GmEvalMember): string {
  const t = emp.assignmentStatusDisplay?.trim();
  return t || "—";
}

/** Hiện nút cột Thao tác (có KPI và được xem/chấm theo quyền). */
function canShowEvalActionButton(emp: GmEvalMember) {
  if (!hasKpis(emp)) return false;
  return isReadonly.value || emp.canScore;
}

/** Khóa nút khi không phải ASM 502/602 (chỉ áp dụng khi không ở chế độ chỉ xem). */
function evalThaoTacDisabled(emp: GmEvalMember) {
  if (!canShowEvalActionButton(emp)) return true;
  if (isReadonly.value) return false;
  return !emp.gmApprovalActionEnabled;
}

function toggleEvaluationDrawer(emp: GmEvalMember) {
  if (evalThaoTacDisabled(emp)) return;
  if (drawerEmpId.value !== emp.id) {
    initGmCommentDraft(emp, false);
  }
  drawerEmpId.value = drawerEmpId.value === emp.id ? null : emp.id;
}

function closeEvaluationDrawer() {
  drawerEmpId.value = null;
}

watch([nameFilter, listFilter], () => {
  const ex = drawerEmpId.value;
  if (ex && !filteredEmployees.value.some((e) => e.id === ex))
    drawerEmpId.value = null;
});

function toggleEvidence(empId: string, kpiId: string) {
  const k = evidenceKey(empId, kpiId);
  openEvidence[k] = !openEvidence[k];
}

function evidenceOpen(empId: string, kpiId: string) {
  return !!openEvidence[evidenceKey(empId, kpiId)];
}

function evidenceAccentBorder(accent: "indigo" | "emerald") {
  return accent === "emerald" ? "border-emerald-500" : "border-indigo-500";
}

function evidencePanelBorder(accent: "indigo" | "emerald") {
  return accent === "emerald"
    ? "border-b-2 border-emerald-200"
    : "border-b-2 border-indigo-200";
}

function saveDraft(emp: GmEvalMember) {
  if (isReadonly.value) return;
  banner.value = {
    type: "info",
    text: `Đã lưu nháp (mock) cho ${emp.name} — năm ${effectiveYear.value}.`,
  };
  setTimeout(() => {
    banner.value = null;
  }, 3200);
}

function hubGmScoresComplete(emp: GmEvalMember): boolean {
  const items = flattenGmKpiItems(emp);
  if (!items.length) return false;
  return items.every((it) => {
    if (!hubRowGmScoreEnabled(it)) return true;
    const v = pmScores[emp.id]?.[it.id];
    return v != null && v >= 1 && v <= 5;
  });
}

async function confirmDone(emp: GmEvalMember) {
  if (isReadonly.value) return;
  const needFinal = drawerRequiresGmFinalGrading(emp);
  const c = (supervisorComments[emp.id] ?? "").trim();
  if (needFinal && !c) {
    banner.value = {
      type: "info",
      text: "Vui lòng nhập Supervisor Comment trước khi hoàn tất.",
    };
    setTimeout(() => {
      banner.value = null;
    }, 3200);
    return;
  }
  const items = flattenGmKpiItems(emp).filter((it) => Boolean(it.id));
  if (!items.length) return;

  if (needFinal && !hubGmScoresComplete(emp)) {
    banner.value = {
      type: "info",
      text: "Vui lòng nhập điểm GM (1–5) cho đủ mọi KPI cuối kỳ (602) trước khi hoàn tất.",
    };
    setTimeout(() => {
      banner.value = null;
    }, 3200);
    return;
  }

  if (!useMockHub) {
    const cid = String(selectedCycleId.value ?? "").trim();
    if (!cid) {
      banner.value = {
        type: "info",
        text: "Chưa chọn chu kỳ KPI — không thể xác nhận.",
      };
      setTimeout(() => {
        banner.value = null;
      }, 3200);
      return;
    }
    const uid = String(emp.evaluationUserId ?? "").trim();
    if (!uid) {
      banner.value = {
        type: "info",
        text: "Thiếu định danh nhân viên (evaluationUserId) — không thể xác nhận.",
      };
      setTimeout(() => {
        banner.value = null;
      }, 3200);
      return;
    }
  }

  confirmBusy.value = true;
  try {
    if (!useMockHub) {
      const cid = String(selectedCycleId.value ?? "").trim();
      const uid = String(emp.evaluationUserId ?? "").trim();
      const res = await gmKpiService.confirmEvaluationHub({
        cycleId: cid,
        evaluationUserId: uid,
        supervisorComment: needFinal ? c : "",
        lines: items.map((it) => {
          const line: {
            assignmentId: string;
            endGmScore?: number;
            gmComment?: string;
          } = {
            assignmentId: it.id,
          };
          if (hubRowGmScoreEnabled(it)) {
            line.endGmScore = pmScores[emp.id]![it.id]!;
          }
          if (hubRowGmCommentEnabled(it)) {
            const itemComment = (gmKpiComments[emp.id]?.[it.id] ?? "").trim();
            if (itemComment) {
              line.gmComment = itemComment;
            }
          }
          return line;
        }),
      });
      if (res.updatedCount === 0) {
        banner.value = {
          type: "info",
          text: "Không có assignment nào ở trạng thái 502 hoặc 602 để cập nhật.",
        };
      } else {
        const tail = needFinal ? `Điểm TB ${gmScoreDetailLabel.value}: ${pmAvgInPanel(emp)}.` : "";
        banner.value = {
          type: "ok",
          text:
            res.skippedCount > 0
              ? `Đã cập nhật ${res.updatedCount} KPI; ${res.skippedCount} bỏ qua (không đúng trạng thái/chu kỳ). ${tail}`.trim()
              : needFinal
                ? `Đã xác nhận đánh giá ${res.updatedCount} KPI (602→603). ${tail}`.trim()
                : `Đã hoàn thành review ${res.updatedCount} KPI (502→503).`.trim(),
        };
      }
    } else {
      banner.value = {
        type: "ok",
        text: needFinal
          ? `Xác nhận hoàn tất (mock) cho ${emp.name}. Điểm TB ${gmScoreDetailLabel.value}: ${pmAvgInPanel(emp)}.`
          : `Hoàn thành review (mock) cho ${emp.name}.`,
      };
    }
    drawerEmpId.value = null;
    emit("reloadEvaluationHub");
  } catch (e: unknown) {
    banner.value = {
      type: "info",
      text:
        e instanceof Error ? e.message : "Không xác nhận được — thử lại sau.",
    };
  } finally {
    confirmBusy.value = false;
    setTimeout(() => {
      banner.value = null;
    }, 4200);
  }
}
</script>

<template>
  <div class="w-full max-w-none pb-6 sm:pb-8">
    <div
      v-if="pageLoading"
      class="flex flex-col items-center justify-center gap-3 py-20 text-slate-500 sm:py-24"
    >
      <i class="fas fa-spinner fa-spin text-2xl text-indigo-500 sm:text-3xl" />
      <span class="text-xs font-semibold sm:text-sm">Đang tải dữ liệu...</span>
    </div>

    <template v-else>
      <Transition name="fade">
        <div
          v-if="banner"
          class="fixed bottom-6 right-6 z-50 max-w-md rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg"
          :class="
            banner.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          "
        >
          {{ banner.text }}
        </div>
      </Transition>

      <div
        v-if="isReadonly"
        class="mx-4 mb-4 mt-4 flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 sm:mx-5 sm:mt-5 sm:text-sm"
      >
        <i class="fas fa-lock mt-0.5 shrink-0 text-slate-500 text-[11px]" />
        <p>
          <span class="font-bold">Chế độ chỉ xem:</span> năm
          {{ effectiveYear }} đã khóa kỳ. Không thể chỉnh điểm PM hay ghi chú
          supervisor.
        </p>
      </div>

      <!-- Tiêu đề — padding trong khung giống header `p-5` của GmKpiDiagnosticsTable -->
      <div
        class="border-b border-slate-200 bg-white px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5"
      >
        <div
          class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
        >
          <div class="min-w-0">
            <h3
              class="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800 sm:text-sm"
            >
              <i
                class="fas fa-clipboard-check text-[11px] text-blue-600 sm:text-xs"
                aria-hidden="true"
              />
              KPI management &amp; evaluation (GM)
            </h3>
            <p
              v-if="contextSubtitle"
              class="mt-1 text-[10px] font-bold text-indigo-700 sm:text-xs"
            >
              {{ contextSubtitle }}
            </p>
          </div>
          <div
            v-if="showYearDropdown"
            class="flex shrink-0 flex-wrap gap-2 self-start lg:self-auto"
          >
            <select
              v-model.number="selectedYear"
              class="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-indigo-100 sm:px-4"
            >
              <option :value="2024">Năm: 2024</option>
              <option :value="2025">Năm: 2025</option>
              <option :value="2026">Năm: 2026</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Thanh lọc + bảng — nền trắng liền mạch (không lồng card thừa), typography gần diagnostics -->
      <div class="flex flex-col overflow-hidden bg-white">
        <div
          class="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-3.5"
        >
          <div class="relative w-full min-w-0 shrink-0 sm:max-w-xs md:max-w-sm">
            <i
              class="fas fa-search pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 sm:left-3 sm:text-xs"
              aria-hidden="true"
            />
            <input
              v-model="nameFilter"
              type="text"
              :placeholder="searchPlaceholder"
              class="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs font-medium text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 sm:pl-9 sm:text-sm"
            />
          </div>
        </div>

        <div class="overflow-x-auto">
          <table
            v-if="!usePmTree"
            class="w-full min-w-[800px] text-left whitespace-nowrap"
          >
            <thead>
              <tr
                class="border-b border-slate-200 bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:text-[11px]"
              >
                <th class="px-3 py-2.5 sm:px-4 sm:py-3">
                  {{ codeColumnLabel }}
                </th>
                <th
                  class="min-w-[11rem] px-3 py-2.5 sm:min-w-[13rem] sm:px-4 sm:py-3"
                >
                  {{ nameColumnLabel }}
                </th>
                <th class="px-3 py-2.5 text-center sm:px-4 sm:py-3">Rank</th>
                <th class="px-3 py-2.5 text-center sm:px-4 sm:py-3">
                  Tiến độ (Status)
                </th>
                <th
                  class="bg-slate-50/80 px-3 py-2.5 text-center sm:px-4 sm:py-3"
                >
                  Điểm Tự chấm
                </th>
                <th
                  class="bg-indigo-50/40 px-3 py-2.5 text-center text-indigo-800 sm:px-4 sm:py-3"
                >
                  {{ gmScoreColumnLabel }}
                </th>
                <th
                  class="w-[4.5rem] px-2 py-2.5 text-center sm:w-20 sm:px-3 sm:py-3"
                >
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 text-xs sm:text-sm">
              <template v-for="emp in filteredEmployees" :key="emp.id">
                <tr
                  class="hover:bg-slate-50/80 transition-colors group"
                  :class="
                    drawerEmpId === emp.id
                      ? 'bg-slate-100/80 border-l-4 border-indigo-500'
                      : ''
                  "
                >
                  <td
                    class="px-3 py-2.5 font-bold text-slate-400 sm:px-4 sm:py-3"
                  >
                    {{ emp.code }}
                  </td>
                  <td class="px-3 py-2.5 sm:px-4 sm:py-3">
                    <div class="flex items-center gap-2 sm:gap-2.5">
                      <div
                        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold sm:h-8 sm:w-8 sm:text-xs"
                        :class="emp.initialsClass"
                      >
                        {{ emp.initials }}
                      </div>
                      <div class="min-w-0">
                        <p
                          class="text-xs font-bold text-slate-900 transition-colors group-hover:text-indigo-600 sm:text-sm"
                        >
                          {{ emp.name }}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td class="px-3 py-2.5 text-center sm:px-4 sm:py-3">
                    <span
                      class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 sm:px-2 sm:py-1 sm:text-xs"
                    >
                      {{ emp.rank }}
                    </span>
                  </td>
                  <td class="px-3 py-2.5 text-center sm:px-4 sm:py-3">
                    <span :class="statusBadgeClass(emp)">
                      <span
                        v-if="emp.status === 'pending_pm'"
                        class="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"
                      />
                      <i
                        v-else-if="emp.status === 'self_scoring'"
                        class="fas fa-pen text-[10px]"
                      />
                      <i v-else class="fas fa-check text-[10px]" />
                      {{ assignmentProgressLabel(emp) }}
                    </span>
                  </td>
                  <td
                    class="bg-slate-50/80 px-3 py-2.5 text-center sm:px-4 sm:py-3"
                  >
                    <span
                      v-if="emp.selfScoreDisplay"
                      class="font-bold text-slate-700"
                      >{{ emp.selfScoreDisplay }}</span
                    >
                    <span v-else class="font-medium italic text-slate-400"
                      >-</span
                    >
                  </td>
                  <td
                    class="bg-indigo-50/40 px-3 py-2.5 text-center sm:px-4 sm:py-3"
                  >
                    <span :class="pmPreviewClass(emp)">{{
                      pmPreviewText(emp)
                    }}</span>
                  </td>
                  <td class="px-2 py-2.5 text-center sm:px-3" @click.stop>
                    <button
                      v-if="canShowEvalActionButton(emp)"
                      type="button"
                      class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-200 bg-white text-indigo-600 shadow-sm transition-colors hover:bg-indigo-50 hover:text-indigo-800 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:shadow-none disabled:hover:bg-slate-50"
                      :disabled="evalThaoTacDisabled(emp)"
                      :title="
                        evalThaoTacDisabled(emp) && !isReadonly
                          ? 'Chỉ mở khi trạng thái ASM là 502 hoặc 602'
                          : 'Mở đánh giá KPI'
                      "
                      aria-label="Mở đánh giá KPI"
                      @click="toggleEvaluationDrawer(emp)"
                    >
                      <i
                        class="fas fa-clipboard-check text-xs"
                        aria-hidden="true"
                      />
                    </button>
                    <span v-else class="text-[11px] font-medium text-slate-300"
                      >—</span
                    >
                  </td>
                </tr>
              </template>
            </tbody>
          </table>

          <table
            v-else
            class="gm-eval-hub-table w-full min-w-[800px] table-fixed text-left whitespace-nowrap"
          >
            <colgroup>
              <col style="width: 36%" />
              <col style="width: 8%" />
              <col style="width: 18%" />
              <col style="width: 12%" />
              <col style="width: 14%" />
              <col style="width: 12%" />
            </colgroup>
            <thead>
              <tr
                class="border-b border-slate-200 bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:text-[11px]"
              >
                <th class="px-3 py-2.5 sm:px-4 sm:py-3">Nhân sự</th>
                <th class="px-3 py-2.5 text-center sm:px-4 sm:py-3">Rank</th>
                <th class="px-3 py-2.5 text-center sm:px-4 sm:py-3">
                  Tiến độ (Status)
                </th>
                <th
                  class="bg-slate-50/80 px-3 py-2.5 text-center sm:px-4 sm:py-3"
                >
                  Điểm Tự chấm
                </th>
                <th
                  class="bg-indigo-50/40 px-3 py-2.5 text-center text-indigo-800 sm:px-4 sm:py-3"
                >
                  {{ gmScoreColumnLabel }}
                </th>
                <th
                  class="w-[4.5rem] px-2 py-2.5 text-center sm:w-20 sm:px-3 sm:py-3"
                >
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 text-xs sm:text-sm">
              <template
                v-for="sec in pmEvalSectionsForDisplay"
                :key="sec.sectionId"
              >
                <tr
                  class="cursor-pointer border-y border-slate-200 bg-slate-100/95 transition-colors hover:bg-slate-100"
                  @click="toggleSectionExpand(sec.sectionId)"
                >
                  <td colspan="6" class="px-4 py-2 sm:px-5">
                    <div class="flex flex-wrap items-center gap-2">
                      <i
                        class="fas fa-chevron-right text-[10px] text-slate-500 transition-transform duration-300 ease-out motion-reduce:transition-none sm:text-xs"
                        :class="
                          expandedSectionIds[sec.sectionId] ? 'rotate-90' : ''
                        "
                        aria-hidden="true"
                      />
                      <i
                        class="fas fa-sitemap text-[10px] text-slate-500 sm:text-xs"
                        aria-hidden="true"
                      />
                      <span
                        class="text-[10px] font-extrabold uppercase tracking-wide text-slate-700 sm:text-[11px]"
                      >
                        {{ sec.sectionName }}
                      </span>
                      <span
                        class="text-[10px] font-semibold normal-case text-slate-500 sm:text-xs"
                      >
                        · {{ sectionMembers(sec.branch).length }} thành viên
                      </span>
                    </div>
                  </td>
                </tr>
                <tr class="border-0 bg-transparent">
                  <td colspan="6" class="border-y-0 p-0 align-top">
                    <div
                      class="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
                      :class="
                        expandedSectionIds[sec.sectionId]
                          ? 'grid-rows-[1fr]'
                          : 'grid-rows-[0fr]'
                      "
                    >
                      <div class="min-h-0">
                        <table
                          class="gm-eval-hub-table w-full min-w-[800px] table-fixed text-left whitespace-nowrap text-xs sm:text-sm"
                        >
                          <colgroup>
                            <col style="width: 36%" />
                            <col style="width: 8%" />
                            <col style="width: 18%" />
                            <col style="width: 12%" />
                            <col style="width: 14%" />
                            <col style="width: 12%" />
                          </colgroup>
                          <tbody class="divide-y divide-slate-200">
                            <tr
                              v-for="emp in sectionMembers(sec.branch)"
                              :key="`${sec.sectionId}:${emp.id}`"
                              class="hover:bg-slate-50/80 transition-colors group"
                              :class="
                                drawerEmpId === emp.id
                                  ? 'bg-slate-100/80 border-l-4 border-indigo-500'
                                  : ''
                              "
                            >
                              <td class="px-3 py-2.5 sm:px-4 sm:py-3">
                                <div class="flex items-center gap-1.5 pl-1 sm:pl-2">
                                  <span
                                    class="ml-2 inline-block h-7 w-7 shrink-0 sm:ml-3 sm:h-8 sm:w-8"
                                    aria-hidden="true"
                                  />
                                  <div
                                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold sm:h-8 sm:w-8 sm:text-xs"
                                    :class="emp.initialsClass"
                                  >
                                    {{ emp.initials }}
                                  </div>
                                  <div class="min-w-0 flex-1">
                                    <p
                                      class="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-900 transition-colors group-hover:text-indigo-600 sm:text-sm"
                                    >
                                      <span>{{ emp.name }}</span>
                                      <span :class="roleTagClass('member')">{{ emp.role }}</span>
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td class="px-3 py-2.5 text-center sm:px-4 sm:py-3">
                                <span
                                  class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 sm:px-2 sm:py-1 sm:text-xs"
                                >
                                  {{ emp.rank }}
                                </span>
                              </td>
                              <td class="px-3 py-2.5 text-center sm:px-4 sm:py-3">
                                <span :class="statusBadgeClass(emp)">
                                  <span
                                    v-if="emp.status === 'pending_pm'"
                                    class="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500 animate-pulse"
                                  />
                                  <i
                                    v-else-if="emp.status === 'self_scoring'"
                                    class="fas fa-pen text-[10px]"
                                  />
                                  <i v-else class="fas fa-check text-[10px]" />
                                  {{ assignmentProgressLabel(emp) }}
                                </span>
                              </td>
                              <td class="bg-slate-50/80 px-3 py-2.5 text-center sm:px-4 sm:py-3">
                                <span v-if="emp.selfScoreDisplay" class="font-bold text-slate-700">{{
                                  emp.selfScoreDisplay
                                }}</span>
                                <span v-else class="font-medium italic text-slate-400">-</span>
                              </td>
                              <td class="bg-indigo-50/40 px-3 py-2.5 text-center sm:px-4 sm:py-3">
                                <span :class="pmPreviewClass(emp)">{{ pmPreviewText(emp) }}</span>
                              </td>
                              <td class="px-2 py-2.5 text-center sm:px-3" @click.stop>
                                <button
                                  v-if="canShowEvalActionButton(emp)"
                                  type="button"
                                  class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-200 bg-white text-indigo-600 shadow-sm transition-colors hover:bg-indigo-50 hover:text-indigo-800 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:shadow-none disabled:hover:bg-slate-50"
                                  :disabled="evalThaoTacDisabled(emp)"
                                  :title="
                                    evalThaoTacDisabled(emp) && !isReadonly
                                      ? 'Chỉ mở khi trạng thái ASM là 502 hoặc 602'
                                      : 'Mở đánh giá KPI'
                                  "
                                  aria-label="Mở đánh giá KPI"
                                  @click="toggleEvaluationDrawer(emp)"
                                >
                                  <i class="fas fa-clipboard-check text-xs" aria-hidden="true" />
                                </button>
                                <span v-else class="text-[11px] font-medium text-slate-300">—</span>
                              </td>
                            </tr>
                            <template v-if="false">
                            <template
                              v-for="br in [sec.branch]"
                              :key="br.pm.id"
                            >
                              <tr
                                class="hover:bg-slate-50/80 transition-colors group"
                                :class="[
                                  pmBranchHasChildren(br)
                                    ? 'cursor-pointer'
                                    : '',
                                  drawerEmpId === br.pm.id
                                    ? 'bg-slate-100/80 border-l-4 border-indigo-500'
                                    : '',
                                ]"
                                @click="
                                  pmBranchHasChildren(br) &&
                                  togglePmBranchExpand(br.pm.id)
                                "
                              >
                                <td class="px-3 py-2.5 sm:px-4 sm:py-3">
                                  <div
                                    class="flex items-center gap-1.5 sm:gap-2"
                                  >
                                    <button
                                      v-if="pmBranchHasChildren(br)"
                                      type="button"
                                      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200/80 sm:h-8 sm:w-8"
                                      aria-label="Mở rộng nhóm PM"
                                      @click.stop="
                                        togglePmBranchExpand(br.pm.id)
                                      "
                                    >
                                      <i
                                        class="fas fa-chevron-right text-[10px] transition-transform duration-300 ease-out motion-reduce:transition-none sm:text-xs"
                                        :class="
                                          expandedPmIds[br.pm.id]
                                            ? 'rotate-90'
                                            : ''
                                        "
                                      />
                                    </button>
                                    <span
                                      v-else
                                      class="inline-block w-7 shrink-0 sm:w-8"
                                    />
                                    <div
                                      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold sm:h-8 sm:w-8 sm:text-xs"
                                      :class="br.pm.initialsClass"
                                    >
                                      {{ br.pm.initials }}
                                    </div>
                                    <div class="min-w-0 flex-1">
                                      <p
                                        class="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-900 transition-colors group-hover:text-indigo-600 sm:text-sm"
                                      >
                                        <span>{{ br.pm.name }}</span>
                                        <span :class="roleTagClass('pm')">{{
                                          br.pm.role
                                        }}</span>
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td
                                  class="px-3 py-2.5 text-center sm:px-4 sm:py-3"
                                >
                                  <span
                                    class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 sm:px-2 sm:py-1 sm:text-xs"
                                  >
                                    {{ br.pm.rank }}
                                  </span>
                                </td>
                                <td
                                  class="px-3 py-2.5 text-center sm:px-4 sm:py-3"
                                >
                                  <span :class="statusBadgeClass(br.pm)">
                                    <span
                                      v-if="br.pm.status === 'pending_pm'"
                                      class="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500 animate-pulse"
                                    />
                                    <i
                                      v-else-if="
                                        br.pm.status === 'self_scoring'
                                      "
                                      class="fas fa-pen text-[10px]"
                                    />
                                    <i
                                      v-else
                                      class="fas fa-check text-[10px]"
                                    />
                                    {{ assignmentProgressLabel(br.pm) }}
                                  </span>
                                </td>
                                <td
                                  class="bg-slate-50/80 px-3 py-2.5 text-center sm:px-4 sm:py-3"
                                >
                                  <span
                                    v-if="br.pm.selfScoreDisplay"
                                    class="font-bold text-slate-700"
                                    >{{ br.pm.selfScoreDisplay }}</span
                                  >
                                  <span
                                    v-else
                                    class="font-medium italic text-slate-400"
                                    >-</span
                                  >
                                </td>
                                <td
                                  class="bg-indigo-50/40 px-3 py-2.5 text-center sm:px-4 sm:py-3"
                                >
                                  <span :class="pmPreviewClass(br.pm)">{{
                                    pmPreviewText(br.pm)
                                  }}</span>
                                </td>
                                <td
                                  class="px-2 py-2.5 text-center sm:px-3"
                                  @click.stop
                                >
                                  <button
                                    v-if="canShowEvalActionButton(br.pm)"
                                    type="button"
                                    class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-200 bg-white text-indigo-600 shadow-sm transition-colors hover:bg-indigo-50 hover:text-indigo-800 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:shadow-none disabled:hover:bg-slate-50"
                                    :disabled="evalThaoTacDisabled(br.pm)"
                                    :title="
                                      evalThaoTacDisabled(br.pm) && !isReadonly
                                        ? 'Chỉ mở khi trạng thái ASM là 502 hoặc 602'
                                        : 'Mở đánh giá KPI'
                                    "
                                    aria-label="Mở đánh giá KPI"
                                    @click="toggleEvaluationDrawer(br.pm)"
                                  >
                                    <i
                                      class="fas fa-clipboard-check text-xs"
                                      aria-hidden="true"
                                    />
                                  </button>
                                  <span
                                    v-else
                                    class="text-[11px] font-medium text-slate-300"
                                    >—</span
                                  >
                                </td>
                              </tr>

                              <template v-if="pmBranchHasChildren(br)">
                                <tr class="border-0 bg-transparent">
                                  <td
                                    colspan="6"
                                    class="border-y-0 p-0 align-top"
                                  >
                                    <div
                                      class="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
                                      :class="
                                        expandedPmIds[br.pm.id]
                                          ? 'grid-rows-[1fr]'
                                          : 'grid-rows-[0fr]'
                                      "
                                    >
                                      <div class="min-h-0">
                                        <table
                                          class="gm-eval-hub-table w-full min-w-[800px] table-fixed text-left whitespace-nowrap text-xs sm:text-sm"
                                        >
                                          <colgroup>
                                            <col style="width: 36%" />
                                            <col style="width: 8%" />
                                            <col style="width: 18%" />
                                            <col style="width: 12%" />
                                            <col style="width: 14%" />
                                            <col style="width: 12%" />
                                          </colgroup>
                                          <tbody
                                            class="divide-y divide-slate-200"
                                          >
                                            <template
                                              v-for="ld in br.leaders"
                                              :key="ld.leaderKey"
                                            >
                                              <tr
                                                class="bg-slate-50/50 transition-colors group"
                                                :class="[
                                                  ld.members.length
                                                    ? 'cursor-pointer hover:bg-slate-50/90'
                                                    : '',
                                                  drawerEmpId === ld.sheet.id
                                                    ? 'bg-slate-100/80 border-l-4 border-indigo-500'
                                                    : '',
                                                ]"
                                                @click="
                                                  ld.members.length &&
                                                  toggleLeaderBranchExpand(
                                                    ld.leaderKey,
                                                  )
                                                "
                                              >
                                                <td
                                                  class="px-3 py-2 sm:px-4 sm:py-2.5"
                                                >
                                                  <div
                                                    class="flex items-center gap-1.5 pl-1 sm:pl-2"
                                                  >
                                                    <button
                                                      v-if="ld.members.length"
                                                      type="button"
                                                      class="ml-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200/80 sm:ml-6 sm:h-8 sm:w-8"
                                                      aria-label="Mở rộng nhóm Leader"
                                                      @click.stop="
                                                        toggleLeaderBranchExpand(
                                                          ld.leaderKey,
                                                        )
                                                      "
                                                    >
                                                      <i
                                                        class="fas fa-chevron-right text-[10px] transition-transform duration-300 ease-out motion-reduce:transition-none sm:text-xs"
                                                        :class="
                                                          expandedLeaderKeys[
                                                            ld.leaderKey
                                                          ]
                                                            ? 'rotate-90'
                                                            : ''
                                                        "
                                                      />
                                                    </button>
                                                    <span
                                                      v-else
                                                      class="ml-5 inline-block w-7 shrink-0 sm:ml-6 sm:w-8"
                                                    />
                                                    <div
                                                      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold sm:h-8 sm:w-8 sm:text-xs"
                                                      :class="
                                                        ld.sheet.initialsClass
                                                      "
                                                    >
                                                      {{ ld.sheet.initials }}
                                                    </div>
                                                    <div class="min-w-0 flex-1">
                                                      <p
                                                        class="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-800 transition-colors group-hover:text-indigo-600 sm:text-sm"
                                                      >
                                                        <span>{{
                                                          ld.sheet.name
                                                        }}</span>
                                                        <span
                                                          :class="
                                                            roleTagClass(
                                                              'leader',
                                                            )
                                                          "
                                                          >{{
                                                            ld.sheet.role
                                                          }}</span
                                                        >
                                                      </p>
                                                    </div>
                                                  </div>
                                                </td>
                                                <td
                                                  class="px-3 py-2 text-center sm:px-4 sm:py-2.5"
                                                >
                                                  <span
                                                    class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 sm:px-2 sm:py-1 sm:text-xs"
                                                  >
                                                    {{ ld.sheet.rank }}
                                                  </span>
                                                </td>
                                                <td
                                                  class="px-3 py-2 text-center sm:px-4 sm:py-2.5"
                                                >
                                                  <span
                                                    :class="
                                                      statusBadgeClass(ld.sheet)
                                                    "
                                                  >
                                                    <span
                                                      v-if="
                                                        ld.sheet.status ===
                                                        'pending_pm'
                                                      "
                                                      class="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500 animate-pulse"
                                                    />
                                                    <i
                                                      v-else-if="
                                                        ld.sheet.status ===
                                                        'self_scoring'
                                                      "
                                                      class="fas fa-pen text-[10px]"
                                                    />
                                                    <i
                                                      v-else
                                                      class="fas fa-check text-[10px]"
                                                    />
                                                    {{
                                                      assignmentProgressLabel(
                                                        ld.sheet,
                                                      )
                                                    }}
                                                  </span>
                                                </td>
                                                <td
                                                  class="bg-slate-50/80 px-3 py-2 text-center sm:px-4 sm:py-2.5"
                                                >
                                                  <span
                                                    v-if="
                                                      ld.sheet.selfScoreDisplay
                                                    "
                                                    class="font-bold text-slate-700"
                                                    >{{
                                                      ld.sheet.selfScoreDisplay
                                                    }}</span
                                                  >
                                                  <span
                                                    v-else
                                                    class="font-medium italic text-slate-400"
                                                    >-</span
                                                  >
                                                </td>
                                                <td
                                                  class="bg-indigo-50/40 px-3 py-2 text-center sm:px-4 sm:py-2.5"
                                                >
                                                  <span
                                                    :class="
                                                      pmPreviewClass(ld.sheet)
                                                    "
                                                    >{{
                                                      pmPreviewText(ld.sheet)
                                                    }}</span
                                                  >
                                                </td>
                                                <td
                                                  class="px-2 py-2 text-center sm:px-3 sm:py-2.5"
                                                  @click.stop
                                                >
                                                  <button
                                                    v-if="
                                                      canShowEvalActionButton(
                                                        ld.sheet,
                                                      )
                                                    "
                                                    type="button"
                                                    class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-200 bg-white text-indigo-600 shadow-sm transition-colors hover:bg-indigo-50 hover:text-indigo-800 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:shadow-none disabled:hover:bg-slate-50"
                                                    :disabled="
                                                      evalThaoTacDisabled(
                                                        ld.sheet,
                                                      )
                                                    "
                                                    :title="
                                                      evalThaoTacDisabled(
                                                        ld.sheet,
                                                      ) && !isReadonly
                                                        ? 'Chỉ mở khi trạng thái ASM là 502 hoặc 602'
                                                        : 'Mở đánh giá KPI'
                                                    "
                                                    aria-label="Mở đánh giá KPI"
                                                    @click="
                                                      toggleEvaluationDrawer(
                                                        ld.sheet,
                                                      )
                                                    "
                                                  >
                                                    <i
                                                      class="fas fa-clipboard-check text-xs"
                                                      aria-hidden="true"
                                                    />
                                                  </button>
                                                  <span
                                                    v-else
                                                    class="text-[11px] font-medium text-slate-300"
                                                    >—</span
                                                  >
                                                </td>
                                              </tr>
                                              <template
                                                v-if="ld.members.length"
                                              >
                                                <tr
                                                  class="border-0 bg-transparent"
                                                >
                                                  <td
                                                    colspan="6"
                                                    class="border-y-0 p-0 align-top"
                                                  >
                                                    <div
                                                      class="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
                                                      :class="
                                                        expandedLeaderKeys[
                                                          ld.leaderKey
                                                        ]
                                                          ? 'grid-rows-[1fr]'
                                                          : 'grid-rows-[0fr]'
                                                      "
                                                    >
                                                      <div class="min-h-0">
                                                        <table
                                                          class="gm-eval-hub-table w-full min-w-[800px] table-fixed text-left whitespace-nowrap text-xs sm:text-sm"
                                                        >
                                                          <colgroup>
                                                            <col
                                                              style="width: 36%"
                                                            />
                                                            <col
                                                              style="width: 8%"
                                                            />
                                                            <col
                                                              style="width: 18%"
                                                            />
                                                            <col
                                                              style="width: 12%"
                                                            />
                                                            <col
                                                              style="width: 14%"
                                                            />
                                                            <col
                                                              style="width: 12%"
                                                            />
                                                          </colgroup>
                                                          <tbody
                                                            class="divide-y divide-slate-200"
                                                          >
                                                            <tr
                                                              v-for="emp in ld.members"
                                                              :key="emp.id"
                                                              class="hover:bg-slate-50/80 transition-colors group"
                                                              :class="
                                                                drawerEmpId ===
                                                                emp.id
                                                                  ? 'bg-slate-100/80 border-l-4 border-indigo-500'
                                                                  : ''
                                                              "
                                                            >
                                                              <td
                                                                class="px-3 py-2.5 sm:px-4 sm:py-3"
                                                              >
                                                                <div
                                                                  class="flex items-center gap-1.5 pl-1 sm:pl-2"
                                                                >
                                                                  <span
                                                                    class="ml-5 inline-block h-7 w-7 shrink-0 sm:ml-6 sm:h-8 sm:w-8"
                                                                    aria-hidden="true"
                                                                  />
                                                                  <div
                                                                    class="flex min-w-0 flex-1 items-center gap-2 self-stretch border-l border-slate-200 pl-3 sm:pl-4"
                                                                  >
                                                                    <div
                                                                      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold sm:h-8 sm:w-8 sm:text-xs"
                                                                      :class="
                                                                        emp.initialsClass
                                                                      "
                                                                    >
                                                                      {{
                                                                        emp.initials
                                                                      }}
                                                                    </div>
                                                                    <div
                                                                      class="min-w-0 flex-1"
                                                                    >
                                                                      <p
                                                                        class="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-900 transition-colors group-hover:text-indigo-600 sm:text-sm"
                                                                      >
                                                                        <span>{{
                                                                          emp.name
                                                                        }}</span>
                                                                        <span
                                                                          :class="
                                                                            roleTagClass(
                                                                              'member',
                                                                            )
                                                                          "
                                                                          >{{
                                                                            emp.role
                                                                          }}</span
                                                                        >
                                                                      </p>
                                                                    </div>
                                                                  </div>
                                                                </div>
                                                              </td>
                                                              <td
                                                                class="px-3 py-2.5 text-center sm:px-4 sm:py-3"
                                                              >
                                                                <span
                                                                  class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 sm:px-2 sm:py-1 sm:text-xs"
                                                                >
                                                                  {{ emp.rank }}
                                                                </span>
                                                              </td>
                                                              <td
                                                                class="px-3 py-2.5 text-center sm:px-4 sm:py-3"
                                                              >
                                                                <span
                                                                  :class="
                                                                    statusBadgeClass(
                                                                      emp,
                                                                    )
                                                                  "
                                                                >
                                                                  <span
                                                                    v-if="
                                                                      emp.status ===
                                                                      'pending_pm'
                                                                    "
                                                                    class="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500 animate-pulse"
                                                                  />
                                                                  <i
                                                                    v-else-if="
                                                                      emp.status ===
                                                                      'self_scoring'
                                                                    "
                                                                    class="fas fa-pen text-[10px]"
                                                                  />
                                                                  <i
                                                                    v-else
                                                                    class="fas fa-check text-[10px]"
                                                                  />
                                                                  {{
                                                                    assignmentProgressLabel(
                                                                      emp,
                                                                    )
                                                                  }}
                                                                </span>
                                                              </td>
                                                              <td
                                                                class="bg-slate-50/80 px-3 py-2.5 text-center sm:px-4 sm:py-3"
                                                              >
                                                                <span
                                                                  v-if="
                                                                    emp.selfScoreDisplay
                                                                  "
                                                                  class="font-bold text-slate-700"
                                                                  >{{
                                                                    emp.selfScoreDisplay
                                                                  }}</span
                                                                >
                                                                <span
                                                                  v-else
                                                                  class="font-medium italic text-slate-400"
                                                                  >-</span
                                                                >
                                                              </td>
                                                              <td
                                                                class="bg-indigo-50/40 px-3 py-2.5 text-center sm:px-4 sm:py-3"
                                                              >
                                                                <span
                                                                  :class="
                                                                    pmPreviewClass(
                                                                      emp,
                                                                    )
                                                                  "
                                                                  >{{
                                                                    pmPreviewText(
                                                                      emp,
                                                                    )
                                                                  }}</span
                                                                >
                                                              </td>
                                                              <td
                                                                class="px-2 py-2.5 text-center sm:px-3"
                                                                @click.stop
                                                              >
                                                                <button
                                                                  v-if="
                                                                    canShowEvalActionButton(
                                                                      emp,
                                                                    )
                                                                  "
                                                                  type="button"
                                                                  class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-200 bg-white text-indigo-600 shadow-sm transition-colors hover:bg-indigo-50 hover:text-indigo-800 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:shadow-none disabled:hover:bg-slate-50"
                                                                  :disabled="
                                                                    evalThaoTacDisabled(
                                                                      emp,
                                                                    )
                                                                  "
                                                                  :title="
                                                                    evalThaoTacDisabled(
                                                                      emp,
                                                                    ) &&
                                                                    !isReadonly
                                                                      ? 'Chỉ mở khi trạng thái ASM là 502 hoặc 602'
                                                                      : 'Mở đánh giá KPI'
                                                                  "
                                                                  aria-label="Mở đánh giá KPI"
                                                                  @click="
                                                                    toggleEvaluationDrawer(
                                                                      emp,
                                                                    )
                                                                  "
                                                                >
                                                                  <i
                                                                    class="fas fa-clipboard-check text-xs"
                                                                    aria-hidden="true"
                                                                  />
                                                                </button>
                                                                <span
                                                                  v-else
                                                                  class="text-[11px] font-medium text-slate-300"
                                                                  >—</span
                                                                >
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

                                            <tr
                                              v-for="emp in br.directMembers"
                                              :key="emp.id"
                                              class="hover:bg-slate-50/80 transition-colors group"
                                              :class="
                                                drawerEmpId === emp.id
                                                  ? 'bg-slate-100/80 border-l-4 border-indigo-500'
                                                  : ''
                                              "
                                            >
                                              <td
                                                class="px-3 py-2.5 sm:px-4 sm:py-3"
                                              >
                                                <div
                                                  class="flex items-center gap-1.5 pl-1 sm:pl-2"
                                                >
                                                  <span
                                                    class="ml-5 inline-block h-7 w-7 shrink-0 sm:ml-6 sm:h-8 sm:w-8"
                                                    aria-hidden="true"
                                                  />
                                                  <div
                                                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold sm:h-8 sm:w-8 sm:text-xs"
                                                    :class="emp.initialsClass"
                                                  >
                                                    {{ emp.initials }}
                                                  </div>
                                                  <div class="min-w-0 flex-1">
                                                    <p
                                                      class="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-900 transition-colors group-hover:text-indigo-600 sm:text-sm"
                                                    >
                                                      <span>{{
                                                        emp.name
                                                      }}</span>
                                                      <span
                                                        :class="
                                                          roleTagClass('member')
                                                        "
                                                        >{{ emp.role }}</span
                                                      >
                                                    </p>
                                                  </div>
                                                </div>
                                              </td>
                                              <td
                                                class="px-3 py-2.5 text-center sm:px-4 sm:py-3"
                                              >
                                                <span
                                                  class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 sm:px-2 sm:py-1 sm:text-xs"
                                                >
                                                  {{ emp.rank }}
                                                </span>
                                              </td>
                                              <td
                                                class="px-3 py-2.5 text-center sm:px-4 sm:py-3"
                                              >
                                                <span
                                                  :class="statusBadgeClass(emp)"
                                                >
                                                  <span
                                                    v-if="
                                                      emp.status ===
                                                      'pending_pm'
                                                    "
                                                    class="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500 animate-pulse"
                                                  />
                                                  <i
                                                    v-else-if="
                                                      emp.status ===
                                                      'self_scoring'
                                                    "
                                                    class="fas fa-pen text-[10px]"
                                                  />
                                                  <i
                                                    v-else
                                                    class="fas fa-check text-[10px]"
                                                  />
                                                  {{
                                                    assignmentProgressLabel(emp)
                                                  }}
                                                </span>
                                              </td>
                                              <td
                                                class="bg-slate-50/80 px-3 py-2.5 text-center sm:px-4 sm:py-3"
                                              >
                                                <span
                                                  v-if="emp.selfScoreDisplay"
                                                  class="font-bold text-slate-700"
                                                  >{{
                                                    emp.selfScoreDisplay
                                                  }}</span
                                                >
                                                <span
                                                  v-else
                                                  class="font-medium italic text-slate-400"
                                                  >-</span
                                                >
                                              </td>
                                              <td
                                                class="bg-indigo-50/40 px-3 py-2.5 text-center sm:px-4 sm:py-3"
                                              >
                                                <span
                                                  :class="pmPreviewClass(emp)"
                                                  >{{
                                                    pmPreviewText(emp)
                                                  }}</span
                                                >
                                              </td>
                                              <td
                                                class="px-2 py-2.5 text-center sm:px-3"
                                                @click.stop
                                              >
                                                <button
                                                  v-if="
                                                    canShowEvalActionButton(emp)
                                                  "
                                                  type="button"
                                                  class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-200 bg-white text-indigo-600 shadow-sm transition-colors hover:bg-indigo-50 hover:text-indigo-800 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:shadow-none disabled:hover:bg-slate-50"
                                                  :disabled="
                                                    evalThaoTacDisabled(emp)
                                                  "
                                                  :title="
                                                    evalThaoTacDisabled(emp) &&
                                                    !isReadonly
                                                      ? 'Chỉ mở khi trạng thái ASM là 502 hoặc 602'
                                                      : 'Mở đánh giá KPI'
                                                  "
                                                  aria-label="Mở đánh giá KPI"
                                                  @click="
                                                    toggleEvaluationDrawer(emp)
                                                  "
                                                >
                                                  <i
                                                    class="fas fa-clipboard-check text-xs"
                                                    aria-hidden="true"
                                                  />
                                                </button>
                                                <span
                                                  v-else
                                                  class="text-[11px] font-medium text-slate-300"
                                                  >—</span
                                                >
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
                            </template>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <div
          v-if="
            usePmTree
              ? pmEvalSectionsForDisplay.length === 0
              : filteredEmployees.length === 0
          "
          class="px-4 py-10 text-center text-xs font-medium text-slate-500 sm:py-12 sm:text-sm"
        >
          {{ emptyFilterMessage }}
        </div>
      </div>

      <Teleport to="body">
        <Transition name="gm-eval-drawer">
          <div
            v-if="drawerEmployee && hasKpis(drawerEmployee)"
            class="fixed inset-0 z-[100]"
          >
            <div
              class="gm-eval-drawer-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
              @click="closeEvaluationDrawer"
            />
            <div
              class="gm-eval-drawer-panel absolute bottom-0 right-0 top-0 flex w-full max-w-full flex-col border-l border-slate-200 bg-slate-50 shadow-[0_0_40px_rgba(0,0,0,0.2)] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-[min(80rem,calc(100vw-1.5rem))]"
            >
              <div
                class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5"
              >
                <div class="min-w-0">
                  <p
                    class="text-[10px] font-bold uppercase tracking-wider text-slate-500"
                  >
                    Đánh giá KPI
                  </p>
                  <h2
                    class="truncate text-base font-bold text-slate-900 sm:text-lg"
                  >
                    {{ drawerEmployee.name }}
                  </h2>
                </div>
                <button
                  type="button"
                  class="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Đóng"
                  @click="closeEvaluationDrawer"
                >
                  <i class="fas fa-times text-lg" />
                </button>
              </div>

              <div class="min-h-0 flex-1 overflow-y-auto">
                <div class="p-4 sm:p-5">
                  <div
                    class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md"
                  >
                    <div
                      class="border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-5"
                    >
                      <h3
                        class="flex items-center gap-2 text-base font-bold text-slate-800"
                      >
                        <i
                          class="fas fa-list text-indigo-600"
                          aria-hidden="true"
                        />
                        Bảng đánh giá chi tiết — {{ effectiveYear }}
                      </h3>
                      <p
                        class="mt-0.5 text-[11px] font-medium text-slate-500 sm:text-xs"
                      >
                        {{ flattenGmKpiItems(drawerEmployee).length }} hạng mục
                        tổng cộng
                        <span class="text-slate-400">·</span>
                        Đang xem:
                        {{
                          drawerEvalTab === "cascade"
                            ? `${drawerCascadeItemCount} KPI theo khía cạnh BSC (Individual / Cascading)`
                            : `${drawerPromotionItemCount} KPI Promotion`
                        }}
                      </p>
                    </div>

                    <!-- Tab bao bọc toàn bộ bảng KPI (thead/tbody/tfoot) -->
                    <div class="border-b border-slate-200 bg-white">
                      <div
                        class="flex w-full border-b border-slate-200 bg-slate-100/90 px-2 pt-2 sm:px-3 sm:pt-2.5"
                        role="tablist"
                        aria-label="Loại KPI đánh giá"
                      >
                        <button
                          type="button"
                          role="tab"
                          :aria-selected="drawerEvalTab === 'cascade'"
                          class="min-h-[2.75rem] flex-1 rounded-t-lg border border-b-0 px-2 py-2 text-center text-[11px] font-bold transition-colors sm:min-h-0 sm:px-4 sm:text-xs"
                          :class="
                            drawerEvalTab === 'cascade'
                              ? 'relative z-[1] border-slate-200 bg-white text-indigo-800 shadow-[0_-1px_0_0_white]'
                              : 'border-transparent bg-transparent text-slate-600 hover:bg-slate-50/80'
                          "
                          @click="drawerEvalTab = 'cascade'"
                        >
                          BSC — Individual / Cascading
                          <span
                            class="block font-semibold opacity-90 sm:inline sm:ml-0.5"
                            >({{ drawerCascadeItemCount }})</span
                          >
                        </button>
                        <button
                          type="button"
                          role="tab"
                          :aria-selected="drawerEvalTab === 'promotion'"
                          class="min-h-[2.75rem] flex-1 rounded-t-lg border border-b-0 px-2 py-2 text-center text-[11px] font-bold transition-colors sm:min-h-0 sm:px-4 sm:text-xs"
                          :class="
                            drawerEvalTab === 'promotion'
                              ? 'relative z-[1] border-slate-200 bg-white text-indigo-800 shadow-[0_-1px_0_0_white]'
                              : 'border-transparent bg-transparent text-slate-600 hover:bg-slate-50/80'
                          "
                          @click="drawerEvalTab = 'promotion'"
                        >
                          Promotion
                          <span
                            class="block font-semibold opacity-90 sm:inline sm:ml-0.5"
                            >({{ drawerPromotionItemCount }})</span
                          >
                        </button>
                      </div>

                      <div class="overflow-x-auto bg-white">
                        <table class="w-full text-left">
                          <thead>
                            <tr
                              class="border-b border-slate-200 bg-slate-100/50 text-[11px] font-bold uppercase tracking-wider text-slate-500"
                            >
                              <th class="w-10 px-4 py-3 text-center">#</th>
                              <th
                                class="min-w-[18rem] px-4 py-3 sm:min-w-[22rem] lg:min-w-[26rem]"
                              >
                                Hạng mục (Objectives)
                              </th>
                              <th
                                class="w-28 min-w-[7rem] px-4 py-3 text-center sm:w-32"
                              >
                                Trọng số
                              </th>
                              <th
                                class="w-44 min-w-[11rem] px-4 py-3 text-center sm:w-52 sm:min-w-[13rem]"
                              >
                                Bằng chứng
                              </th>
                              <th
                                class="w-32 min-w-[8rem] px-4 py-3 text-center sm:w-36"
                              >
                                Self Score
                              </th>
                              <th
                                class="w-36 min-w-[9rem] border-l border-indigo-100 bg-indigo-50/50 px-4 py-3 text-center text-indigo-800 shadow-inner sm:w-40"
                              >
                                {{ gmScoreDetailLabel }}
                                <span
                                  v-if="
                                    drawerRequiresGmFinalGrading(
                                      drawerEmployee,
                                    )
                                  "
                                  class="text-rose-500"
                                  >*</span
                                >
                              </th>
                            </tr>
                          </thead>
                          <tbody
                            v-if="drawerActiveKpiGroups.length === 0"
                            class="text-sm"
                          >
                            <tr>
                              <td
                                colspan="6"
                                class="px-4 py-12 text-center text-sm font-medium text-slate-500"
                              >
                                Không có KPI trong tab này.
                              </td>
                            </tr>
                          </tbody>
                          <tbody
                            v-else
                            class="divide-y divide-slate-200 text-sm"
                          >
                            <template
                              v-for="group in drawerActiveKpiGroups"
                              :key="group.groupTitle"
                            >
                              <tr class="border-y border-slate-200 bg-slate-50">
                                <td
                                  colspan="6"
                                  class="px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-indigo-900"
                                >
                                  {{ group.groupTitle }}
                                </td>
                              </tr>
                              <template
                                v-for="item in group.items"
                                :key="item.id"
                              >
                                <tr
                                  class="transition-colors hover:bg-slate-50/50"
                                >
                                  <td
                                    class="px-4 py-4 text-center font-bold text-slate-400"
                                  >
                                    {{ item.index }}
                                  </td>
                                  <td class="px-4 py-4">
                                    <p class="font-bold text-slate-900">
                                      {{ item.title }}
                                    </p>
                                  </td>
                                  <td
                                    class="min-w-[7rem] px-4 py-4 text-center sm:min-w-[8rem]"
                                  >
                                    <span
                                      class="rounded bg-slate-100 px-2 py-1 font-bold text-slate-700"
                                      >{{ item.weight }}</span
                                    >
                                  </td>
                                  <td
                                    class="min-w-[11rem] px-4 py-4 text-center sm:min-w-[13rem]"
                                  >
                                    <button
                                      type="button"
                                      class="inline-flex w-full min-w-0 items-center justify-between gap-1 rounded-lg border px-3 py-1.5 text-[11px] font-bold shadow-sm transition-colors"
                                      :class="[
                                        item.evidenceTone === 'emerald'
                                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                          : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
                                        evidenceOpen(drawerEmployee.id, item.id)
                                          ? 'ring-2 ring-blue-300'
                                          : '',
                                      ]"
                                      @click.stop="
                                        toggleEvidence(
                                          drawerEmployee.id,
                                          item.id,
                                        )
                                      "
                                    >
                                      <span class="flex items-center gap-1.5">
                                        <i
                                          :class="[
                                            item.evidenceButtonIcon,
                                            'text-[11px]',
                                          ]"
                                        />
                                        {{ item.evidenceButtonLabel }}
                                      </span>
                                      <i
                                        class="fas fa-chevron-down text-[10px] transition-transform duration-200"
                                        :class="
                                          evidenceOpen(
                                            drawerEmployee.id,
                                            item.id,
                                          )
                                            ? 'rotate-180'
                                            : ''
                                        "
                                      />
                                    </button>
                                  </td>
                                  <td
                                    class="min-w-[8rem] px-4 py-4 text-center sm:min-w-[9rem]"
                                  >
                                    <div
                                      class="inline-block min-w-[2.75rem] rounded bg-slate-100 px-3 py-1.5 text-base font-bold text-slate-600"
                                    >
                                      {{ item.selfScore }}
                                    </div>
                                  </td>
                                  <td
                                    class="min-w-[9rem] border-l border-indigo-50 bg-indigo-50/30 px-4 py-4 text-center sm:min-w-[10rem]"
                                  >
                                    <select
                                      class="w-full min-w-[7rem] cursor-pointer rounded-lg border-2 bg-white p-1.5 text-center text-base font-bold shadow-sm outline-none transition-colors focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
                                      :class="
                                        pmSelectClass(drawerEmployee, item)
                                      "
                                      :disabled="
                                        isReadonly ||
                                        !hubRowGmScoreEnabled(item)
                                      "
                                      :value="
                                        pmScores[drawerEmployee.id]?.[
                                          item.id
                                        ] ?? ''
                                      "
                                      @change="
                                        setPmScore(
                                          drawerEmployee.id,
                                          item.id,
                                          ($event.target as HTMLSelectElement)
                                            .value,
                                        )
                                      "
                                    >
                                      <option value="">-</option>
                                      <option
                                        v-for="n in 5"
                                        :key="n"
                                        :value="6 - n"
                                      >
                                        {{ 6 - n }}
                                      </option>
                                    </select>
                                  </td>
                                </tr>
                                <tr
                                  v-show="
                                    evidenceOpen(drawerEmployee.id, item.id)
                                  "
                                  class="bg-slate-100/40"
                                >
                                  <td
                                    colspan="6"
                                    class="p-0"
                                    :class="
                                      evidencePanelBorder(item.evidence.accent)
                                    "
                                  >
                                    <div
                                      class="border-l-4 p-4 md:p-6"
                                      :class="
                                        evidenceAccentBorder(
                                          item.evidence.accent,
                                        )
                                      "
                                    >
                                      <h4
                                        class="mb-3 flex items-center text-sm font-bold text-slate-800"
                                      >
                                        <i
                                          :class="[
                                            item.evidence.icon,
                                            'mr-2 w-4 text-indigo-600',
                                          ]"
                                        />
                                        {{ item.evidence.title }}
                                      </h4>
                                      <p
                                        v-if="item.evidence.attachmentUrl"
                                        class="mb-3"
                                      >
                                        <a
                                          :href="item.evidence.attachmentUrl"
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          class="inline-flex max-w-full items-center gap-2 break-all text-sm font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                                        >
                                          <i
                                            class="fas fa-paperclip shrink-0 text-xs"
                                          />
                                          <span>{{
                                            item.evidence.attachmentLabel ??
                                            "Xem bằng chứng đính kèm"
                                          }}</span>
                                        </a>
                                      </p>
                                      <table
                                        v-if="item.evidence.rows.length > 0"
                                        class="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-left text-sm shadow-sm"
                                      >
                                        <thead
                                          class="bg-slate-50 text-xs uppercase tracking-wider text-slate-600"
                                        >
                                          <tr>
                                            <th
                                              v-for="(h, hi) in item.evidence
                                                .headers"
                                              :key="hi"
                                              class="border-b border-slate-200 p-3"
                                              :class="
                                                hi > 0 ? 'text-center' : ''
                                              "
                                            >
                                              {{ h }}
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody
                                          class="divide-y divide-slate-100"
                                        >
                                          <tr
                                            v-for="(row, ri) in item.evidence
                                              .rows"
                                            :key="ri"
                                          >
                                            <td
                                              v-for="(cell, ci) in row"
                                              :key="ci"
                                              class="p-3 font-medium"
                                              :class="
                                                ci > 0
                                                  ? 'text-center text-slate-800'
                                                  : 'text-slate-700'
                                              "
                                            >
                                              <a
                                                v-if="
                                                  isEvidenceCellHttpUrl(cell)
                                                "
                                                :href="cell.trim()"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="break-all font-semibold text-indigo-600 hover:underline"
                                              >
                                                {{ cell }}
                                              </a>
                                              <template v-else>{{
                                                cell
                                              }}</template>
                                            </td>
                                          </tr>
                                        </tbody>
                                        <tfoot
                                          v-if="item.evidence.footer"
                                          class="bg-slate-50 font-bold"
                                        >
                                          <tr>
                                            <td
                                              v-for="(cell, fi) in item.evidence
                                                .footer"
                                              :key="fi"
                                              class="p-3"
                                              :class="
                                                fi > 0
                                                  ? 'text-center'
                                                  : 'text-right'
                                              "
                                            >
                                              <a
                                                v-if="
                                                  isEvidenceCellHttpUrl(cell)
                                                "
                                                :href="cell.trim()"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="break-all font-semibold text-indigo-600 hover:underline"
                                              >
                                                {{ cell }}
                                              </a>
                                              <template v-else>{{
                                                cell
                                              }}</template>
                                            </td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                      <p
                                        v-else
                                        class="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-xs italic text-slate-500"
                                      >
                                        Chưa có dữ liệu minh chứng.
                                      </p>
                                      <div
                                        v-if="hubRowGmCommentEnabled(item)"
                                        class="mt-4 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3"
                                      >
                                        <label
                                          class="mb-2 block text-[11px] font-bold uppercase tracking-wider text-indigo-700"
                                        >
                                          GM Comment (Theo từng KPI)
                                        </label>
                                        <textarea
                                          v-model="gmKpiComments[drawerEmployee.id][item.id]"
                                          class="w-full resize-y rounded-lg border border-indigo-200 bg-white p-2.5 text-sm text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500"
                                          rows="3"
                                          :disabled="isReadonly || confirmBusy"
                                          placeholder="Nhập nhận xét của GM cho KPI này..."
                                        />
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              </template>
                            </template>
                          </tbody>
                          <tfoot
                            class="border-t-2 border-slate-200 bg-slate-100/80 text-xs font-semibold text-slate-700"
                          >
                            <tr>
                              <td
                                colspan="2"
                                class="px-4 py-2.5 text-right text-[10px] uppercase tracking-wide text-slate-500 sm:text-[11px]"
                              >
                                Tổng trọng số (Total Weight):
                              </td>
                              <td
                                class="px-4 py-2.5 text-center text-slate-800"
                              >
                                {{
                                  totalKpiWeightForGroupList(
                                    drawerActiveKpiGroups,
                                  )
                                }}
                              </td>
                              <td colspan="3" />
                            </tr>
                            <tr class="border-t border-slate-200 bg-white">
                              <td
                                colspan="4"
                                class="px-4 py-2.5 text-right text-[10px] font-bold uppercase leading-snug tracking-wide text-slate-600 sm:text-[11px]"
                              >
                                Điểm TB tự chấm (Self-Avg)
                              </td>
                              <td
                                class="border-x border-slate-200 px-4 py-2.5 text-center"
                              >
                                <span
                                  class="text-base font-bold tabular-nums text-slate-800 sm:text-lg"
                                  >{{
                                    selfAvgForGroupList(
                                      drawerEmployee,
                                      drawerActiveKpiGroups,
                                    )
                                  }}</span
                                >
                              </td>
                              <td />
                            </tr>
                            <tr
                              class="border-t border-slate-200 bg-indigo-50/90"
                            >
                              <td
                                colspan="5"
                                class="px-4 py-2.5 text-right text-[10px] font-bold uppercase leading-snug tracking-wide text-indigo-900 sm:text-[11px]"
                              >
                                Điểm trung bình ({{ gmScoreDetailLabel }})
                              </td>
                              <td
                                class="bg-indigo-100/90 px-4 py-2.5 text-center shadow-inner"
                              >
                                <span
                                  class="text-base font-bold tabular-nums text-indigo-800 sm:text-lg"
                                  >{{
                                    pmAvgForGroupList(
                                      drawerEmployee,
                                      drawerActiveKpiGroups,
                                    )
                                  }}</span
                                >
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    <div class="border-t border-slate-200 bg-white p-6">
                      <h4
                        class="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800"
                      >
                        <i class="fas fa-comment-dots text-indigo-600" />
                        Tổng kết đánh giá &amp; xác nhận (Final Review)
                      </h4>
                      <div
                        class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8"
                      >
                        <div class="pointer-events-none space-y-2 opacity-80">
                          <label
                            class="block text-[11px] font-bold uppercase tracking-wider text-slate-500"
                          >
                            Employee's Comment (Read-only)
                          </label>
                          <div
                            class="h-24 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600"
                          >
                            {{ drawerEmployee.employeeComment ?? "—" }}
                          </div>
                        </div>
                        <div class="space-y-2">
                          <label
                            class="block text-[11px] font-bold uppercase tracking-wider text-indigo-600"
                          >
                            {{
                              drawerRequiresGmFinalGrading(drawerEmployee)
                                ? "Supervisor Comment (Required)"
                                : "Supervisor Comment (Giữa năm — không bắt buộc)"
                            }}
                          </label>
                          <textarea
                            v-model="supervisorComments[drawerEmployee.id]"
                            class="h-24 w-full resize-none rounded-lg border-2 border-indigo-200 bg-white p-3 text-sm text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500"
                            :disabled="
                              isReadonly ||
                              !drawerRequiresGmFinalGrading(drawerEmployee)
                            "
                            :placeholder="
                              drawerRequiresGmFinalGrading(drawerEmployee)
                                ? 'Nhập ý kiến nhận xét tổng thể để giải thích cho mức điểm bạn vừa chấm...'
                                : 'Giữa năm: không cần nhận xét tại bước này.'
                            "
                          />
                        </div>
                      </div>
                      <div
                        class="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3 sm:mt-6 sm:gap-2.5 sm:pt-4"
                      >
                        <button
                          type="button"
                          class="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 sm:px-4 sm:text-sm disabled:cursor-not-allowed disabled:opacity-50"
                          :disabled="isReadonly || confirmBusy"
                          @click="saveDraft(drawerEmployee)"
                        >
                          Lưu nháp
                        </button>
                        <button
                          type="button"
                          class="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 sm:gap-2 sm:px-4 sm:text-sm disabled:cursor-not-allowed disabled:opacity-50"
                          :disabled="isReadonly || confirmBusy"
                          @click="confirmDone(drawerEmployee)"
                        >
                          <i
                            class="fas fa-check-circle text-[11px] sm:text-xs"
                            aria-hidden="true"
                          />
                          {{
                            drawerRequiresGmFinalGrading(drawerEmployee)
                              ? "Xác nhận đánh giá"
                              : "Hoàn thành Review"
                          }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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

.gm-eval-drawer-enter-active,
.gm-eval-drawer-leave-active {
  transition-duration: 0.3s;
}
.gm-eval-drawer-enter-active .gm-eval-drawer-backdrop,
.gm-eval-drawer-leave-active .gm-eval-drawer-backdrop {
  transition: opacity 0.3s ease;
}
.gm-eval-drawer-enter-active .gm-eval-drawer-panel,
.gm-eval-drawer-leave-active .gm-eval-drawer-panel {
  transition: transform 0.3s ease-out;
}
.gm-eval-drawer-enter-from .gm-eval-drawer-backdrop,
.gm-eval-drawer-leave-to .gm-eval-drawer-backdrop {
  opacity: 0;
}
.gm-eval-drawer-enter-to .gm-eval-drawer-backdrop,
.gm-eval-drawer-leave-from .gm-eval-drawer-backdrop {
  opacity: 1;
}
.gm-eval-drawer-enter-from .gm-eval-drawer-panel,
.gm-eval-drawer-leave-to .gm-eval-drawer-panel {
  transform: translateX(100%);
}
.gm-eval-drawer-enter-to .gm-eval-drawer-panel,
.gm-eval-drawer-leave-from .gm-eval-drawer-panel {
  transform: translateX(0);
}

@media (prefers-reduced-motion: reduce) {
  .gm-eval-drawer-enter-active,
  .gm-eval-drawer-leave-active,
  .gm-eval-drawer-enter-active .gm-eval-drawer-backdrop,
  .gm-eval-drawer-leave-active .gm-eval-drawer-backdrop,
  .gm-eval-drawer-enter-active .gm-eval-drawer-panel,
  .gm-eval-drawer-leave-active .gm-eval-drawer-panel {
    transition-duration: 0.01ms !important;
  }
}
</style>
