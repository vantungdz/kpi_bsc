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
import {
  formatGmDrawerValueWithUnit,
  gmDrawerUnitContextFromItem,
} from "@/utils/mapGmEvaluationHubApiToPmBranches";
import type {
  GmEvalMember,
  GmEvalPmBranch,
  GmKpiGroup,
  GmKpiItem,
} from "@/types/gm-employee-evaluation";
import { isReadonlyKpiYear } from "@/utils/kpi-year";
import { getApiErrorMessage } from "@/utils/apiErrorMessage";
import { gmKpiService } from "@/services/modules/kpi-gm.service";
import { useToast } from "vue-toastification";
import {
  activateEvidenceAttachment,
  evidenceAttachmentLabel,
  evidenceAttachmentTitle,
  isEvidenceImageUrl,
  isRecordStyleCalcRule,
  normalizeEvidenceHref,
} from "@/utils/memberKpiHelpers";
import {
  gmAsmStatusPillClass,
  minGmAsmStatusCode,
} from "@/utils/gmAsmStatusUi";
import { pmAsmStatusPillClass } from "@/utils/pmAsmStatusUi";
import { kpiCreatorRowBgClass } from "@/utils/kpiCreatorRowBg";
import KpiCreatorRowLegend from "@/components/shared/KpiCreatorRowLegend.vue";
import {
  canSupervisorViewMemberSelfEvaluation,
  supervisorMemberActualDisplayInDrawer,
  supervisorMemberSelfScoreDisplayInDrawer,
} from "@/utils/memberEvaluationVisibility";
import {
  EVALUATION_REJECTABLE_STATUSES,
  KPI_STATUS,
} from "@/config/constants";
import { gmEvaluationTableEvalTabKey } from "@/utils/gmLayoutEvaluationTab";

/** Trạng thái assignment GM có thể xác nhận trong Evaluation Hub (bỏ qua bước PM khi 501/601). */
type GmHubConfirmScope = 501 | 502 | 601 | 602;

const GM_HUB_MID_YEAR_SCOPES: GmHubConfirmScope[] = [501, 502];
const GM_HUB_YEAR_END_SCOPES: GmHubConfirmScope[] = [601, 602];

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
const toast = useToast();
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

const gmEvaluationTableEvalTab = inject(gmEvaluationTableEvalTabKey, null);
watch(
  tableEvalTab,
  (tab) => {
    if (gmEvaluationTableEvalTab) {
      gmEvaluationTableEvalTab.value = tab;
    }
  },
  { immediate: true },
);
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
const confirmBusy = ref(false);
const rejectEvaluationBusy = ref(false);
const evaluationRejectDialog = ref<{
  open: boolean;
  item: GmKpiItem | null;
  rejectAll: boolean;
}>({ open: false, item: null, rejectAll: false });
const evaluationRejectReason = ref("");
const evaluationRejectError = ref("");
const unlockBusy = ref(false);
const unlockConfirmTarget = ref<{ emp: GmEvalMember; tab: "cascade" | "promotion" } | null>(null);
const pageLoading = ref(true);

const isReadonly = computed(() => isReadonlyKpiYear(effectiveYear.value));

function onEvidenceAttachmentClick(att: { url: string; name?: string }) {
  void activateEvidenceAttachment(att)
}

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
  if (flattenGmKpiItems(emp).length > 0) return true;
  return (
    memberHubEvalStatusCodesForTab(emp, "cascade").length > 0 ||
    memberHubEvalStatusCodesForTab(emp, "promotion").length > 0
  );
}

function groupsForEvalTab(emp: GmEvalMember, tab: "cascade" | "promotion") {
  return tab === "promotion"
    ? emp.groups.filter((g) => isGmEvalPromotionKpiGroup(g))
    : emp.groups.filter((g) => !isGmEvalPromotionKpiGroup(g));
}

function itemsForEvalTab(emp: GmEvalMember, tab: "cascade" | "promotion") {
  return groupsForEvalTab(emp, tab).flatMap((g) => g.items);
}

/** ASM assignment trên hub theo tab — gồm 504/604 sau reject đánh giá. */
const HUB_TAB_KPI_ASM = new Set<number>([
  KPI_STATUS.ACCEPTED,
  KPI_STATUS.FIRST_WAITING_PM_APPROVAL,
  KPI_STATUS.FIRST_WAITING_GM_APPROVAL,
  KPI_STATUS.FIRST_COMPLETED,
  KPI_STATUS.FIRST_REJECTED,
  KPI_STATUS.SECOND_WAITING_PM_APPROVAL,
  KPI_STATUS.SECOND_WAITING_GM_APPROVAL,
  KPI_STATUS.COMPLETED,
  KPI_STATUS.SECOND_REJECTED,
]);

function memberHubEvalStatusCodesForTab(
  emp: GmEvalMember,
  tab: "cascade" | "promotion",
): number[] {
  const raw =
    tab === "promotion"
      ? emp.hubEvalStatusCodesPromotion
      : emp.hubEvalStatusCodesPortfolio;
  return (raw ?? []).filter((c) => HUB_TAB_KPI_ASM.has(c));
}

function hubEvalAsmFallbackLabel(code: number): string {
  switch (code) {
    case KPI_STATUS.FIRST_REJECTED:
      return "Rejected (Mid-Year)";
    case KPI_STATUS.SECOND_REJECTED:
      return "Rejected (Final)";
    case KPI_STATUS.FIRST_WAITING_PM_APPROVAL:
      return "Pending PM Evaluation (Mid-Year)";
    case KPI_STATUS.FIRST_WAITING_GM_APPROVAL:
      return "Pending GM Evaluation (Mid-Year)";
    case KPI_STATUS.FIRST_COMPLETED:
      return "Completed (Mid-Year)";
    case KPI_STATUS.SECOND_WAITING_PM_APPROVAL:
      return "Pending PM Evaluation (Final)";
    case KPI_STATUS.SECOND_WAITING_GM_APPROVAL:
      return "Pending GM Evaluation (Final)";
    case KPI_STATUS.COMPLETED:
      return "Completed";
    case KPI_STATUS.ACCEPTED:
      return "In progress";
    default:
      return "";
  }
}

