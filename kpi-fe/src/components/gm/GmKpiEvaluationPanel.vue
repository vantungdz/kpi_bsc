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
} from "@/utils/gmEmployeeEvaluation";
import type {
  GmEvalMember,
  GmEvalPmBranch,
  GmKpiGroup,
  GmKpiItem,
} from "@/types/gm-employee-evaluation";
import { isReadonlyKpiYear } from "@/utils/kpi-year";
import { gmKpiService } from "@/services/modules/kpi-gm.service";
import {
  isEvidenceImageUrl,
  isRecordStyleCalcRule,
  normalizeEvidenceHref,
} from "@/utils/memberKpiHelpers";

const props = withDefaults(
  defineProps<{
    employees: GmEvalMember[];
    contextSubtitle?: string;
    /** `pm` = hub: cột và copy dùng “PM” thay cho “nhân viên”. */
    listEntity?: "member" | "pm";
    /** Khi có dữ liệu: bảng hub hiển thị dạng PM → Leader → Member (expand). */
    pmBranches?: GmEvalPmBranch[] | null;
    activePhase?: string | null;
  }>(),
  {
    contextSubtitle: "",
    listEntity: "member",
    pmBranches: null,
    activePhase: null,
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
const codeColumnLabel = computed(() => (isPmList.value ? "PM code" : "Employee code"));
const nameColumnLabel = computed(() =>
  isPmList.value ? "PM name" : "Employee name",
);
const gmScoreColumnLabel = computed(() =>
  isPmList.value ? "Supervisor Score" : "PM score",
);
const gmScoreDetailLabel = computed(() =>
  isPmList.value ? "Supervisor Score" : "PM Score",
);
const searchPlaceholder = computed(() =>
  usePmTree.value
    ? "Filter by section, PM, leader, employee, or code..."
    : isPmList.value
      ? "Filter by PM name or unit..."
      : "Filter by employee name...",
);
const emptyFilterMessage = computed(() => "No people match the filter.");

/** Chỉ dùng khi panel không nằm trong GM layout (không có inject năm). */
const selectedYear = ref(2026);
const showYearDropdown = computed(() => layoutYear == null);
const effectiveYear = computed(() =>
  layoutYear != null ? layoutYear.value : selectedYear.value,
);
const nameFilter = ref("");
const listFilter = ref<"all" | "pending">("all");
const drawerEmpId = ref<string | null>(null);
const tableEvalTab = ref<"cascade" | "promotion">("cascade");
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
const supervisorPortfolioComments = reactive<Record<string, string>>({});
const supervisorPromotionComments = reactive<Record<string, string>>({});
/** `${empId}:cascade` | `${empId}:promotion` */
const supervisorCommentSubmitAttempted = reactive<Record<string, boolean>>({});
const banner = ref<{ type: "ok" | "info"; text: string } | null>(null);
const confirmBusy = ref(false);
const unlockBusy = ref(false);
const unlockConfirmTarget = ref<{ emp: GmEvalMember; tab: "cascade" | "promotion" } | null>(null);
const pageLoading = ref(true);

const isReadonly = computed(() => isReadonlyKpiYear(effectiveYear.value));

function gmKpiSortText(item: GmKpiItem): string {
  return String(item?.title ?? "").trim();
}

function compareKpiNameEn(a: GmKpiItem, b: GmKpiItem): number {
  return gmKpiSortText(a).localeCompare(gmKpiSortText(b), "en", {
    sensitivity: "base",
    numeric: true,
  });
}

function sortKpiGroupItemsByNameEn(groups: GmKpiGroup[]): GmKpiGroup[] {
  return groups.map((group) => ({
    ...group,
    items: [...group.items].sort(compareKpiNameEn),
  }));
}

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

function groupsForEvalTab(emp: GmEvalMember, tab: "cascade" | "promotion") {
  return tab === "promotion"
    ? emp.groups.filter((g) => isGmEvalPromotionKpiGroup(g))
    : emp.groups.filter((g) => !isGmEvalPromotionKpiGroup(g));
}

function itemsForEvalTab(emp: GmEvalMember, tab: "cascade" | "promotion") {
  return groupsForEvalTab(emp, tab).flatMap((g) => g.items);
}

function hasKpisForEvalTab(emp: GmEvalMember, tab: "cascade" | "promotion") {
  return itemsForEvalTab(emp, tab).length > 0;
}

function hasGmEvaluationActionForTab(emp: GmEvalMember, tab: "cascade" | "promotion") {
  return itemsForEvalTab(emp, tab).some((item) => {
    const code = Number(item.hubAssignmentStatusCode);
    return code === 502 || code === 602;
  });
}

const GM_UNLOCK_DISABLED_STATUS_CODES = new Set([401, 402, 403, 404, 407, 603]);

function hasUnlockButtonForTab(emp: GmEvalMember, tab: "cascade" | "promotion") {
  return hasKpisForEvalTab(emp, tab);
}

function hasUnlockableKpisForTab(emp: GmEvalMember, tab: "cascade" | "promotion") {
  return itemsForEvalTab(emp, tab).some((item) => {
    const code = Number(item.hubAssignmentStatusCode);
    return Number.isFinite(code) && !GM_UNLOCK_DISABLED_STATUS_CODES.has(code);
  });
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

function drawerHasAssignmentsInStatus(emp: GmEvalMember, code: 502 | 602): boolean {
  return flattenGmKpiItems(emp).some((it) => Number(it.hubAssignmentStatusCode) === code)
}

/** Chỉ các dòng assignment đang chờ GM theo từng phase (gửi confirm hub). */
function itemsForHubConfirmScopeForTab(
  emp: GmEvalMember,
  scope: 502 | 602,
  tab: "cascade" | "promotion",
): GmKpiItem[] {
  const groups =
    groupsForEvalTab(emp, tab);
  const items = groups.flatMap((g) => g.items);
  return items.filter(
    (it) => Boolean(it.id) && Number(it.hubAssignmentStatusCode) === scope,
  );
}

function drawerHasAssignmentsInStatusForTab(
  emp: GmEvalMember,
  code: 502 | 602,
  tab: "cascade" | "promotion",
): boolean {
  return itemsForHubConfirmScopeForTab(emp, code, tab).length > 0;
}

function supervisorCommentEditable(
  emp: GmEvalMember,
  tab: "cascade" | "promotion",
): boolean {
  return (
    drawerHasAssignmentsInStatusForTab(emp, 502, tab) ||
    drawerHasAssignmentsInStatusForTab(emp, 602, tab)
  );
}

function supervisorCommentPlaceholder(
  emp: GmEvalMember,
  tab: "cascade" | "promotion",
): string {
  if (drawerHasAssignmentsInStatusForTab(emp, 602, tab)) {
    return "Enter an overall supervisor comment explaining the scores you assigned...";
  }
  if (drawerHasAssignmentsInStatusForTab(emp, 502, tab)) {
    return "Optional during mid-year review. You can keep the PM comment or edit it before completing review.";
  }
  return "";
}

function drawerRequiresGmFinalGradingForTab(
  emp: GmEvalMember,
  tab: "cascade" | "promotion",
): boolean {
  const groups =
    groupsForEvalTab(emp, tab);
  return groups.flatMap((g) => g.items).some((it) => hubRowGmScoreEnabled(it));
}

function supervisorAttemptKey(empId: string, tab: "cascade" | "promotion") {
  return `${empId}:${tab}`;
}

function evidenceKey(empId: string, kpiId: string) {
  return `${empId}:${kpiId}`;
}

/** Chỉ cho phép http(s) — tránh `javascript:` trong ô mock. */
function isEvidenceCellHttpUrl(raw: unknown): raw is string {
  const s = String(raw ?? "").trim();
  return /^https?:\/\//i.test(s);
}

function usesPmStyleEvidence(item: GmKpiItem): boolean {
  return (
    item.evidenceData !== undefined ||
    item.evidenceContent !== undefined ||
    item.evidenceAttachments !== undefined
  );
}

function gmEvidenceColspan(item: GmKpiItem): number {
  return isRecordStyleCalcRule(item.calcRuleCode) ? 2 : 3;
}

function gmEvidenceText(raw: unknown): string {
  const s = String(raw ?? "").trim();
  return s || "—";
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

/** Cột Supervisor Score: ưu tiên nháp GM đang chọn, rồi điểm GM đã lưu, cuối cùng điểm PM khi GM chưa chấm. */
function currentDisplayableGmScore(emp: GmEvalMember, item: GmKpiItem): number | null {
  if (gmScoreTouched[emp.id]?.[item.id]) {
    const draft = pmScores[emp.id]?.[item.id];
    if (draft != null && draft > 0) return draft;
  }
  const persistedGm = item.pmScore;
  if (persistedGm != null && persistedGm > 0) return persistedGm;
  const pmOrSeed = item.pmSeedScore;
  if (pmOrSeed != null && pmOrSeed > 0) return pmOrSeed;
  return null;
}

function initSupervisorCommentDraft(emp: GmEvalMember, reset = false) {
  if (reset || supervisorPortfolioComments[emp.id] === undefined) {
    supervisorPortfolioComments[emp.id] = String(
      emp.supervisorCommentPortfolio ?? emp.supervisorComment ?? "",
    );
  }
  if (reset || supervisorPromotionComments[emp.id] === undefined) {
    supervisorPromotionComments[emp.id] = String(
      emp.supervisorCommentPromotion ?? "",
    );
  }
  if (reset) {
    supervisorCommentSubmitAttempted[supervisorAttemptKey(emp.id, "cascade")] =
      false;
    supervisorCommentSubmitAttempted[supervisorAttemptKey(emp.id, "promotion")] =
      false;
  }
}

/** Hiển thị viền/đỏ + thông báo lỗi khi đã bấm xác nhận cuối năm mà Supervisor Comment trống (theo tab). */
function supervisorCommentInvalid(
  emp: GmEvalMember,
  tab: "cascade" | "promotion",
): boolean {
  if (!drawerHasAssignmentsInStatusForTab(emp, 602, tab)) return false;
  if (!supervisorCommentSubmitAttempted[supervisorAttemptKey(emp.id, tab)])
    return false;
  const c =
    tab === "promotion"
      ? (supervisorPromotionComments[emp.id] ?? "").trim()
      : (supervisorPortfolioComments[emp.id] ?? "").trim();
  return !c;
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

function selfPreviewTextForTab(emp: GmEvalMember, tab = tableEvalTab.value) {
  const groups = groupsForEvalTab(emp, tab);
  if (!flattenGmKpiItemsFromGroups(groups).length) return "";
  return selfAvgForGroupList(emp, groups);
}

function pmPreviewTextForTab(emp: GmEvalMember, tab = tableEvalTab.value) {
  const groups = groupsForEvalTab(emp, tab);
  return pmAvgForGroupList(emp, groups);
}

function pmPreviewClassForTab(emp: GmEvalMember, tab = tableEvalTab.value) {
  const items = itemsForEvalTab(emp, tab);
  if (!items.length) return "text-slate-300 font-medium";
  const { filledPmSlots } = scaledWeightedAvgItems(emp, items, "pm");
  if (filledPmSlots === 0) return "text-slate-300 font-medium";
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
  if (!hasKpisForEvalTab(emp, tableEvalTab.value)) return false;
  const visibleStatus = new Set([502, 503, 602, 603]);
  return flattenGmKpiItems(emp).some((item) =>
    visibleStatus.has(Number(item.hubAssignmentStatusCode)),
  );
}

function scopedSheetStatus(emp: GmEvalMember, tab = tableEvalTab.value): GmEvalMember["status"] {
  const codes = itemsForEvalTab(emp, tab)
    .map((item) => Number(item.hubAssignmentStatusCode))
    .filter((code) => Number.isFinite(code));
  if (!codes.length) return "self_scoring";
  if (codes.some((code) => code === 502 || code === 602)) return "pending_pm";
  if (codes.every((code) => code >= 601)) return "approved";
  return "self_scoring";
}

function statusBadgeClassForTab(emp: GmEvalMember, tab = tableEvalTab.value) {
  return statusBadgeClass({ ...emp, status: scopedSheetStatus(emp, tab) });
}

function statusBadgeDotClassForTab(emp: GmEvalMember, tab = tableEvalTab.value) {
  return scopedSheetStatus(emp, tab) === "approved"
    ? "bg-emerald-500"
    : "bg-blue-500";
}

function assignmentProgressLabelForTab(emp: GmEvalMember, tab = tableEvalTab.value): string {
  if (!hasKpisForEvalTab(emp, tab)) return "No KPIs";
  const labels = [
    ...new Set(
      itemsForEvalTab(emp, tab)
        .map((item) => String(item.assignmentStatusDisplay ?? "").trim())
        .filter(Boolean),
    ),
  ];
  if (!labels.length) return "—";
  if (labels.length === 1) return labels[0]!;
  return labels.sort((a, b) => a.localeCompare(b)).join(" · ");
}

function isAwaitingGmEvaluationForTab(emp: GmEvalMember, tab = tableEvalTab.value): boolean {
  return hasGmEvaluationActionForTab(emp, tab);
}

function sectionMembers(br: GmEvalPmBranch): GmEvalMember[] {
  return flattenPmBranchSheetHolders(br);
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
  return flattenPmBranchSheetHolders(br).some((emp) =>
    isAwaitingGmEvaluationForTab(emp, tableEvalTab.value),
  );
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
      expandedSectionIds[sec.sectionId] = false;
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
    if (listFilter.value === "pending" && !isAwaitingGmEvaluationForTab(emp, tableEvalTab.value))
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

const cascadePendingCount = computed(() =>
  employees.value.filter((e) => isAwaitingGmEvaluationForTab(e, "cascade")).length,
);

const promotionPendingCount = computed(() =>
  employees.value.filter((e) => isAwaitingGmEvaluationForTab(e, "promotion")).length,
);

/** Nhân viên/PM đang mở drawer đánh giá (phải còn trong danh sách sau lọc). */
const drawerEmployee = computed(() => {
  const id = drawerEmpId.value;
  if (!id) return null;
  return filteredEmployees.value.find((e) => e.id === id) ?? null;
});

watch(drawerEmpId, () => {
  drawerEvalTab.value = tableEvalTab.value;
});

const drawerCascadeGroups = computed((): GmKpiGroup[] => {
  const e = drawerEmployee.value;
  if (!e) return [];
  return sortKpiGroupItemsByNameEn(e.groups.filter((g) => !isGmEvalPromotionKpiGroup(g)));
});

const drawerPromotionGroups = computed((): GmKpiGroup[] => {
  const e = drawerEmployee.value;
  if (!e) return [];
  return sortKpiGroupItemsByNameEn(e.groups.filter((g) => isGmEvalPromotionKpiGroup(g)));
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
    "inline-flex max-w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold leading-none sm:text-[11px]";
  if (emp.status === "approved") {
    return `${base} border-emerald-200 bg-emerald-50 text-emerald-700`;
  }
  return `${base} border-blue-200 bg-blue-50 text-blue-700`;
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

/** Nút mở drawer trên bảng: luôn bật khi có KPI (GM xem lại); chỉ chặn khi busy unlock/confirm. */
function evalThaoTacDisabled(emp: GmEvalMember) {
  return !canShowEvalActionButton(emp) || confirmBusy.value || unlockBusy.value;
}

/** Ẩn nút confirm hub trong drawer khi không còn KPI chờ GM hoặc chế độ chỉ xem. */
function drawerHubShowYearEndConfirm(
  emp: GmEvalMember | null | undefined,
  tab: "cascade" | "promotion",
): boolean {
  if (!emp || isReadonly.value) return false;
  if (!isAwaitingGmEvaluationForTab(emp, tab)) return false;
  return drawerHasAssignmentsInStatusForTab(emp, 602, tab);
}

function drawerHubShowMidYearConfirm(
  emp: GmEvalMember | null | undefined,
  tab: "cascade" | "promotion",
): boolean {
  if (!emp || isReadonly.value) return false;
  if (!isAwaitingGmEvaluationForTab(emp, tab)) return false;
  return drawerHasAssignmentsInStatusForTab(emp, 502, tab);
}

function toggleEvaluationDrawer(emp: GmEvalMember, tab = tableEvalTab.value) {
  if (!canShowEvalActionButton(emp)) return;
  if (drawerEmpId.value === emp.id) {
    drawerEmpId.value = null;
    return;
  }
  initGmCommentDraft(emp, false);
  drawerEvalTab.value = tab;
  drawerEmpId.value = emp.id;
}

function closeEvaluationDrawer() {
  drawerEmpId.value = null;
}

function openUnlockConfirm(emp: GmEvalMember, tab = tableEvalTab.value) {
  if (isReadonly.value || confirmBusy.value || unlockBusy.value) return;
  if (!hasUnlockableKpisForTab(emp, tab)) return;
  unlockConfirmTarget.value = { emp, tab };
}

function unlockActionDisabled(emp: GmEvalMember, tab = tableEvalTab.value) {
  return isReadonly.value || confirmBusy.value || unlockBusy.value || !hasUnlockableKpisForTab(emp, tab);
}

function closeUnlockConfirm() {
  if (unlockBusy.value) return;
  unlockConfirmTarget.value = null;
}

async function confirmUnlockKpis() {
  const target = unlockConfirmTarget.value;
  if (!target) return;
  const cid = String(selectedCycleId.value ?? "").trim();
  const uid = String(target.emp.evaluationUserId ?? "").trim();
  if (!cid || !uid) {
    banner.value = {
      type: "info",
      text: !cid
        ? "No KPI cycle selected — cannot unlock."
        : "Missing employee id (evaluationUserId) — cannot unlock.",
    };
    setTimeout(() => {
      banner.value = null;
    }, 3200);
    return;
  }
  unlockBusy.value = true;
  try {
    if (!useMockHub) {
      const res = await gmKpiService.unlockEvaluationHub({
        cycleId: cid,
        evaluationUserId: uid,
        promotion: target.tab === "promotion",
      });
      banner.value = {
        type: "ok",
        text: `Unlocked ${res.updatedCount} KPI(s).`,
      };
    } else {
      banner.value = {
        type: "ok",
        text: `Unlocked KPI(s) for ${target.emp.name}.`,
      };
    }
    unlockConfirmTarget.value = null;
    emit("reloadEvaluationHub");
  } catch (e: unknown) {
    banner.value = {
      type: "info",
      text: e instanceof Error ? e.message : "Could not unlock KPI — please try again later.",
    };
  } finally {
    unlockBusy.value = false;
  }
}

watch([nameFilter, listFilter, tableEvalTab], () => {
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

function hubGmScoresComplete(emp: GmEvalMember): boolean {
  const items = flattenGmKpiItems(emp);
  if (!items.length) return false;
  return items.every((it) => {
    if (!hubRowGmScoreEnabled(it)) return true;
    const v = pmScores[emp.id]?.[it.id];
    return v != null && v >= 1 && v <= 5;
  });
}

function hubGmScoresCompleteForItems(emp: GmEvalMember, items: GmKpiItem[]): boolean {
  if (!items.length) return false;
  return items.every((it) => {
    if (!hubRowGmScoreEnabled(it)) return true;
    const v = pmScores[emp.id]?.[it.id];
    return v != null && v >= 1 && v <= 5;
  });
}

async function confirmDone(
  emp: GmEvalMember,
  scope: 502 | 602,
  tab: "cascade" | "promotion",
) {
  if (isReadonly.value) return;
  if (!isAwaitingGmEvaluationForTab(emp, tab)) return;
  const items = itemsForHubConfirmScopeForTab(emp, scope, tab);
  if (!items.length) {
    banner.value = {
      type: "info",
      text:
        scope === 502
          ? "No KPIs in (mid-year, awaiting GM) to complete review for this tab."
          : "No KPIs in (year-end, awaiting GM) to confirm evaluation for this tab.",
    };
    setTimeout(() => {
      banner.value = null;
    }, 3200);
    return;
  }

  const needFinal = scope === 602;
  const c =
    tab === "promotion"
      ? (supervisorPromotionComments[emp.id] ?? "").trim()
      : (supervisorPortfolioComments[emp.id] ?? "").trim();
  if (needFinal && !c) {
    supervisorCommentSubmitAttempted[supervisorAttemptKey(emp.id, tab)] = true;
    banner.value = {
      type: "info",
      text: "Please enter a Supervisor Comment before completing year-end evaluation.",
    };
    setTimeout(() => {
      banner.value = null;
    }, 3200);
    return;
  }
  if (needFinal)
    supervisorCommentSubmitAttempted[supervisorAttemptKey(emp.id, tab)] = false;

  if (needFinal && !hubGmScoresCompleteForItems(emp, items)) {
    banner.value = {
      type: "info",
      text: "Please enter GM scores (1–5) for every KPI in status 602 before completing.",
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
        text: "No KPI cycle selected — cannot confirm.",
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
        text: "Missing employee id (evaluationUserId) — cannot confirm.",
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
        supervisorComment: c,
        promotion: tab === "promotion",
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
          text:
            scope === 502
              ? "No assignments in  were updated (already processed or cycle mismatch)."
              : "No assignments in  were updated (already processed or cycle mismatch).",
        };
      } else {
        const tail = needFinal ? `Avg. ${gmScoreDetailLabel.value}: ${pmAvgInPanel(emp)}.` : "";
        banner.value = {
          type: "ok",
          text:
            res.skippedCount > 0
              ? `Updated ${res.updatedCount} KPI(s); ${res.skippedCount} skipped (wrong status/cycle). ${tail}`.trim()
              : needFinal
                ? `Confirmed year-end evaluation for ${res.updatedCount} KPI(s). ${tail}`.trim()
                : `Completed review for ${res.updatedCount} KPI(s).`.trim(),
        };
      }
    } else {
      banner.value = {
        type: "ok",
        text: needFinal
          ? `Year-end evaluation confirmed (mock) for ${emp.name}. Avg. ${gmScoreDetailLabel.value}: ${pmAvgInPanel(emp)}.`
          : `Mid-year review completed (mock) for ${emp.name}.`,
      };
    }
    drawerEmpId.value = null;
    emit("reloadEvaluationHub");
  } catch (e: unknown) {
    banner.value = {
      type: "info",
      text:
        e instanceof Error ? e.message : "Could not confirm — please try again later.",
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
      <span class="text-xs font-semibold sm:text-sm">Loading data...</span>
    </div>

    <template v-else>
      <Transition name="fade">
        <div
          v-if="banner"
          class="fixed bottom-6 right-6 z-[340] max-w-md rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg"
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
          <span class="font-bold">Read-only:</span> year
          {{ effectiveYear }} is locked. You cannot edit PM scores or supervisor
          comments.
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
              <option :value="2024">Year: 2024</option>
              <option :value="2025">Year: 2025</option>
              <option :value="2026">Year: 2026</option>
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

        <div class="flex gap-2 border-b border-slate-200 bg-white px-4 pt-3 sm:px-5">
          <button
            type="button"
            class="relative rounded-t-lg border px-4 py-2 text-xs font-bold transition-colors"
            :class="
              tableEvalTab === 'cascade'
                ? 'border-slate-200 border-b-white bg-white text-blue-700'
                : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            "
            @click="tableEvalTab = 'cascade'"
          >
            KPI Personal
            <span
              v-if="cascadePendingCount > 0"
              class="ml-2 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white"
              >{{ cascadePendingCount }}</span
            >
          </button>
          <button
            type="button"
            class="relative rounded-t-lg border px-4 py-2 text-xs font-bold transition-colors"
            :class="
              tableEvalTab === 'promotion'
                ? 'border-slate-200 border-b-white bg-white text-purple-700'
                : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            "
            @click="tableEvalTab = 'promotion'"
          >
            KPI Promotion
            <span
              v-if="promotionPendingCount > 0"
              class="ml-2 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white"
              >{{ promotionPendingCount }}</span
            >
          </button>
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
                  Progress (status)
                </th>
                <th
                  class="bg-slate-50/80 px-3 py-2.5 text-center sm:px-4 sm:py-3"
                >
                  Self score
                </th>
                <th
                  class="bg-indigo-50/40 px-3 py-2.5 text-center text-indigo-800 sm:px-4 sm:py-3"
                >
                  {{ gmScoreColumnLabel }}
                </th>
                <th
                  class="w-[4.5rem] px-2 py-2.5 text-center sm:w-20 sm:px-3 sm:py-3"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 text-xs sm:text-sm">
              <template v-for="emp in filteredEmployees" :key="emp.id">
                <tr
                  class="transition-colors group"
                  :class="[
                    isAwaitingGmEvaluationForTab(emp)
                      ? 'bg-amber-50 hover:bg-amber-100/80'
                      : 'bg-white hover:bg-slate-50/80',
                    drawerEmpId === emp.id
                      ? 'border-l-4 border-indigo-500'
                      : '',
                  ]"
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
                    <template v-if="!hasKpisForEvalTab(emp, tableEvalTab)">
                      <span
                        class="inline-block text-xs font-medium italic text-slate-500 sm:text-sm"
                        >{{ assignmentProgressLabelForTab(emp) }}</span
                      >
                    </template>
                    <span v-else :class="statusBadgeClassForTab(emp)">
                      <span
                        class="h-1.5 w-1.5 shrink-0 rounded-full"
                        :class="statusBadgeDotClassForTab(emp)"
                      />
                      <span class="truncate">
                        {{ assignmentProgressLabelForTab(emp) }}
                      </span>
                    </span>
                  </td>
                  <td
                    class="bg-slate-50/80 px-3 py-2.5 text-center sm:px-4 sm:py-3"
                  >
                    <span
                      v-if="selfPreviewTextForTab(emp)"
                      class="font-bold text-slate-700"
                      >{{ selfPreviewTextForTab(emp) }}</span
                    >
                    <span v-else class="font-medium italic text-slate-400"
                      >-</span
                    >
                  </td>
                  <td
                    class="bg-indigo-50/40 px-3 py-2.5 text-center sm:px-4 sm:py-3"
                  >
                    <span :class="pmPreviewClassForTab(emp)">{{
                      pmPreviewTextForTab(emp)
                    }}</span>
                  </td>
                  <td class="px-2 py-2.5 text-center sm:px-3" @click.stop>
                    <div class="flex items-center justify-center gap-1.5">
                      <button
                        v-if="hasUnlockButtonForTab(emp, tableEvalTab)"
                        type="button"
                        class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 bg-white text-amber-600 shadow-sm transition-colors hover:bg-amber-50 hover:text-amber-800 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:shadow-none disabled:hover:bg-slate-50"
                        :disabled="unlockActionDisabled(emp, tableEvalTab)"
                        title="Unlock KPI"
                        aria-label="Unlock KPI"
                        @click="openUnlockConfirm(emp, tableEvalTab)"
                      >
                        <i class="fas fa-unlock text-xs" aria-hidden="true" />
                      </button>
                    <button
                      type="button"
                      class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-200 bg-white text-indigo-600 shadow-sm transition-colors hover:bg-indigo-50 hover:text-indigo-800 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:shadow-none disabled:hover:bg-slate-50"
                      :disabled="evalThaoTacDisabled(emp)"
                      :title="
                        confirmBusy
                          ? 'Submitting confirmation…'
                          : 'Open KPI evaluation'
                      "
                      aria-label="Open KPI evaluation"
                      @click="toggleEvaluationDrawer(emp, tableEvalTab)"
                    >
                      <i
                        class="fas fa-clipboard-check text-xs"
                        aria-hidden="true"
                      />
                    </button>
                    </div>
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
                <th class="px-3 py-2.5 sm:px-4 sm:py-3">People</th>
                <th class="px-3 py-2.5 text-center sm:px-4 sm:py-3">Rank</th>
                <th class="px-3 py-2.5 text-center sm:px-4 sm:py-3">
                  Progress (status)
                </th>
                <th
                  class="bg-slate-50/80 px-3 py-2.5 text-center sm:px-4 sm:py-3"
                >
                  Self score
                </th>
                <th
                  class="bg-indigo-50/40 px-3 py-2.5 text-center text-indigo-800 sm:px-4 sm:py-3"
                >
                  {{ gmScoreColumnLabel }}
                </th>
                <th
                  class="w-[4.5rem] px-2 py-2.5 text-center sm:w-20 sm:px-3 sm:py-3"
                >
                  Actions
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
                  <td colspan="6" class="px-4 py-3 sm:px-5 sm:py-3.5">
                    <div class="flex min-h-8 flex-wrap items-center gap-2.5">
                      <i
                        class="fas fa-chevron-right text-xs text-slate-500 transition-transform duration-300 ease-out motion-reduce:transition-none sm:text-sm"
                        :class="
                          expandedSectionIds[sec.sectionId] ? 'rotate-90' : ''
                        "
                        aria-hidden="true"
                      />
                      <i
                        class="fas fa-sitemap text-xs text-slate-500 sm:text-sm"
                        aria-hidden="true"
                      />
                      <span
                        class="text-[11px] font-extrabold uppercase tracking-wide text-slate-700 sm:text-xs"
                      >
                        {{ sec.sectionName }}
                      </span>
                      <span
                        class="text-[11px] font-semibold normal-case text-slate-500 sm:text-xs"
                      >
                        · {{ sectionMembers(sec.branch).length }} members
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
                              class="transition-colors group"
                              :class="[
                                isAwaitingGmEvaluationForTab(emp)
                                  ? 'bg-amber-50 hover:bg-amber-100/80'
                                  : 'bg-white hover:bg-slate-50/80',
                                drawerEmpId === emp.id
                                  ? 'border-l-4 border-indigo-500'
                                  : '',
                              ]"
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
                                <template v-if="!hasKpisForEvalTab(emp, tableEvalTab)">
                                  <span
                                    class="inline-block text-xs font-medium italic text-slate-500 sm:text-sm"
                                    >{{ assignmentProgressLabelForTab(emp) }}</span
                                  >
                                </template>
                                <span v-else :class="statusBadgeClassForTab(emp)">
                                  <span
                                    class="h-1.5 w-1.5 shrink-0 rounded-full"
                                    :class="statusBadgeDotClassForTab(emp)"
                                  />
                                  <span class="truncate">
                                    {{ assignmentProgressLabelForTab(emp) }}
                                  </span>
                                </span>
                              </td>
                              <td class="bg-slate-50/80 px-3 py-2.5 text-center sm:px-4 sm:py-3">
                                <span v-if="selfPreviewTextForTab(emp)" class="font-bold text-slate-700">{{
                                  selfPreviewTextForTab(emp)
                                }}</span>
                                <span v-else class="font-medium italic text-slate-400">-</span>
                              </td>
                              <td class="bg-indigo-50/40 px-3 py-2.5 text-center sm:px-4 sm:py-3">
                                <span :class="pmPreviewClassForTab(emp)">{{ pmPreviewTextForTab(emp) }}</span>
                              </td>
                              <td class="px-2 py-2.5 text-center sm:px-3" @click.stop>
                                <div class="flex items-center justify-center gap-1.5">
                                <button
                                  v-if="hasUnlockButtonForTab(emp, tableEvalTab)"
                                  type="button"
                                  class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 bg-white text-amber-600 shadow-sm transition-colors hover:bg-amber-50 hover:text-amber-800 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:shadow-none disabled:hover:bg-slate-50"
                                  :disabled="unlockActionDisabled(emp, tableEvalTab)"
                                  title="Unlock KPI"
                                  aria-label="Unlock KPI"
                                  @click="openUnlockConfirm(emp, tableEvalTab)"
                                >
                                  <i class="fas fa-unlock text-xs" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-200 bg-white text-indigo-600 shadow-sm transition-colors hover:bg-indigo-50 hover:text-indigo-800 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:shadow-none disabled:hover:bg-slate-50"
                                  :disabled="evalThaoTacDisabled(emp)"
                                  :title="
                                    confirmBusy
                                      ? 'Submitting confirmation…'
                                      : 'Open KPI evaluation'
                                  "
                                  aria-label="Open KPI evaluation"
                                  @click="toggleEvaluationDrawer(emp, tableEvalTab)"
                                >
                                  <i class="fas fa-clipboard-check text-xs" aria-hidden="true" />
                                </button>
                                </div>
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
                                      aria-label="Expand PM group"
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
                                      confirmBusy
                                        ? 'Submitting confirmation…'
                                        : 'Open KPI evaluation'
                                    "
                                    aria-label="Open KPI evaluation"
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
                                                      aria-label="Expand leader group"
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
                                                      confirmBusy
                                                        ? 'Submitting confirmation…'
                                                        : 'Open KPI evaluation'
                                                    "
                                                    aria-label="Open KPI evaluation"
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
                                                                    confirmBusy
                                                                      ? 'Submitting confirmation…'
                                                                      : 'Open KPI evaluation'
                                                                  "
                                                                  aria-label="Open KPI evaluation"
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
                                                    confirmBusy
                                                      ? 'Submitting confirmation…'
                                                      : 'Open KPI evaluation'
                                                  "
                                                  aria-label="Open KPI evaluation"
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
        <Transition name="fade">
          <div
            v-if="unlockConfirmTarget"
            class="fixed inset-0 z-[300] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="closeUnlockConfirm" />
            <div class="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
              <h3 class="text-lg font-bold text-slate-900">Xác nhận mở khóa KPI</h3>
              <p class="mt-3 text-sm text-slate-700">
                Bạn có chắc chắn muốn mở khóa toàn bộ KPI của
                <span class="font-bold">{{ unlockConfirmTarget.emp.name }}</span>
                này không?
              </p>
              <div class="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  :disabled="unlockBusy"
                  class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  @click="closeUnlockConfirm"
                >
                  Không
                </button>
                <button
                  type="button"
                  :disabled="unlockBusy"
                  class="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                  @click="confirmUnlockKpis"
                >
                  <i v-if="unlockBusy" class="fas fa-spinner fa-spin text-xs" aria-hidden="true" />
                  <i v-else class="fas fa-lock-open text-xs" aria-hidden="true" />
                  Có
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

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
                    KPI evaluation
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
                  aria-label="Close"
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
                        Detailed evaluation sheet — {{ effectiveYear }}
                      </h3>
                      <p
                        class="mt-0.5 text-[11px] font-medium text-slate-500 sm:text-xs"
                      >
                        {{ flattenGmKpiItems(drawerEmployee).length }} line items
                        in total
                        <span class="text-slate-400">·</span>
                        Viewing:
                        {{
                          drawerEvalTab === "cascade"
                            ? `${drawerCascadeItemCount} KPIs by BSC perspective (Individual / Cascading)`
                            : `${drawerPromotionItemCount} KPI Promotion`
                        }}
                      </p>
                    </div>

                    <div class="border-b border-slate-200 bg-white">
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
                                Objective
                              </th>
                              <th
                                class="w-28 min-w-[7rem] px-4 py-3 text-center sm:w-32"
                              >
                                Weight
                              </th>
                              <th
                                class="w-44 min-w-[11rem] px-4 py-3 text-center sm:w-52 sm:min-w-[13rem]"
                              >
                                Evidence
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
                                    drawerRequiresGmFinalGradingForTab(
                                      drawerEmployee,
                                      drawerEvalTab,
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
                                No KPIs in this tab.
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
                                v-for="(item, itemIdx) in group.items"
                                :key="item.id"
                              >
                                <tr
                                  class="transition-colors hover:bg-slate-50/50"
                                >
                                  <td
                                    class="px-4 py-4 text-center font-bold text-slate-400"
                                  >
                                    {{ itemIdx + 1 }}
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
                                      <template v-if="usesPmStyleEvidence(item)">
                                        <p
                                          class="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500"
                                        >
                                          Evidences
                                        </p>
                                        <div
                                          class="overflow-x-auto rounded-lg border border-indigo-100 bg-white shadow-sm"
                                        >
                                          <table class="w-full text-left text-xs">
                                            <thead
                                              class="bg-indigo-50 text-[10px] font-bold uppercase tracking-wider text-indigo-800"
                                            >
                                              <tr>
                                                <th
                                                  class="px-3 py-2.5 text-center"
                                                  :class="
                                                    !isRecordStyleCalcRule(item.calcRuleCode)
                                                      ? 'w-3/5'
                                                      : 'w-2/3'
                                                  "
                                                >
                                                  Content
                                                </th>
                                                <th
                                                  v-if="!isRecordStyleCalcRule(item.calcRuleCode)"
                                                  class="w-1/5 border-l border-indigo-100/60 px-3 py-2.5 text-center"
                                                >
                                                  Plan
                                                </th>
                                                <th
                                                  class="border-l border-indigo-100/60 px-3 py-2.5 text-center"
                                                  :class="
                                                    !isRecordStyleCalcRule(item.calcRuleCode)
                                                      ? 'w-1/5'
                                                      : 'w-1/3'
                                                  "
                                                >
                                                  Actual
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody class="divide-y divide-slate-100">
                                              <tr
                                                v-for="(ev, eIdx) in item.evidenceData"
                                                :key="eIdx"
                                                class="transition-colors hover:bg-slate-50"
                                              >
                                                <td
                                                  class="px-3 py-2.5 font-medium leading-snug text-slate-800"
                                                >
                                                  {{ gmEvidenceText(ev.content || ev.comment) }}
                                                </td>
                                                <td
                                                  v-if="!isRecordStyleCalcRule(item.calcRuleCode)"
                                                  class="border-l border-slate-100 px-3 py-2.5 text-center text-slate-600"
                                                >
                                                  {{ gmEvidenceText(ev.plan) }}
                                                </td>
                                                <td
                                                  class="border-l border-slate-100 px-3 py-2.5 text-center font-bold text-emerald-600"
                                                >
                                                  {{ gmEvidenceText(ev.actual) }}
                                                </td>
                                              </tr>
                                              <tr
                                                v-if="
                                                  (!item.evidenceData ||
                                                    item.evidenceData.length === 0) &&
                                                  !item.evidenceContent
                                                "
                                              >
                                                <td
                                                  :colspan="gmEvidenceColspan(item)"
                                                  class="px-3 py-3 text-center font-medium italic text-slate-400"
                                                >
                                                  No tabular evidence details yet.  
                                                </td>
                                              </tr>
                                              <tr v-if="item.evidenceContent">
                                                <td
                                                  :colspan="gmEvidenceColspan(item)"
                                                  class="border-t border-yellow-100 bg-yellow-50/30 px-4 py-3 text-slate-700 whitespace-pre-wrap"
                                                >
                                                  <p
                                                    class="mb-1 text-[10px] font-bold uppercase text-yellow-700/70"
                                                  >
                                                    Notes (Comment for Supervisor): 
                                                  </p>
                                                  {{ item.evidenceContent }}
                                                </td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                        <div
                                          v-if="
                                            item.evidenceAttachments &&
                                            item.evidenceAttachments.length > 0
                                          "
                                          class="mt-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                                        >
                                          <p
                                            class="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500"
                                          >
                                            Attached evidence (URL / file)
                                          </p>
                                          <ul class="flex flex-col gap-3">
                                            <li
                                              v-for="(att, aIdx) in item.evidenceAttachments"
                                              :key="aIdx"
                                              class="rounded-md border border-slate-100 bg-slate-50/80 p-2"
                                            >
                                              <a
                                                :href="normalizeEvidenceHref(att.url)"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="break-all text-xs font-semibold text-indigo-600 underline hover:text-indigo-800"
                                              >
                                                {{ att.name || att.url }}
                                              </a>
                                              <div
                                                v-if="isEvidenceImageUrl(att.url)"
                                                class="mt-2"
                                              >
                                                <img
                                                  :src="normalizeEvidenceHref(att.url)"
                                                  :alt="att.name || 'Evidence'"
                                                  class="max-h-40 max-w-full rounded border border-slate-200 object-contain"
                                                />
                                              </div>
                                            </li>
                                          </ul>
                                        </div>
                                      </template>
                                      <template v-else>
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
                                              "View attached evidence"
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
                                          No evidence data yet.
                                        </p>
                                      </template>
                                      <div
                                        class="mt-4 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3"
                                        :class="{
                                          'opacity-80': !hubRowGmCommentEnabled(item),
                                        }"
                                      >
                                        <label
                                          class="mb-2 block text-[11px] font-bold uppercase tracking-wider text-indigo-700"
                                        >
                                          GM comment (per KPI)
                                        </label>
                                        <textarea
                                          v-model="gmKpiComments[drawerEmployee.id][item.id]"
                                          class="w-full resize-y rounded-lg border border-indigo-200 bg-white p-2.5 text-sm text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500"
                                          rows="3"
                                          :disabled="
                                            isReadonly ||
                                            confirmBusy ||
                                            !hubRowGmCommentEnabled(item)
                                          "
                                          placeholder="Enter GM feedback for this KPI..."
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
                                Total weight:
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
                                Self-score average
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
                                Average ({{ gmScoreDetailLabel }})
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

                    <div
                      v-if="drawerEvalTab === 'cascade'"
                      class="border-t border-slate-200 bg-white p-6"
                    >
                      <h4
                        class="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800"
                      >
                        <i class="fas fa-comment-dots text-indigo-600" />
                        Evaluation summary &amp; confirmation — BSC (Individual / Cascading)
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
                            {{
                              drawerEmployee.employeeCommentPortfolio ??
                              drawerEmployee.employeeComment ??
                              "—"
                            }}
                          </div>
                        </div>
                        <div class="space-y-2">
                          <label
                            class="block text-[11px] font-bold uppercase tracking-wider text-indigo-600"
                          >
                            Supervisor Comment
                            <span
                              v-if="
                                drawerHasAssignmentsInStatusForTab(
                                  drawerEmployee,
                                  602,
                                  'cascade',
                                )
                              "
                              class="text-rose-500"
                              >*</span
                            >
                          </label>
                          <textarea
                            v-model="supervisorPortfolioComments[drawerEmployee.id]"
                            class="h-24 w-full resize-none rounded-lg border-2 bg-white p-3 text-sm text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500"
                            :class="
                              supervisorCommentInvalid(drawerEmployee, 'cascade')
                                ? 'border-rose-400 focus:ring-rose-100'
                                : 'border-indigo-200'
                            "
                            :disabled="
                              isReadonly ||
                              !supervisorCommentEditable(
                                drawerEmployee,
                                'cascade',
                              )
                            "
                            :placeholder="supervisorCommentPlaceholder(drawerEmployee, 'cascade')"
                          />
                          <p
                            v-if="supervisorCommentInvalid(drawerEmployee, 'cascade')"
                            class="text-[11px] font-semibold text-rose-600"
                          >
                            Please enter a Supervisor Comment before confirming year-end evaluation.
                          </p>
                        </div>
                      </div>
                      <div
                        v-if="
                          drawerHubShowYearEndConfirm(
                            drawerEmployee,
                            'cascade',
                          ) ||
                          drawerHubShowMidYearConfirm(
                            drawerEmployee,
                            'cascade',
                          )
                        "
                        class="mt-5 border-t border-slate-100 pt-3 sm:mt-6 sm:pt-4"
                      >
                        <div
                          class="flex flex-wrap justify-end gap-2 sm:gap-2.5"
                        >
                          <button
                            v-if="
                              drawerHubShowYearEndConfirm(
                                drawerEmployee,
                                'cascade',
                              )
                            "
                            type="button"
                            class="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 sm:gap-2 sm:px-4 sm:text-sm disabled:cursor-not-allowed disabled:opacity-50"
                            :disabled="confirmBusy"
                            @click="confirmDone(drawerEmployee, 602, 'cascade')"
                          >
                            <i
                              class="fas fa-check-circle text-[11px] sm:text-xs"
                              aria-hidden="true"
                            />
                            Confirm year-end evaluation
                          </button>
                          <button
                            v-if="
                              drawerHubShowMidYearConfirm(
                                drawerEmployee,
                                'cascade',
                              )
                            "
                            type="button"
                            class="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-800 shadow-sm transition-colors hover:bg-indigo-100 sm:gap-2 sm:px-4 sm:text-sm disabled:cursor-not-allowed disabled:opacity-50"
                            :disabled="confirmBusy"
                            @click="confirmDone(drawerEmployee, 502, 'cascade')"
                          >
                            <i
                              class="fas fa-flag-checkered text-[11px] sm:text-xs"
                              aria-hidden="true"
                            />
                            Complete review
                          </button>
                        </div>
                      </div>
                    </div>

                    <div
                      v-else
                      class="border-t border-slate-200 bg-white p-6"
                    >
                      <h4
                        class="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800"
                      >
                        <i class="fas fa-comment-dots text-indigo-600" />
                        Evaluation summary &amp; confirmation — Promotion
                      </h4>
                      <div
                        class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8"
                      >
                        <div class="pointer-events-none space-y-2 opacity-80">
                          <label
                            class="block text-[11px] font-bold uppercase tracking-wider text-slate-500"
                          >
                            Employee's Comment — Promotion (Read-only)
                          </label>
                          <div
                            class="h-24 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600"
                          >
                            {{ drawerEmployee.employeeCommentPromotion ?? "—" }}
                          </div>
                        </div>
                        <div class="space-y-2">
                          <label
                            class="block text-[11px] font-bold uppercase tracking-wider text-indigo-600"
                          >
                            Supervisor Comment (promotion)
                            <span
                              v-if="
                                drawerHasAssignmentsInStatusForTab(
                                  drawerEmployee,
                                  602,
                                  'promotion',
                                )
                              "
                              class="text-rose-500"
                              >*</span
                            >
                          </label>
                          <textarea
                            v-model="supervisorPromotionComments[drawerEmployee.id]"
                            class="h-24 w-full resize-none rounded-lg border-2 bg-white p-3 text-sm text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500"
                            :class="
                              supervisorCommentInvalid(drawerEmployee, 'promotion')
                                ? 'border-rose-400 focus:ring-rose-100'
                                : 'border-indigo-200'
                            "
                            :disabled="
                              isReadonly ||
                              !supervisorCommentEditable(
                                drawerEmployee,
                                'promotion',
                              )
                            "
                            :placeholder="supervisorCommentPlaceholder(drawerEmployee, 'promotion')"
                          />
                          <p
                            v-if="supervisorCommentInvalid(drawerEmployee, 'promotion')"
                            class="text-[11px] font-semibold text-rose-600"
                          >
                            Please enter a Supervisor Comment before confirming year-end evaluation.
                          </p>
                        </div>
                      </div>
                      <div
                        v-if="
                          drawerHubShowYearEndConfirm(
                            drawerEmployee,
                            'promotion',
                          ) ||
                          drawerHubShowMidYearConfirm(
                            drawerEmployee,
                            'promotion',
                          )
                        "
                        class="mt-5 border-t border-slate-100 pt-3 sm:mt-6 sm:pt-4"
                      >
                        <div
                          class="flex flex-wrap justify-end gap-2 sm:gap-2.5"
                        >
                          <button
                            v-if="
                              drawerHubShowYearEndConfirm(
                                drawerEmployee,
                                'promotion',
                              )
                            "
                            type="button"
                            class="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 sm:gap-2 sm:px-4 sm:text-sm disabled:cursor-not-allowed disabled:opacity-50"
                            :disabled="confirmBusy"
                            @click="confirmDone(drawerEmployee, 602, 'promotion')"
                          >
                            <i
                              class="fas fa-check-circle text-[11px] sm:text-xs"
                              aria-hidden="true"
                            />
                            Confirm year-end evaluation
                          </button>
                          <button
                            v-if="
                              drawerHubShowMidYearConfirm(
                                drawerEmployee,
                                'promotion',
                              )
                            "
                            type="button"
                            class="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-800 shadow-sm transition-colors hover:bg-indigo-100 sm:gap-2 sm:px-4 sm:text-sm disabled:cursor-not-allowed disabled:opacity-50"
                            :disabled="confirmBusy"
                            @click="confirmDone(drawerEmployee, 502, 'promotion')"
                          >
                            <i
                              class="fas fa-flag-checkered text-[11px] sm:text-xs"
                              aria-hidden="true"
                            />
                            Complete review
                          </button>
                        </div>
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