function hasKpisForEvalTab(emp: GmEvalMember, tab: "cascade" | "promotion") {
  if (itemsForEvalTab(emp, tab).length > 0) return true;
  return memberHubEvalStatusCodesForTab(emp, tab).length > 0;
}

function hasGmEvaluationActionForTab(emp: GmEvalMember, tab: "cascade" | "promotion") {
  return itemsForEvalTab(emp, tab).some((item) => {
    const code = Number(item.hubAssignmentStatusCode);
    return code === 501 || code === 502 || code === 601 || code === 602;
  });
}

const GM_UNLOCK_DISABLED_STATUS_CODES = new Set([
  401, 402, 403, 404, 407, 503, 603, 504, 604,
]);

function hasUnlockButtonForTab(emp: GmEvalMember, tab: "cascade" | "promotion") {
  return hasKpisForEvalTab(emp, tab);
}

function hasUnlockableKpisForTab(emp: GmEvalMember, tab: "cascade" | "promotion") {
  return itemsForEvalTab(emp, tab).some((item) => {
    const code = Number(item.hubAssignmentStatusCode);
    return Number.isFinite(code) && !GM_UNLOCK_DISABLED_STATUS_CODES.has(code);
  });
}

/** ASM 601/602: GM chấm điểm + bắt buộc comment; 501/502 chỉ review giữa năm. */
function hubRowGmScoreEnabled(item: GmKpiItem): boolean {
  const code = Number(item.hubAssignmentStatusCode);
  return code === 601 || code === 602;
}

/** Hiển thị điểm GM ở bảng tổng hợp cho dòng đang chấm (601/602) và đã chốt (603). */
function hubRowGmScoreDisplayEnabled(item: GmKpiItem): boolean {
  const code = Number(item.hubAssignmentStatusCode)
  return code === 601 || code === 602 || code === 603
}

/** GM có thể ghi comment theo từng KPI khi chờ PM hoặc GM. */
function hubRowGmCommentEnabled(item: GmKpiItem): boolean {
  const code = Number(item.hubAssignmentStatusCode);
  return code === 501 || code === 502 || code === 601 || code === 602;
}

function drawerHasAssignmentsInStatus(emp: GmEvalMember, code: GmHubConfirmScope): boolean {
  return flattenGmKpiItems(emp).some((it) => Number(it.hubAssignmentStatusCode) === code)
}

/** Chỉ các dòng assignment đang chờ GM/PM theo từng phase (gửi confirm hub). */
function itemsForHubConfirmScopeForTab(
  emp: GmEvalMember,
  scope: GmHubConfirmScope,
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
  code: GmHubConfirmScope,
  tab: "cascade" | "promotion",
): boolean {
  return itemsForHubConfirmScopeForTab(emp, code, tab).length > 0;
}

function activeHubConfirmScopesForTab(
  emp: GmEvalMember,
  scopes: GmHubConfirmScope[],
  tab: "cascade" | "promotion",
): GmHubConfirmScope[] {
  return scopes.filter((s) => drawerHasAssignmentsInStatusForTab(emp, s, tab));
}

/** Mở Supervisor Comment khi GM còn KPI chờ xử lý (501/502 giữa năm hoặc 601/602 cuối năm). */
function supervisorCommentEditable(
  emp: GmEvalMember,
  tab: "cascade" | "promotion",
): boolean {
  return isAwaitingGmEvaluationForTab(emp, tab);
}

function supervisorCommentPlaceholder(
  emp: GmEvalMember,
  tab: "cascade" | "promotion",
): string {
  if (GM_HUB_YEAR_END_SCOPES.some((s) => drawerHasAssignmentsInStatusForTab(emp, s, tab))) {
    return "Enter an overall supervisor comment explaining the scores you assigned...";
  }
  if (GM_HUB_MID_YEAR_SCOPES.some((s) => drawerHasAssignmentsInStatusForTab(emp, s, tab))) {
    return "Optional during mid-year review. You can keep the PM comment or edit it before completing review.";
  }
  return "";
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

function drawerItemCode(item: GmKpiItem): string {
  return String(item.code ?? "").trim();
}

function drawerItemName(item: GmKpiItem): string {
  return String(item.name ?? item.title ?? "").trim();
}

function drawerStatusLabel(item: GmKpiItem): string {
  const direct = String(item.statusDesc ?? item.assignmentStatusDisplay ?? "").trim();
  return direct || "-";
}

function isEvaluationRejectedHubItem(item: GmKpiItem): boolean {
  const code = Number(item.hubAssignmentStatusCode ?? item.statusCode);
  return (
    code === KPI_STATUS.FIRST_REJECTED || code === KPI_STATUS.SECOND_REJECTED
  );
}

function drawerEvaluationRejectTooltip(item: GmKpiItem): string | undefined {
  if (!isEvaluationRejectedHubItem(item)) return undefined;
  const reason = String(item.evaluationRejectReason ?? "").trim();
  if (!reason) return undefined;
  return reason;
}

function hasDrawerEvaluationRejectReason(item: GmKpiItem): boolean {
  return drawerEvaluationRejectTooltip(item) != null;
}

function drawerStatusClass(item: GmKpiItem): string {
  const code = item.statusCode ?? item.hubAssignmentStatusCode;
  if (code == null || !Number.isFinite(Number(code))) {
    return "border-slate-200 bg-slate-50 text-slate-600";
  }
  return pmAsmStatusPillClass(Number(code));
}

function hasDrawerEvidence(item: GmKpiItem): boolean {
  return Boolean(
    (Array.isArray(item.evidenceData) && item.evidenceData.length > 0) ||
      String(item.evidenceContent ?? "").trim() ||
      (Array.isArray(item.evidenceAttachments) &&
        item.evidenceAttachments.length > 0),
  );
}

function drawerValueWithUnit(item: GmKpiItem, value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return "-";
  return formatGmDrawerValueWithUnit(text, gmDrawerUnitContextFromItem(item));
}

/** Bóc hậu tố đơn vị để format lại khi dữ liệu cũ chỉ lưu số. */
function stripDrawerUnitSuffix(display: string): string {
  return String(display ?? "")
    .trim()
    .replace(/\s*%$/, "")
    .replace(/\s+(MM|Point|Product|Project|Certification|Article|Person)$/i, "")
    .trim();
}

/** Cột TARGET — ghép đơn vị giống PM drawer. */
function drawerTargetDisplay(item: GmKpiItem): string {
  const raw =
    item.targetRaw != null && String(item.targetRaw).trim() !== ""
      ? item.targetRaw
      : stripDrawerUnitSuffix(String(item.target ?? ""));
  return drawerValueWithUnit(item, raw);
}

/** Cột ACTUAL — ghép đơn vị giống PM drawer. */
function drawerActualDisplay(item: GmKpiItem): string {
  const raw = item.actualRaw ?? item.actualResult;
  if (raw == null) return "-";
  const text = supervisorMemberActualDisplayInDrawer(raw);
  if (!text || text === "-") return "-";
  if (item.unitCode === 902 && /%$/.test(text)) return text;
  return drawerValueWithUnit(item, text);
}

function drawerSelfScoreDisplay(item: GmKpiItem): string {
  return String(supervisorMemberSelfScoreDisplayInDrawer(item.selfScore));
}

function drawerGroupRowClass(group: GmKpiGroup): string {
  return isGmEvalPromotionKpiGroup(group)
    ? "bg-violet-50/70 border-y border-violet-100"
    : "bg-slate-50 border-y border-slate-200";
}

function drawerGroupLabelClass(group: GmKpiGroup): string {
  return isGmEvalPromotionKpiGroup(group)
    ? "text-violet-800"
    : "text-slate-800";
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
    const fromEvidence = String(item.gmComment ?? "").trim();
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
      pmScores[emp.id][item.id] = item.selfScore ?? null;
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
function drawerNeedsYearEndSupervisorComment(
  emp: GmEvalMember,
  tab: "cascade" | "promotion",
): boolean {
  return GM_HUB_YEAR_END_SCOPES.some((s) =>
    drawerHasAssignmentsInStatusForTab(emp, s, tab),
  );
}

function supervisorCommentInvalid(
  emp: GmEvalMember,
  tab: "cascade" | "promotion",
): boolean {
  if (!drawerNeedsYearEndSupervisorComment(emp, tab)) return false;
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
  options?: { inEvaluationDrawer?: boolean },
): { value: number; filledPmSlots: number; totalPmSlots: number } {
  const iterItems =
    mode === "pm"
      ? items.filter((i) => hubRowGmScoreDisplayEnabled(i))
      : items.filter((i) =>
          options?.inEvaluationDrawer
            ? true
            : canSupervisorViewMemberSelfEvaluation(
                i.hubAssignmentStatusCode ?? i.statusCode,
                "gm",
              ),
        );
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
  return formatAvg(
    scaledWeightedAvgItems(emp, items, "self", { inEvaluationDrawer: true }).value,
  );
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
  const visibleStatus = new Set([501, 502, 503, 601, 602, 603]);
  return flattenGmKpiItems(emp).some((item) =>
    visibleStatus.has(Number(item.hubAssignmentStatusCode)),
  );
}

const EVAL_STATUS_PILL_BASE =
  "inline-flex max-w-full items-center justify-center rounded-md border px-2 py-1 text-[10px] font-bold leading-none sm:text-[11px]";

function hubAsmStatusCodeForTab(
  emp: GmEvalMember,
  tab: "cascade" | "promotion" = tableEvalTab.value,
): number | null {
  const fromItems = itemsForEvalTab(emp, tab).map(
    (item) => item.hubAssignmentStatusCode,
  );
  if (fromItems.length > 0) return minGmAsmStatusCode(fromItems);
  return minGmAsmStatusCode(memberHubEvalStatusCodesForTab(emp, tab));
}

function statusBadgeClassForTab(
  emp: GmEvalMember,
  tab: "cascade" | "promotion" = tableEvalTab.value,
): string {
  const code = hubAsmStatusCodeForTab(emp, tab);
  const colors =
    code != null
      ? gmAsmStatusPillClass(code)
      : "border-slate-200 bg-slate-50 text-slate-500";
  return `${EVAL_STATUS_PILL_BASE} ${colors}`;
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
  if (labels.length === 1) return labels[0]!;
  if (labels.length > 1) {
    return labels.sort((a, b) => a.localeCompare(b)).join(" · ");
  }
  const summary = String(emp.assignmentStatusDisplay ?? "").trim();
  if (summary) return summary;
  const code = hubAsmStatusCodeForTab(emp, tab);
  if (code != null) {
    const fallback = hubEvalAsmFallbackLabel(code);
    if (fallback) return fallback;
  }
  return "—";
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

/** Số PM/leader/member trong section còn KPI chờ GM trên tab đang xem. */
function sectionPendingCountForTab(
  br: GmEvalPmBranch,
  tab: "cascade" | "promotion" = tableEvalTab.value,
): number {
  return flattenPmBranchSheetHolders(br).filter((emp) =>
    isAwaitingGmEvaluationForTab(emp, tab),
  ).length;
}

function sectionHasPendingEvaluation(
  br: GmEvalPmBranch,
  tab: "cascade" | "promotion" = tableEvalTab.value,
): boolean {
  return sectionPendingCountForTab(br, tab) > 0;
}

/** Nền header department (collapse) khi còn member chờ GM đánh giá. */
function sectionHeaderRowClass(br: GmEvalPmBranch): string {
  const base = "cursor-pointer border-y transition-colors";
  if (sectionHasPendingEvaluation(br)) {
    return `${base} border-amber-200/90 bg-amber-50 hover:bg-amber-100/90`;
  }
  return `${base} border-slate-200 bg-slate-100/95 hover:bg-slate-100`;
}

function sectionPendingTitle(br: GmEvalPmBranch): string | undefined {
  const n = sectionPendingCountForTab(br);
  if (n <= 0) return undefined;
  return tableEvalTab.value === "promotion"
    ? `${n} member(s) in this department awaiting Promotion evaluation`
    : `${n} member(s) in this department awaiting Individual/Team evaluation`;
}

/** Mọi người có sheet KPI trên hub (PM + leader + member hoặc danh sách phẳng). */
const allEvaluationSheetHolders = computed((): GmEvalMember[] => {
  if (usePmTree.value && props.pmBranches?.length) {
    return props.pmBranches.flatMap((br) => flattenPmBranchSheetHolders(br));
  }
  return employees.value;
});

/** Badge tab KPI Personal / KPI Promotion — số người còn KPI chờ GM (501/502/601/602). */
const evalTabPendingCounts = computed(() => {
  const holders = allEvaluationSheetHolders.value;
  return {
    cascade: holders.filter((e) => isAwaitingGmEvaluationForTab(e, "cascade"))
      .length,
    promotion: holders.filter((e) => isAwaitingGmEvaluationForTab(e, "promotion"))
      .length,
  };
});

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
  return sortKpiGroupItemsByNameEn(
    e.groups.filter((g) => !isGmEvalPromotionKpiGroup(g) && g.items.length > 0),
  );
});

const drawerPromotionGroups = computed((): GmKpiGroup[] => {
  const e = drawerEmployee.value;
  if (!e) return [];
  return sortKpiGroupItemsByNameEn(
    e.groups.filter((g) => isGmEvalPromotionKpiGroup(g) && g.items.length > 0),
  );
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

function statusBadgeClass(emp: GmEvalMember): string {
  return statusBadgeClassForTab(emp, tableEvalTab.value);
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
  return activeHubConfirmScopesForTab(emp, GM_HUB_YEAR_END_SCOPES, tab).length > 0;
}

function drawerHubShowMidYearConfirm(
  emp: GmEvalMember | null | undefined,
  tab: "cascade" | "promotion",
): boolean {
  if (!emp || isReadonly.value) return false;
  if (!isAwaitingGmEvaluationForTab(emp, tab)) return false;
  return activeHubConfirmScopesForTab(emp, GM_HUB_MID_YEAR_SCOPES, tab).length > 0;
}

function toggleEvaluationDrawer(emp: GmEvalMember, tab = tableEvalTab.value) {
  if (!canShowEvalActionButton(emp)) return;
  if (drawerEmpId.value === emp.id) {
    drawerEmpId.value = null;
    return;
  }
  initGmCommentDraft(emp, false);
  initSupervisorCommentDraft(emp, false);
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
    toast.warning(
      !cid
        ? "No KPI cycle selected — cannot unlock."
        : "Missing employee id (evaluationUserId) — cannot unlock.",
    );
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
      toast.success(`Unlocked ${res.updatedCount} KPI(s) for ${target.emp.name}.`);
    } else {
      toast.success(`Unlocked KPI(s) for ${target.emp.name}.`);
    }
    unlockConfirmTarget.value = null;
    emit("reloadEvaluationHub");
  } catch (e: unknown) {
    toast.error(
      getApiErrorMessage(e, "Could not unlock KPI — please try again later."),
    );
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

function canRejectEvaluationRow(item: GmKpiItem): boolean {
  if (isReadonly.value) return false;
  const code = Number(item.hubAssignmentStatusCode ?? item.statusCode);
  return (EVALUATION_REJECTABLE_STATUSES as readonly number[]).includes(code);
}

function canRejectAnyInDrawerTab(
  emp: GmEvalMember,
  tab: "cascade" | "promotion",
): boolean {
  return itemsForEvalTab(emp, tab).some((it) => canRejectEvaluationRow(it));
}

function openEvaluationRejectDialog(
  item: GmKpiItem | null,
  rejectAll: boolean,
) {
  const emp = drawerEmployee.value;
  if (!emp || isReadonly.value) return;
  if (!rejectAll && item && !canRejectEvaluationRow(item)) return;
  if (rejectAll && !canRejectAnyInDrawerTab(emp, drawerEvalTab.value)) return;
  evaluationRejectDialog.value = { open: true, item, rejectAll };
  evaluationRejectReason.value = "";
  evaluationRejectError.value = "";
}

function closeEvaluationRejectDialog() {
  evaluationRejectDialog.value = { open: false, item: null, rejectAll: false };
  evaluationRejectReason.value = "";
  evaluationRejectError.value = "";
}

async function confirmEvaluationReject() {
  const reason = evaluationRejectReason.value.trim();
  if (!reason) {
    evaluationRejectError.value = "Enter a rejection reason.";
    return;
  }
  const { item, rejectAll } = evaluationRejectDialog.value;
  closeEvaluationRejectDialog();
  await rejectEvaluationKpi(item, rejectAll, reason);
}

async function rejectEvaluationKpi(
  item: GmKpiItem | null,
  rejectAll: boolean,
  rejectReason: string,
) {
  const emp = drawerEmployee.value;
  if (!emp || isReadonly.value) return;
  if (!rejectAll && item && !canRejectEvaluationRow(item)) return;
  const cid = String(selectedCycleId.value ?? "").trim();
  const uid = String(emp.evaluationUserId ?? "").trim();
  if (!cid || !uid) {
    toast.warning("Missing cycle or employee — cannot reject.");
    return;
  }
  rejectEvaluationBusy.value = true;
  try {
    await gmKpiService.rejectEvaluationHub({
      cycleId: cid,
      evaluationUserId: uid,
      promotion: drawerEvalTab.value === "promotion",
      assignmentId: rejectAll ? undefined : item?.id,
      rejectAll,
      rejectReason,
    });
    toast.success(
      rejectAll ? "All rejectable KPIs were rejected." : "KPI evaluation rejected.",
    );
    emit("reloadEvaluationHub");
    if (rejectAll) {
      closeEvaluationDrawer();
    }
  } catch (e: unknown) {
    toast.error(getApiErrorMessage(e, "Could not reject evaluation."));
  } finally {
    rejectEvaluationBusy.value = false;
  }
}

function drawerCanSubmitEvaluation(
  emp: GmEvalMember,
  tab: "cascade" | "promotion",
): boolean {
  return (
    drawerHubShowYearEndConfirm(emp, tab) ||
    drawerHubShowMidYearConfirm(emp, tab)
  );
}

async function submitDrawerEvaluation() {
  const emp = drawerEmployee.value;
  if (!emp) return;
  const tab = drawerEvalTab.value;
  if (drawerHubShowYearEndConfirm(emp, tab)) {
    await confirmDone(emp, GM_HUB_YEAR_END_SCOPES, tab);
  } else if (drawerHubShowMidYearConfirm(emp, tab)) {
    await confirmDone(emp, GM_HUB_MID_YEAR_SCOPES, tab);
  } else {
    toast.info("No KPIs are pending confirmation on this tab.");
  }
}

async function confirmDone(
  emp: GmEvalMember,
  scopes: GmHubConfirmScope[],
  tab: "cascade" | "promotion",
) {
  if (isReadonly.value) return;
  if (!isAwaitingGmEvaluationForTab(emp, tab)) return;
  const activeScopes = activeHubConfirmScopesForTab(emp, scopes, tab);
  const items = activeScopes.flatMap((scope) =>
    itemsForHubConfirmScopeForTab(emp, scope, tab),
  );
  if (!items.length) {
    const midOnly = scopes.every((s) => s === 501 || s === 502);
    toast.warning(
      midOnly
        ? "No KPIs awaiting mid-year review on this tab."
        : "No KPIs awaiting year-end evaluation on this tab.",
    );
    return;
  }

  const needFinal = activeScopes.some((s) => s === 601 || s === 602);
  const c =
    tab === "promotion"
      ? (supervisorPromotionComments[emp.id] ?? "").trim()
      : (supervisorPortfolioComments[emp.id] ?? "").trim();
  if (needFinal && !c) {
    supervisorCommentSubmitAttempted[supervisorAttemptKey(emp.id, tab)] = true;
    toast.warning(
      "Please enter a Supervisor Comment before completing year-end evaluation.",
    );
    return;
  }
  if (needFinal)
    supervisorCommentSubmitAttempted[supervisorAttemptKey(emp.id, tab)] = false;

  if (needFinal && !hubGmScoresCompleteForItems(emp, items)) {
    toast.warning(
      "Please enter GM scores (1–5) for every KPI before completing.",
    );
    return;
  }

  if (!useMockHub) {
    const cid = String(selectedCycleId.value ?? "").trim();
    if (!cid) {
      toast.warning("No KPI cycle selected — cannot confirm.");
      return;
    }
    const uid = String(emp.evaluationUserId ?? "").trim();
    if (!uid) {
      toast.warning("Missing employee id (evaluationUserId) — cannot confirm.");
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
        const midOnly = scopes.every((s) => s === 501 || s === 502);
        toast.warning(
          midOnly
            ? "No mid-year assignments were updated (already processed or cycle mismatch)."
            : "No year-end assignments were updated (already processed or cycle mismatch).",
        );
      } else {
        const tabLabel = tab === "promotion" ? "Promotion" : "Individual / Team";
        if (needFinal) {
          const tail =
            res.skippedCount > 0
              ? ` ${res.skippedCount} skipped.`
              : "";
          toast.success(
            `Year-end evaluation confirmed for ${emp.name} (${tabLabel}, ${res.updatedCount} KPI${res.updatedCount === 1 ? "" : "s"}).${tail} Avg. ${gmScoreDetailLabel.value}: ${pmAvgInPanel(emp)}.`,
          );
        } else if (res.skippedCount > 0) {
          toast.success(
            `Mid-year review completed for ${emp.name} (${tabLabel}, ${res.updatedCount} updated, ${res.skippedCount} skipped).`,
          );
        } else {
          toast.success(
            `Mid-year review completed for ${emp.name} (${tabLabel}, ${res.updatedCount} KPI${res.updatedCount === 1 ? "" : "s"}).`,
          );
        }
      }
    } else {
      toast.success(
        needFinal
          ? `Year-end evaluation confirmed (mock) for ${emp.name}. Avg. ${gmScoreDetailLabel.value}: ${pmAvgInPanel(emp)}.`
          : `Mid-year review completed (mock) for ${emp.name}.`,
      );
    }
    drawerEmpId.value = null;
    emit("reloadEvaluationHub");
  } catch (e: unknown) {
    toast.error(getApiErrorMessage(e, "Could not confirm evaluation — please try again later."));
  } finally {
    confirmBusy.value = false;
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
              v-if="evalTabPendingCounts.cascade > 0"
              class="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white shadow-sm"
              :title="`${evalTabPendingCounts.cascade} pending Individual/Team evaluation(s)`"
            >
              {{ evalTabPendingCounts.cascade }}
            </span>
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
              v-if="evalTabPendingCounts.promotion > 0"
              class="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white shadow-sm"
              :title="`${evalTabPendingCounts.promotion} pending Promotion evaluation(s)`"
            >
              {{ evalTabPendingCounts.promotion }}
            </span>
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
                  :class="sectionHeaderRowClass(sec.branch)"
                  :title="sectionPendingTitle(sec.branch)"
                  @click="toggleSectionExpand(sec.sectionId)"
                >
                  <td colspan="6" class="px-4 py-3 sm:px-5 sm:py-3.5">
                    <div class="flex min-h-8 flex-wrap items-center gap-2.5">
                      <i
                        class="fas fa-chevron-right text-xs transition-transform duration-300 ease-out motion-reduce:transition-none sm:text-sm"
                        :class="[
                          expandedSectionIds[sec.sectionId] ? 'rotate-90' : '',
                          sectionHasPendingEvaluation(sec.branch)
                            ? 'text-amber-700'
                            : 'text-slate-500',
                        ]"
                        aria-hidden="true"
                      />
                      <i
                        class="fas fa-sitemap text-xs sm:text-sm"
                        :class="
                          sectionHasPendingEvaluation(sec.branch)
                            ? 'text-amber-700'
                            : 'text-slate-500'
                        "
                        aria-hidden="true"
                      />
                      <span
                        class="text-[11px] font-extrabold uppercase tracking-wide sm:text-xs"
                        :class="
                          sectionHasPendingEvaluation(sec.branch)
                            ? 'text-amber-900'
                            : 'text-slate-700'
                        "
                      >
                        {{ sec.sectionName }}
                      </span>
                      <span
                        class="text-[11px] font-semibold normal-case sm:text-xs"
                        :class="
                          sectionHasPendingEvaluation(sec.branch)
                            ? 'text-amber-800/90'
                            : 'text-slate-500'
                        "
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
                                    <span class="truncate">{{
                                      assignmentProgressLabel(br.pm)
                                    }}</span>
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
                                                    <span class="truncate">{{
                                                      assignmentProgressLabel(
                                                        ld.sheet,
                                                      )
                                                    }}</span>
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
                                                                  <span class="truncate">{{
                                                                    assignmentProgressLabel(
                                                                      emp,
                                                                    )
                                                                  }}</span>
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
                                                  <span class="truncate">{{
                                                    assignmentProgressLabel(emp)
                                                  }}</span>
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
              <h3 class="text-lg font-bold text-slate-900">Confirm KPI Unlock</h3>
              <p class="mt-3 text-sm text-slate-700">
                Are you sure you want to unlock all KPIs for
                <span class="font-bold">{{ unlockConfirmTarget.emp.name }}</span>
                ?
              </p>
              <div class="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  :disabled="unlockBusy"
                  class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  @click="closeUnlockConfirm"
                >
                  No
                </button>
                <button
                  type="button"
                  :disabled="unlockBusy"
                  class="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                  @click="confirmUnlockKpis"
                >
                  <i v-if="unlockBusy" class="fas fa-spinner fa-spin text-xs" aria-hidden="true" />
                  <i v-else class="fas fa-lock-open text-xs" aria-hidden="true" />
                  Yes
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
                <div class="flex flex-col gap-6 p-4 sm:gap-8 sm:p-5">
                  <div
                    class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md"
                  >
                    <KpiCreatorRowLegend />
                    <div class="border-b border-slate-200 bg-white">
                      <div class="overflow-x-auto bg-white">
                        <table class="min-w-[1180px] w-full text-sm text-left">
                          <thead
                            class="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200"
                          >
                            <tr>
                              <th class="px-4 py-3 font-semibold text-center w-12">STT</th>
                              <th class="px-4 py-3 font-semibold w-1/4">OBJECTIVES</th>
                              <th class="px-4 py-3 font-semibold text-center w-48">TARGET</th>
                              <th class="px-4 py-3 font-semibold text-center w-40">ACTUAL</th>
                              <th class="px-4 py-3 font-semibold text-center w-20">WEIGHT (W)</th>
                              <th class="px-4 py-3 font-semibold text-center w-32">EVIDENCE</th>
                              <th class="px-4 py-3 font-semibold text-center w-32">SELF SCORE</th>
                              <th class="px-4 py-3 font-semibold text-center w-32">
                                FINAL SCORE
                              </th>
                              <th class="px-4 py-3 font-semibold text-center w-28">
                                ACTION
                              </th>
                            </tr>
                          </thead>
                          <tbody
                            v-if="drawerActiveKpiGroups.length === 0"
                            class="text-sm"
                          >
                            <tr>
                              <td
                                colspan="9"
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
                              <tr :class="drawerGroupRowClass(group)">
                                <td
                                  colspan="9"
                                  class="px-4 py-2.5 text-xs font-bold uppercase tracking-wider"
                                  :class="drawerGroupLabelClass(group)"
                                >
                                  {{ group.groupTitle }}
                                </td>
                              </tr>
                              <template
                                v-for="(item, itemIdx) in group.items"
                                :key="item.id"
                              >
                                <tr
                                  class="transition-colors"
                                  :class="
                                    kpiCreatorRowBgClass(
                                      item.creatorRoleCode,
                                      evidenceOpen(drawerEmployee.id, item.id),
                                    )
                                  "
                                >
                                  <td
                                    class="px-4 py-4 text-center font-medium text-slate-400"
                                  >
                                    {{ itemIdx + 1 }}
                                  </td>
                                  <td class="px-4 py-4">
                                    <p class="flex flex-wrap items-center gap-2 font-semibold text-slate-800 text-sm">
                                      <span v-if="drawerItemCode(item)">{{ drawerItemCode(item) }} </span>
                                      <span>{{ drawerItemName(item) }}</span>
                                      <span class="inline-flex items-center gap-1">
                                        <span
                                          class="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold"
                                          :class="drawerStatusClass(item)"
                                        >
                                          {{ drawerStatusLabel(item) }}
                                        </span>
                                        <span
                                          v-if="hasDrawerEvaluationRejectReason(item)"
                                          :title="drawerEvaluationRejectTooltip(item)"
                                          class="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-rose-300 bg-rose-50 text-[10px] font-bold leading-none text-rose-700"
                                          aria-label="Evaluation rejection reason"
                                        >
                                          ?
                                        </span>
                                      </span>
                                    </p>
                                  </td>
                                  <td class="px-4 py-4 text-slate-600 text-xs leading-relaxed text-center">
                                    {{ drawerTargetDisplay(item) }}
                                  </td>
                                  <td class="px-4 py-4 text-center">
                                    <p class="text-xs font-medium text-emerald-700 leading-relaxed">
                                      {{ drawerActualDisplay(item) }}
                                    </p>
                                  </td>
                                  <td class="px-4 py-4 text-center font-semibold text-slate-700">
                                    {{ item.weight }}
                                  </td>
                                  <td class="px-4 py-4 text-center align-middle">
                                    <button
                                      type="button"
                                      class="inline-flex min-w-28 items-center justify-between gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition-colors"
                                      :class="
                                        hasDrawerEvidence(item)
                                          ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                          : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                                      "
                                      @click.stop="
                                        toggleEvidence(
                                          drawerEmployee.id,
                                          item.id,
                                        )
                                      "
                                    >
                                      <span class="inline-flex items-center gap-1">
                                        <i class="fas fa-file-alt text-xs" />
                                        {{ hasDrawerEvidence(item) ? 'Evidence' : 'No Evidence' }}
                                      </span>
                                      <i
                                        class="fas fa-chevron-down text-[10px] text-slate-500 transition-transform"
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
                                  <td class="px-4 py-4 text-center font-bold text-slate-600">
                                    {{ drawerSelfScoreDisplay(item) }}
                                  </td>
                                  <td class="px-4 py-4 text-center">
                                    <select
                                      v-if="hubRowGmScoreEnabled(item)"
                                      class="w-14 rounded border border-slate-300 bg-white px-1 py-1 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 shadow-sm cursor-pointer text-center"
                                      :disabled="isReadonly"
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
                                        :value="n"
                                      >
                                        {{ n }}
                                      </option>
                                    </select>
                                    <span
                                      v-else
                                      class="inline-block min-w-[3.5rem] font-bold text-slate-600"
                                    >{{
                                      currentDisplayableGmScore(drawerEmployee, item) ?? '-'
                                    }}</span>
                                  </td>
                                  <td class="px-4 py-4 text-center align-middle">
                                    <button
                                      v-if="canRejectEvaluationRow(item)"
                                      type="button"
                                      :disabled="rejectEvaluationBusy || confirmBusy"
                                      class="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 shadow-sm transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                      @click.stop="openEvaluationRejectDialog(item, false)"
                                    >
                                      <i class="fas fa-times text-[10px]" aria-hidden="true" />
                                      Reject
                                    </button>
                                    <span v-else class="text-xs text-slate-300">—</span>
                                  </td>
                                </tr>
                                <tr
                                  v-show="
                                    evidenceOpen(drawerEmployee.id, item.id)
                                  "
                                  class="bg-slate-50/50"
                                >
                                  <td
                                    colspan="9"
                                    class="p-0 border-b border-slate-200"
                                  >
                                    <div
                                      class="px-8 py-4 bg-gradient-to-r from-indigo-50/30 to-transparent border-l-2 border-indigo-300"
                                    >
                                      <p
                                        class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2"
                                      >
                                        Evidences
                                      </p>
                                      <template v-if="usesPmStyleEvidence(item)">
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
                                                href="#"
                                                class="break-all text-xs font-semibold text-indigo-600 underline hover:text-indigo-800"
                                                :title="evidenceAttachmentTitle(att)"
                                                @click.prevent="onEvidenceAttachmentClick(att)"
                                              >
                                                {{ evidenceAttachmentLabel(att) }}
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
                                        class="mt-3 rounded-lg border border-emerald-100 bg-white p-3 shadow-sm"
                                        :class="{
                                          'opacity-80': !hubRowGmCommentEnabled(item),
                                        }"
                                      >
                                        <p
                                          class="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700"
                                        >
                                          Supervisor's Comment
                                        </p>
                                        <textarea
                                          v-model="gmKpiComments[drawerEmployee.id][item.id]"
                                          class="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                                          rows="4"
                                          :disabled="
                                            isReadonly ||
                                            confirmBusy ||
                                            !hubRowGmCommentEnabled(item)
                                          "
                                          placeholder="Enter comment / evaluation for this KPI..."
                                        />
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              </template>
                            </template>
                          </tbody>
                          <tfoot
                            v-if="drawerActiveKpiGroups.length > 0"
                            class="border-t-2 border-slate-200"
                          >
                            <tr class="bg-slate-50">
                              <td
                                colspan="4"
                                class="px-4 py-3 text-right font-bold text-slate-600 text-xs tracking-wider"
                              >
                                TOTAL SCORE:
                              </td>
                              <td class="px-4 py-3 text-center font-bold text-slate-800">
                                {{
                                  totalKpiWeightForGroupList(
                                    drawerActiveKpiGroups,
                                  )
                                }}
                                <span class="text-[10px] text-slate-400 font-normal">pts</span>
                              </td>
                              <td class="px-4 py-3 text-center font-bold text-slate-400">-</td>
                              <td class="px-4 py-3 text-center font-bold text-slate-400">-</td>
                              <td class="px-4 py-3 text-center font-bold text-slate-400">-</td>
                              <td class="px-4 py-3" />
                            </tr>
                            <tr class="bg-purple-50 border-t border-purple-100">
                              <td
                                colspan="5"
                                class="px-4 py-4 text-right font-bold text-purple-700 text-xs tracking-wider"
                              >
                                AVERAGE SCORE:
                              </td>
                              <td class="px-4 py-4 text-center font-bold text-slate-300">-</td>
                              <td class="px-4 py-4 text-center font-bold text-slate-600">
                                {{
                                  selfAvgForGroupList(
                                    drawerEmployee,
                                    drawerActiveKpiGroups,
                                  )
                                }}
                              </td>
                              <td
                                class="px-4 py-4 text-center font-bold text-lg font-black text-purple-700"
                              >
                                {{
                                  pmAvgForGroupList(
                                    drawerEmployee,
                                    drawerActiveKpiGroups,
                                  )
                                }}
                              </td>
                              <td class="px-4 py-4" />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>

                    <div
                      v-if="drawerEvalTab === 'cascade'"
                      class="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
                    >
                      <h4
                        class="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800"
                      >
                        <i class="fas fa-comment-dots text-indigo-600" />
                        Comment of employee and supervisor
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
                                drawerNeedsYearEndSupervisorComment(
                                  drawerEmployee,
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
                            @click="confirmDone(drawerEmployee, GM_HUB_YEAR_END_SCOPES, 'cascade')"
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
                            @click="confirmDone(drawerEmployee, GM_HUB_MID_YEAR_SCOPES, 'cascade')"
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
                      class="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
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
                                drawerNeedsYearEndSupervisorComment(
                                  drawerEmployee,
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
                            @click="confirmDone(drawerEmployee, GM_HUB_YEAR_END_SCOPES, 'promotion')"
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
                            @click="confirmDone(drawerEmployee, GM_HUB_MID_YEAR_SCOPES, 'promotion')"
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
            <div
              class="shrink-0 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] sm:px-5"
            >
              <div class="flex w-full flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  class="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                  @click="closeEvaluationDrawer"
                >
                  Cancel
                </button>
                <div
                  v-if="
                    drawerEmployee &&
                    !isReadonly &&
                    (canRejectAnyInDrawerTab(drawerEmployee, drawerEvalTab) ||
                      drawerCanSubmitEvaluation(drawerEmployee, drawerEvalTab))
                  "
                  class="flex flex-wrap items-center gap-3"
                >
                  <button
                    v-if="canRejectAnyInDrawerTab(drawerEmployee, drawerEvalTab)"
                    type="button"
                    :disabled="rejectEvaluationBusy || confirmBusy"
                    class="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    @click="openEvaluationRejectDialog(null, true)"
                  >
                    <i
                      v-if="rejectEvaluationBusy"
                      class="fas fa-spinner fa-spin text-xs"
                      aria-hidden="true"
                    />
                    <i v-else class="fas fa-times text-xs" aria-hidden="true" />
                    Reject all
                  </button>
                  <button
                    v-if="drawerCanSubmitEvaluation(drawerEmployee, drawerEvalTab)"
                    type="button"
                    :disabled="confirmBusy || rejectEvaluationBusy"
                    class="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-600 hover:shadow-lg focus:ring-4 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    @click="submitDrawerEvaluation"
                  >
                    <i
                      v-if="confirmBusy"
                      class="fas fa-spinner fa-spin text-xs"
                      aria-hidden="true"
                    />
                    <i v-else class="fas fa-paper-plane text-xs" aria-hidden="true" />
                    Submit evaluation
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <Teleport to="body">
        <Transition name="fade">
          <div
            v-if="evaluationRejectDialog.open"
            class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm"
            @click.self="closeEvaluationRejectDialog"
          >
            <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
              <div class="mb-3 flex items-center gap-3">
                <div class="rounded-full bg-rose-100 p-2 text-rose-600">
                  <i class="fas fa-circle-exclamation text-lg" />
                </div>
                <h3 class="text-lg font-bold text-slate-900">Reject evaluation</h3>
              </div>
              <p class="mb-3 text-sm text-slate-600">
                {{
                  evaluationRejectDialog.rejectAll
                    ? "You are rejecting all rejectable KPIs in this tab. Enter a reason."
                    : "Enter the reason for rejecting this KPI evaluation."
                }}
              </p>
              <label class="mb-1 block text-sm font-semibold text-slate-700">
                Rejection reason <span class="text-rose-500">*</span>
              </label>
              <textarea
                v-model="evaluationRejectReason"
                class="min-h-[110px] w-full resize-none rounded-lg border p-3 text-sm outline-none focus:ring-2"
                :class="
                  evaluationRejectError
                    ? 'border-rose-400 focus:ring-rose-100'
                    : 'border-slate-300 focus:ring-rose-100'
                "
                placeholder="Enter detailed reason..."
              />
              <p v-if="evaluationRejectError" class="mt-1 text-xs font-medium text-rose-600">
                {{ evaluationRejectError }}
              </p>
              <div class="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  class="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  :disabled="rejectEvaluationBusy"
                  @click="closeEvaluationRejectDialog"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  :disabled="rejectEvaluationBusy"
                  class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                  @click="confirmEvaluationReject"
                >
                  Confirm rejection
                </button>
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
