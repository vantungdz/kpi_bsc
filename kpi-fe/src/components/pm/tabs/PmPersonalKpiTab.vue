<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { pmKpiService } from "@/services/modules/kpi-pm.service";
import { memberKpiService } from "@/services/modules/kpi-member.service";
import type { UpdateMemberSheetItemBody } from "@/services/modules/kpi-member.service";
import EvaluationCommentBlock from "@/components/evaluation/EvaluationCommentBlock.vue";
import EvaluationEvidenceDrawer from "@/components/evaluation/EvaluationEvidenceDrawer.vue";
import GmStrategicKpiTypeTag from "@/components/gm/GmStrategicKpiTypeTag.vue";
import { getPmPortfolioSubmitButtonState } from "@/utils/common";
import { KPI_STATUS, KPI_TYPE } from "@/config/constants";
import {
  formatPmPortfolioActualCell,
  parseNumericFromField,
  pmPortfolioActualDisplayMode,
  CALC_RULE_SUM,
} from "@/utils/memberKpiHelpers";
import { useToast } from "vue-toastification";
import {
  appendEvidenceFilesUrlsToPayload,
  purgeRemovedUploadedEvidenceFiles,
} from "@/utils/evidenceFileStorage";
import { useAuthStore } from "@/stores/auth.store";
import { formatKpiTargetWithUnit } from "@/utils/kpiUnitCodes";
import KpiCreatorRowLegend from "@/components/shared/KpiCreatorRowLegend.vue";
import { kpiCreatorRowBgClass } from "@/utils/kpiCreatorRowBg";
import { pmAsmStatusPillClass } from "@/utils/pmAsmStatusUi";
import KpiScoringRulesPreviewTooltip from "@/components/kpi/KpiScoringRulesPreviewTooltip.vue";
import PmFinalScoreCommentTooltip from "@/components/pm/PmFinalScoreCommentTooltip.vue";
import PmKpiTableAlignedCell from "@/components/pm/PmKpiTableAlignedCell.vue";
import PmAssigneeTargetScaleModal, {
  type PmAssigneeTargetScaleEditItem,
} from "@/components/pm/PmAssigneeTargetScaleModal.vue";
import {
  diagnosticsActualNumericColorClass,
  diagnosticsActualTextColorClass,
  diagnosticsMemberActualColorClass,
  isDiagnosticsMidYearPhase,
} from "@/utils/diagnosticsActualColor";
import { formatScoreDisplay } from "@/utils/formatScoreDisplay";
import {
  dispatchPmCreateKpiAllowed,
  pmCanCreatePersonalKpi,
} from "@/utils/pmCreateKpiGate";
import {
  canSupervisorViewMemberSelfEvaluation,
  supervisorMemberActualDisplay,
  supervisorMemberSelfScoreDisplay,
} from "@/utils/memberEvaluationVisibility";

const props = withDefaults(
  defineProps<{
    /** Tab KPI Personal (individual + team) hoặc chỉ KPI Promotion. */
    portfolioScope?: "portfolio" | "promotion" | "department";
    year?: number | string;
    readonlyYear?: boolean;
  }>(),
  {
    portfolioScope: "portfolio",
    year: new Date().getFullYear(),
    readonlyYear: false,
  },
);

const toast = useToast();
const authStore = useAuthStore();
const removingChildAssignmentIds = ref<Set<string>>(new Set());
const sendingPmFeedbackIds = ref<Set<string>>(new Set());
const decidingMemberFeedbackIds = ref<Set<string>>(new Set());
const currentPmUserId = computed(() => String(authStore.user?.id ?? "").trim());

function formatTargetCell(v: unknown): string {
  if (v == null) return "-";
  const s = String(v).trim();
  return s === "" ? "-" : s;
}

function formatTargetCellWithUnit(
  target: unknown,
  unitCode?: number | null,
): string {
  return formatKpiTargetWithUnit(formatTargetCell(target), unitCode);
}

/** Cột Thực tế: ghép đơn vị KPI (cùng rule cột Chỉ tiêu); hỗ trợ nhiều mục «a · b». */
function formatPmActualCellWithUnit(
  display: string,
  unitCode: unknown,
): string {
  const u = coercePortfolioUnitCode(unitCode);
  const s = String(display ?? "").trim();
  if (!s) return "";
  if (s.includes(" · ")) {
    const parts = s
      .split(" · ")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return "";
    return parts.map((part) => formatKpiTargetWithUnit(part, u)).join(" · ");
  }
  const withUnit = formatKpiTargetWithUnit(s, u);
  return withUnit === "-" ? "" : withUnit;
}

/** Cột Actual — đồng bộ Strategic Diagnostics (Department / Personal / Promotion). */
const PM_PORTFOLIO_ACTUAL_CELL_CLASS =
  "text-center text-xs font-bold tabular-nums leading-tight";

function formatCompactNumericDisplay(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/\.?0+$/, "");
}

function coercePortfolioUnitCode(raw: unknown): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseTargetNumber(v: unknown): number {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

type PmTargetBalance = "short" | "excess" | "ok" | null;

function normalizeNumericTarget(v: unknown): number | null {
  const s = String(v ?? "").trim();
  if (!s || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function pmTargetPillClass(balance: PmTargetBalance): string {
  const base =
    "inline-block min-w-[2.25rem] rounded-md px-2 py-1 text-xs font-semibold tabular-nums leading-tight";
  if (balance === "short")
    return `${base} border border-rose-200 bg-rose-50 text-rose-800`;
  if (balance === "excess")
    return `${base} border border-amber-200 bg-amber-50 text-amber-900`;
  if (balance === "ok")
    return `${base} border border-emerald-200 bg-emerald-50 text-emerald-800`;
  return `${base} bg-slate-100 text-slate-700`;
}

function pmParentTargetBalance(item: any): PmTargetBalance {
  if (
    !item?.isTree ||
    !Array.isArray(item.children) ||
    item.children.length === 0
  )
    return null;
  /** Chỉ KPI Team (cascading): cha có target tổng, con là phân bổ — so khớp tổng con vs cha. Individual/Promotion: mỗi người cùng target gốc, không so theo kiểu cộng dồn. */
  if (!isTeamTreeKpi(item)) return null;
  const parent = normalizeNumericTarget(item.target);
  if (parent == null) return null;
  const childNums = item.children
    .map((c: any) => normalizeNumericTarget(c?.target))
    .filter((n: number | null): n is number => n != null);
  if (childNums.length === 0) return null;
  const assigned = childNums.reduce((s: number, n: number) => s + n, 0);
  const diff = assigned - parent;
  if (Math.abs(diff) < 1e-9) return "ok";
  return diff > 0 ? "excess" : "short";
}

function pmParentTargetTitle(item: any): string | undefined {
  const balance = pmParentTargetBalance(item);
  if (balance === "short")
    return "Total target allocated to members is lower than the PM KPI target.";
  if (balance === "excess")
    return "Total target allocated to members exceeds the PM KPI target.";
  if (balance === "ok")
    return "Total target allocated to members matches the PM KPI target.";
  return undefined;
}

/** Mọi % trong một ô Actual đã format (vd một dòng KPI có nhiều record). */
function extractPercentsFromFormattedActual(s: string): number[] {
  const out: number[] = [];
  const re = /(\d+(?:\.\d+)?)\s*%/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** CALC_RULE 801: gộp Actual node cha = tổng các con; 802/803 và rule khác = trung bình. */
function pmTeamParentRollupActualIsSum(item: any): boolean {
  return Number(item?.calculationRuleCode) === CALC_RULE_SUM;
}

/** Giá trị số từ Actual con; null khi chưa có / không đọc được (dùng khi roll-up = trung bình — bỏ qua khỏi mẫu số). */
function numericActualValueForTeamChildOrNull(
  child: any,
  parentItem: any,
): number | null {
  if (!canSupervisorViewMemberSelfEvaluation(child?.statusCode, "pm")) {
    return null;
  }
  const calc = parentItem.calculationTypeCode;
  const mode = pmPortfolioActualDisplayMode(parentItem.calculationRuleCode);
  const formatted = formatPmPortfolioActualCell(
    child.actualResult,
    calc,
    mode,
    { actualOnly: true },
  ).trim();
  if (!formatted) return null;

  const percents = extractPercentsFromFormattedActual(formatted);
  if (percents.length > 0) {
    const avg = percents.reduce((a, b) => a + b, 0) / percents.length;
    return Number.isFinite(avg) ? Math.max(0, avg) : null;
  }

  const n = parseNumericFromField(formatted);
  if (n != null && Number.isFinite(n) && n >= 0) return n;

  return null;
}

/**
 * Node cha có con (Team / KPI Department): Actual gộp từ các con —
 * 801 → tổng (con thiếu Actual tính 0); 802/803 → trung bình các con có Actual hợp lệ.
 */
function formatPmTeamParentActualCell(item: any): string {
  const calc = item.calculationTypeCode;
  const mode = pmPortfolioActualDisplayMode(item.calculationRuleCode);

  if (
    !item?.isTree ||
    !Array.isArray(item.children) ||
    item.children.length === 0
  ) {
    return formatPmActualCellWithUnit(
      formatPmPortfolioActualCell(item.actualResult, calc, mode).trim(),
      item.unitCode,
    );
  }

  const children = item.children as any[];
  const childActuals = children
    .map((c) => numericActualValueForTeamChildOrNull(c, item))
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (childActuals.length === 0) {
    return "";
  }

  if (pmTeamParentRollupActualIsSum(item)) {
    const total = childActuals.reduce((a, b) => a + b, 0);
    const safe = Number.isFinite(total) ? Math.max(0, total) : 0;
    return formatPmActualCellWithUnit(
      formatCompactNumericDisplay(safe),
      item.unitCode,
    );
  }

  const parts = childActuals;
  const avg = parts.reduce((a, b) => a + b, 0) / parts.length;
  const safe = Number.isFinite(avg) ? Math.max(0, avg) : 0;
  return formatPmActualCellWithUnit(
    formatCompactNumericDisplay(safe),
    item.unitCode,
  );
}

const emit = defineEmits([
  "open-assign",
  "open-assign-after-member-feedback",
  "open-member-detail",
  "open-member",
  "feedback-pending-count",
  "timeline-refresh",
]);

/**
 * Dòng KPI không phải cây Team: Individual (tab Portfolio) hoặc Promotion (tab KPI Promotion).
 * Chưa Accept (404) thì khóa nút Edit minh chứng — cùng rule với Individual.
 */
/** PM đã Accept KPI (404→403), đang chờ GM — khóa Edit / xóa KPI. */
function isPmKpiLockedAfterPmAccept(item: any): boolean {
  return Number(item?.statusCode) === KPI_STATUS.WAITING_GM_APPROVAL;
}

/** 406 (từ chối KPI từ GM queue) — PM xử lý giống 404. Từ chối feedback → 404. */
function isPmPendingAcceptanceLikeStatus(statusCode: unknown): boolean {
  const sc = Number(statusCode);
  return (
    sc === KPI_STATUS.PENDING_ACCEPTANCE || sc === KPI_STATUS.REJECTED
  );
}

function isPmDirectAssignmentEditLockedBeforeAccept(item: any): boolean {
  if (!item || item.isTree) return false;
  if (isPmKpiLockedAfterPmAccept(item)) return true;
  if (Number(item.statusCode) === KPI_STATUS.FEEDBACK_IN_PROGRESS) return true;
  if (!isPmPendingAcceptanceLikeStatus(item.statusCode)) return false;

  if (props.portfolioScope === "portfolio") {
    return (
      Number(item.typeCode) === KPI_TYPE.INDIVIDUAL ||
      item.kpiType === "individual"
    );
  }
  return (
    Number(item.typeCode) === KPI_TYPE.PROMOTION || item.kpiType === "promotion"
  );
}

function pmDirectAssignmentEditLockReason(item: any): string | undefined {
  if (isPmKpiLockedAfterPmAccept(item)) {
    return "KPI accepted — waiting for GM approval; editing is locked.";
  }
  if (Number(item?.statusCode) === KPI_STATUS.FEEDBACK_IN_PROGRESS) {
    return "KPI is waiting for GM to process feedback.";
  }
  if (isPmDirectAssignmentEditLockedBeforeAccept(item)) {
    return "Accept the KPI before editing.";
  }
  return undefined;
}

/** KPI Team — dòng cascade của chính PM: chỉ Edit Actual sau khi PM đã Accept KPI (assignment cha ≥405). */
function isPmTeamSelfRowActualEditLockedBeforeAccept(parentItem: any): boolean {
  if (!parentItem?.isTree) return false;
  if (isPmKpiLockedAfterPmAccept(parentItem)) return true;
  return (
    isPmPendingAcceptanceLikeStatus(parentItem.statusCode) ||
    Number(parentItem.statusCode) === KPI_STATUS.FEEDBACK_IN_PROGRESS
  );
}

function pmTeamSelfRowLockReason(parentItem: any): string | undefined {
  if (isPmKpiLockedAfterPmAccept(parentItem)) {
    return "KPI accepted — waiting for GM approval; editing is locked.";
  }
  if (Number(parentItem?.statusCode) === KPI_STATUS.FEEDBACK_IN_PROGRESS) {
    return "KPI is waiting for GM to process feedback.";
  }
  if (isPmPendingAcceptanceLikeStatus(parentItem?.statusCode)) {
    return "Accept the KPI before editing.";
  }
  return undefined;
}

function isPmGmFeedbackPending(item: any): boolean {
  return Number(item?.statusCode) === KPI_STATUS.FEEDBACK_IN_PROGRESS;
}

/** PM → GM feedback: chỉ KPI do GM giao, không hiện trên KPI PM tự tạo. */
function canShowPmFeedbackToGmButton(item: any): boolean {
  if (props.readonlyYear) return false;
  if (Boolean(item?.isSelfCreated)) return false;
  return (
    isPmPendingAcceptanceLikeStatus(item?.statusCode) ||
    isPmGmFeedbackPending(item)
  );
}

function isPmAssignmentRejected(item: any): boolean {
  return Number(item?.statusCode) === KPI_STATUS.REJECTED;
}

/** Alias — assignment ASM 406 (nhãn hiển thị; thao tác PM giống 404). */
function isRejectedKpi(item: any): boolean {
  return isPmAssignmentRejected(item);
}

function isWaitingGmApprovalKpi(item: any): boolean {
  return Number(item?.statusCode) === KPI_STATUS.WAITING_GM_APPROVAL;
}

function canShowTeamAllocationButton(item: any): boolean {
  return (
    !props.readonlyYear && item?.isTree && !isWaitingGmApprovalKpi(item)
  );
}

function assignedNonPmChildren(item: any): any[] {
  if (!Array.isArray(item?.children)) return [];
  return item.children.filter((child: any) => !isChildOwnedByCurrentPm(child));
}

function isTeamAllocationEditLocked(item: any): boolean {
  if (isPmPendingAcceptanceLikeStatus(item?.statusCode)) return false;
  const children = assignedNonPmChildren(item);
  if (children.length === 0) return false;
  return children.every(
    (child: any) => Number(child?.statusCode) === KPI_STATUS.ACCEPTED,
  );
}

function teamAllocationEditLockReason(item: any): string | undefined {
  if (isPmKpiLockedAfterPmAccept(item)) {
    return "KPI accepted — waiting for GM approval; editing is locked.";
  }
  if (isPmGmFeedbackPending(item))
    return "KPI is waiting for GM to process feedback.";
  if (isTeamAllocationEditLocked(item)) {
    return "All members assigned to this KPI have confirmed; allocation cannot be edited.";
  }
  return undefined;
}

/** KPI PM tự tạo — 404 (trước khi gửi GM) hoặc 406 (GM từ chối): sửa định nghĩa KPI qua drawer. */
/** GM/PM giao KPI có bật cho phép sửa target + thang điểm trên assignment. */
function canEditAssigneeTargetScale(item: any): boolean {
  if (Boolean(item?.isSelfCreated)) return false;
  if (item?.allowAssigneeTargetScaleEdit !== true) return false;
  const sc = Number(item?.statusCode ?? 0);
  return sc === KPI_STATUS.PENDING_ACCEPTANCE
    || sc === KPI_STATUS.ACCEPTED
    || sc === KPI_STATUS.FEEDBACK_IN_PROGRESS;
}

function openAssigneeTargetScaleEditor(item: any) {
  assigneeTargetScaleItem.value = {
    id: String(item.id),
    target: String(item.target ?? ""),
    targetDescription: String(item.targetDescription ?? ""),
  };
  showAssigneeTargetScaleModal.value = true;
}

function onAssigneeTargetScaleSaved(payload: {
  assignmentId: string;
  target: string;
  targetDescription: string;
}) {
  const id = String(payload.assignmentId ?? "").trim();
  personalKpisRaw.value = personalKpisRaw.value.map((row) => {
    if (String(row.id) !== id) return row;
    return {
      ...row,
      target: payload.target || row.target,
      targetDescription: payload.targetDescription || row.targetDescription,
    };
  });
  toast.success("Đã cập nhật target và thang điểm.");
  showAssigneeTargetScaleModal.value = false;
}

function canShowSelfCreatedKpiEditButton(item: any): boolean {
  if (props.readonlyYear || !Boolean(item?.isSelfCreated)) return false;
  const sc = Number(item?.statusCode);
  return (
    sc === KPI_STATUS.PENDING_ACCEPTANCE || sc === KPI_STATUS.REJECTED
  );
}

function canShowSelfCreatedDeleteButton(item: any): boolean {
  if (props.readonlyYear || !Boolean(item?.isSelfCreated)) return false;
  const sc = Number(item?.statusCode);
  return sc === KPI_STATUS.PENDING_ACCEPTANCE || sc === KPI_STATUS.REJECTED;
}

function isTeamTreeKpi(item: any): boolean {
  if (!item?.isTree) return false;
  if (item.typeCode === KPI_TYPE.TEAM) return true;
  return item.kpiType === "cascading";
}

/** Nhãn trạng thái assignment: `sys_status_codes.description` (ASM_STATUS) từ API init. */
const asmStatusDescriptionByCode = ref<Record<number, string>>({});

function pmAssignmentStatusBadge(
  statusCode: unknown,
): { label: string; cls: string } | null {
  const sc = Number(statusCode);
  if (!Number.isFinite(sc)) return null;
  const fromDb = String(asmStatusDescriptionByCode.value[sc] ?? "").trim();
  const label = fromDb || String(sc);
  return { label, cls: pmAsmStatusPillClass(sc) };
}

function isUnassignedPmTeamKpi(item: any): boolean {
  if (!isTeamTreeKpi(item)) return false;
  const children = Array.isArray(item.children) ? item.children : [];
  return children.length === 0;
}

function normalizePmAsmStatusCode(code: unknown): number | null {
  const n = Number(code);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Rollup ASM trên KPI Team — ưu tiên 407 (Processing Feedback) giống GM diagnostics. */
function minPmAsmStatusCodeWithFeedbackPriority(
  codes: Array<number | null | undefined>,
): number | null {
  const valid = codes
    .map(normalizePmAsmStatusCode)
    .filter((n): n is number => n != null);
  if (valid.includes(KPI_STATUS.FEEDBACK_IN_PROGRESS)) {
    return KPI_STATUS.FEEDBACK_IN_PROGRESS;
  }
  return valid.length > 0 ? Math.min(...valid) : null;
}

/** Status hiển thị dòng KPI cha (PM assignment + member cascade). */
function pmTeamParentRollupStatusCode(item: any): number | null {
  const codes: number[] = [];
  const parentSc = normalizePmAsmStatusCode(item?.statusCode);
  if (parentSc != null) codes.push(parentSc);
  for (const child of assignedNonPmChildren(item)) {
    const childSc = normalizePmAsmStatusCode(child?.statusCode);
    if (childSc != null) codes.push(childSc);
  }
  const rolled = minPmAsmStatusCodeWithFeedbackPriority(codes);
  return rolled ?? parentSc;
}

/** Tab KPI Department: dòng KPI gom theo infoId — rollup min(status) con; ưu tiên 407. */
function isDepartmentGroupedKpi(item: any): boolean {
  return (
    props.portfolioScope === "department" &&
    String(item?.id ?? "").trim().startsWith("info-")
  );
}

function pmDepartmentParentRollupStatusCode(item: any): number | null {
  const children = Array.isArray(item?.children) ? item.children : [];
  const codes = children.map((c: any) => c?.statusCode);
  return minPmAsmStatusCodeWithFeedbackPriority(codes);
}

/** Mã hiển thị cột Status — node cha Team rollup từ con; node con = assignment của member. */
function pmStatusCodeForDisplayRow(
  item: any,
  mode: "parent" | "child",
): number | null {
  if (mode === "parent" && isTeamTreeKpi(item)) {
    return pmTeamParentRollupStatusCode(item);
  }
  if (mode === "parent" && isDepartmentGroupedKpi(item)) {
    return pmDepartmentParentRollupStatusCode(item);
  }
  return normalizePmAsmStatusCode(item?.statusCode);
}

function pmRowStatusBadge(item: any, mode: "parent" | "child") {
  const displayCode = pmStatusCodeForDisplayRow(item, mode);
  const badge = pmAssignmentStatusBadge(displayCode);
  if (
    badge &&
    mode === "parent" &&
    displayCode === KPI_STATUS.PENDING_ACCEPTANCE &&
    isUnassignedPmTeamKpi(item)
  ) {
    return { ...badge, label: "Pending Assignment" };
  }
  return badge;
}

function pmRejectedReasonText(item: any): string {
  return String(item?.updateReason ?? "").trim();
}

function pmStatusRejectTooltip(item: any): string {
  const reason = pmRejectedReasonText(item);
  if (!reason) return "";
  return `Rejection reason:\n${reason}`;
}

/** GM/PM từ chối — ASM 406 + update_reason. */
function hasPmRejectedReason(item: any): boolean {
  const reason = pmRejectedReasonText(item);
  if (!reason) return false;
  return Number(item?.statusCode ?? 0) === KPI_STATUS.REJECTED;
}

function pmFeedbackPendingRowClass(item: any): string {
  if (!isPmGmFeedbackPending(item)) return "";
  return "";
}

/** Nền dòng KPI cha: màu theo người tạo KPI (GM). */
function pmKpiParentRowClass(item: any): string {
  return kpiCreatorRowBgClass(item.creatorRoleCode, item.expanded);
}

function isSendingPmFeedback(assignmentId: unknown): boolean {
  return sendingPmFeedbackIds.value.has(String(assignmentId ?? ""));
}

const personalKpisRaw = ref<any[]>([]);
const portfolioDataLoaded = ref(false);
const kpiCycleInfo = ref<any>(null);
const expandedKpiByKey = ref<Record<string, boolean>>({});

const isPmDepartmentMidYearPhase = computed(() =>
  isDiagnosticsMidYearPhase(kpiCycleInfo.value),
);

function pmDepartmentParentActualColorClass(item: any): string {
  const actualDisplay = formatPmTeamParentActualCell(item) || "-";
  const actualNum = parseNumericFromField(actualDisplay);
  const targetNum = parseNumericFromField(String(item.target ?? ""));
  const fromNum = diagnosticsActualNumericColorClass(
    actualNum,
    targetNum,
    item.calculationRuleCode,
    isPmDepartmentMidYearPhase.value,
  );
  if (fromNum != null) return fromNum;
  return diagnosticsActualTextColorClass(
    actualDisplay,
    String(item.target ?? ""),
  );
}

function pmDepartmentChildActualColorClass(parentItem: any, child: any): string {
  const mode = pmPortfolioActualDisplayMode(parentItem.calculationRuleCode);
  const actualRaw = formatPmPortfolioActualCell(
    child.actualResult,
    parentItem.calculationTypeCode,
    mode,
    { actualOnly: true },
  ).trim();
  return diagnosticsMemberActualColorClass({
    actualRaw,
    targetRaw: String(child.target ?? ""),
    calculationRuleCode: parentItem.calculationRuleCode,
    isMidYear: isPmDepartmentMidYearPhase.value,
  });
}

function selectedYearParam(): string {
  const y = Number(props.year);
  return Number.isFinite(y) && y > 0
    ? String(y)
    : String(new Date().getFullYear());
}

function kpiExpandStateKey(kpiId: unknown): string {
  return `${props.portfolioScope}:${selectedYearParam()}:${String(kpiId ?? "").trim()}`;
}

function readKpiExpandedState(kpiId: unknown): boolean {
  const key = kpiExpandStateKey(kpiId);
  return expandedKpiByKey.value[key] === true;
}

function setKpiExpandedState(item: any, expanded: boolean) {
  if (!item?.isTree) return;
  item.expanded = expanded;
  expandedKpiByKey.value = {
    ...expandedKpiByKey.value,
    [kpiExpandStateKey(item.id)]: expanded,
  };
}

function toggleKpiExpanded(item: any) {
  setKpiExpandedState(item, !item.expanded);
}

function syncPmCreateKpiGateForLayout() {
  if (props.portfolioScope !== "portfolio") return;
  const y = Number(selectedYearParam());
  dispatchPmCreateKpiAllowed(
    Number.isFinite(y) ? y : new Date().getFullYear(),
    pmCanCreatePersonalKpi(scopedPersonalKpisRaw.value),
  );
}

async function loadPmPortfolio(year?: string) {
  if (props.portfolioScope === "portfolio") {
    portfolioDataLoaded.value = false;
  }
  try {
    const data: any = await pmKpiService.getInitialization(
      year ?? selectedYearParam(),
      props.portfolioScope,
    );

    const descMap: Record<number, string> = {};
    for (const row of data.asmStatuses ?? []) {
      const c = Number(row?.code);
      if (!Number.isFinite(c)) continue;
      const d = String(row?.description ?? "").trim();
      if (d) descMap[c] = d;
    }
    asmStatusDescriptionByCode.value = descMap;

    // Map backend Enums sang UI String
    const typeMap: Record<number, string> = {
      101: "individual",
      102: "cascading",
      103: "promotion",
    };
    const statusMap: Record<number, string> = {
      401: "draft",
      402: "pending_approval",
      403: "pending_approval",
      404: "pending_approval",
      405: "approved",
      406: "rejected",
      407: "pending_approval",
    };

    const pmUid = currentPmUserId.value.trim();

    // Map KpiGroupDto -> UI shape
    personalKpisRaw.value = (data.kpis ?? []).map((kpi: any) => {
      const kpiId = String(kpi.id);
      return {
        id: kpiId,
        infoId: String(kpi.infoId),
        group: kpi.group || "Khác", // Dùng luôn tên group BE trả về (vd: "A - Hiệu quả công việc...")
        code: kpi.code,
        /** Mã loại BE (101/102/103) — drawer Assign dùng để phân biệt Team vs catalog target. */
        typeCode: typeof kpi.kpiType === "number" ? kpi.kpiType : undefined,
        kpiType: typeMap[kpi.kpiType] || "individual",
        isImportant: kpi.isImportant,
        status: statusMap[Number(kpi.statusCode)] || "pending_approval",
        name: kpi.name,
        target: kpi.target,
        actualResult: kpi.actualResult != null ? String(kpi.actualResult) : "",
        weight: kpi.weight,
        statusCode: kpi.statusCode,
        updateReason:
          kpi.updateReason != null && String(kpi.updateReason).trim() !== ""
            ? String(kpi.updateReason).trim()
            : undefined,
        feedbackNote: kpi.feedbackNote ?? "",
        selfScore: kpi.selfScore != null ? Number(kpi.selfScore) : null,
        pmScore: kpi.pmScore != null ? Number(kpi.pmScore) : null,
        pmEvaluationComment:
          kpi.pmEvaluationComment != null &&
          String(kpi.pmEvaluationComment).trim() !== ""
            ? String(kpi.pmEvaluationComment).trim()
            : undefined,
        gmEvaluationComment:
          kpi.gmEvaluationComment != null &&
          String(kpi.gmEvaluationComment).trim() !== ""
            ? String(kpi.gmEvaluationComment).trim()
            : undefined,
        calculationRuleCode:
          kpi.calculationRuleCode != null
            ? Number(kpi.calculationRuleCode)
            : undefined,
        calculationTypeCode:
          kpi.calculationTypeCode != null
            ? Number(kpi.calculationTypeCode)
            : undefined,
        unitCode: coercePortfolioUnitCode(kpi.unitCode ?? kpi.unit_code),
        targetDescription:
          kpi.targetDescriptionJson != null &&
          String(kpi.targetDescriptionJson).trim() !== ""
            ? String(kpi.targetDescriptionJson)
            : "",
        isTree: kpi.isTree,
        expanded: readKpiExpandedState(kpiId),
        isSelfCreated: Boolean(kpi.isSelfCreated),
        allowAssigneeTargetScaleEdit: kpi.allowAssigneeTargetScaleEdit === true,
        creatorRoleCode:
          kpi.creatorRoleCode != null &&
          String(kpi.creatorRoleCode).trim() !== ""
            ? String(kpi.creatorRoleCode).trim().toUpperCase()
            : undefined,
        userName: kpi.userName,
        userRole: kpi.userRole,
        userId: kpi.userId != null ? String(kpi.userId) : undefined,
        userAvatar: kpi.userName
          ? kpi.userName
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .substring(0, 2)
              .toUpperCase()
          : "U",
        children: (kpi.children || []).map((c: any) => ({
          id: String(c.id),
          userId: c.userId != null ? String(c.userId) : undefined,
          name: c.name,
          role: c.role || "Member",
          // Tự động generate Avatar từ 2 chữ cái đầu của tên
          avatar: c.name
            ? c.name
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase()
            : "U",
          target: c.targetValue != null ? String(c.targetValue) : "",
          actualResult: c.actualResult || "",
          feedbackNote: c.feedbackNote ?? "",
          feedbackTargetRoleCode:
            c.feedbackTargetRoleCode != null &&
            String(c.feedbackTargetRoleCode).trim() !== ""
              ? String(c.feedbackTargetRoleCode).trim().toUpperCase()
              : undefined,
          selfScore: c.selfScore != null ? Number(c.selfScore) : null,
          pmScore: c.pmScore != null ? Number(c.pmScore) : null,
          pmEvaluationComment:
            c.pmEvaluationComment != null &&
            String(c.pmEvaluationComment).trim() !== ""
              ? String(c.pmEvaluationComment).trim()
              : undefined,
          gmEvaluationComment:
            c.gmEvaluationComment != null &&
            String(c.gmEvaluationComment).trim() !== ""
              ? String(c.gmEvaluationComment).trim()
              : undefined,
          statusCode: c.statusCode,
          updateReason:
            c.updateReason != null && String(c.updateReason).trim() !== ""
              ? String(c.updateReason).trim()
              : undefined,
          status: statusMap[c.statusCode] || "pending_approval",
          weight: kpi.weight,
        })),
      };
    });

    kpiCycleInfo.value = data.kpiCycle;
    if (props.portfolioScope === "promotion") {
      pmComments.value.selfComment = String(
        data.evaluationCommentsPromotion ?? "",
      );
      pmComments.value.supervisorComment = String(
        data.evaluationSupervisorCommentsPromotion ?? "",
      );
    } else {
      pmComments.value.selfComment = String(
        data.evaluationCommentsPortfolio ?? "",
      );
      pmComments.value.supervisorComment = String(
        data.evaluationSupervisorComments ?? "",
      );
    }
    if (props.portfolioScope === "portfolio") {
      portfolioDataLoaded.value = true;
      syncPmCreateKpiGateForLayout();
    }
  } catch (err) {
    console.error("Failed to load PM portfolio", err);
    if (props.portfolioScope === "portfolio") {
      portfolioDataLoaded.value = true;
      syncPmCreateKpiGateForLayout();
    }
  }
}

function statusNumber(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function pmPortfolioStatusForButton(rows: any[]): number {
  const statuses = rows
    .map((row) => statusNumber(row?.statusCode))
    .filter((status): status is number => status != null);

  if (statuses.length === 0) return KPI_STATUS.COMPLETED;
  if (
    statuses.includes(KPI_STATUS.PENDING_ACCEPTANCE) ||
    statuses.includes(KPI_STATUS.REJECTED)
  )
    return KPI_STATUS.PENDING_ACCEPTANCE;
  if (statuses.includes(KPI_STATUS.ACCEPTED)) return KPI_STATUS.ACCEPTED;
  if (statuses.includes(KPI_STATUS.SECOND_WAITING_GM_APPROVAL))
    return KPI_STATUS.SECOND_WAITING_GM_APPROVAL;
  if (statuses.includes(KPI_STATUS.SECOND_WAITING_PM_APPROVAL))
    return KPI_STATUS.SECOND_WAITING_PM_APPROVAL;
  if (statuses.includes(KPI_STATUS.FIRST_WAITING_GM_APPROVAL))
    return KPI_STATUS.FIRST_WAITING_GM_APPROVAL;
  if (statuses.includes(KPI_STATUS.FIRST_WAITING_PM_APPROVAL))
    return KPI_STATUS.FIRST_WAITING_PM_APPROVAL;
  if (statuses.includes(KPI_STATUS.FIRST_COMPLETED))
    return KPI_STATUS.FIRST_COMPLETED;
  if (statuses.includes(KPI_STATUS.COMPLETED)) return KPI_STATUS.COMPLETED;
  return statuses[0] ?? KPI_STATUS.INACTIVE;
}

const currentStatusCode = computed(() =>
  pmPortfolioStatusForButton(scopedPersonalKpisRaw.value),
);

type SendReviewActionType = "MID_YEAR" | "END_YEAR";

function memberTeamReviewBlockedReason(
  actionType: SendReviewActionType,
): string | null {
  const allowed = new Set<number>(
    actionType === "MID_YEAR"
      ? [
          KPI_STATUS.FIRST_WAITING_GM_APPROVAL,
          KPI_STATUS.FIRST_COMPLETED,
          KPI_STATUS.SECOND_WAITING_GM_APPROVAL,
          KPI_STATUS.COMPLETED,
        ]
      : [KPI_STATUS.SECOND_WAITING_GM_APPROVAL, KPI_STATUS.COMPLETED],
  );

  for (const item of scopedPersonalKpisRaw.value) {
    if (!isTeamTreeKpi(item)) continue;
    const children = Array.isArray(item.children) ? item.children : [];
    const memberChildren = children.filter(
      (child: any) => !isChildOwnedByCurrentPm(child),
    );
    if (
      memberChildren.some(
        (child: any) => !allowed.has(Number(child?.statusCode)),
      )
    ) {
      return actionType === "MID_YEAR"
        ? "Submit all member Team KPIs to GM for mid-year approval first (status 502)."
        : "Submit all member Team KPIs to GM for year-end approval first (status 602).";
    }
  }

  return null;
}

const buttonState = computed(() => {
  if (!kpiCycleInfo.value) {
    return {
      show: false,
      disabled: true,
      text: "",
      actionType: "COMPLETED" as const,
    };
  }

  const base = getPmPortfolioSubmitButtonState(
    kpiCycleInfo.value,
    Number(currentStatusCode.value),
  );
  if (props.readonlyYear) {
    return {
      ...base,
      disabled: true,
      reason: "Year is locked; data is read-only.",
    };
  }
  if (
    base.actionType === "GOAL_SETTING" &&
    Number(currentStatusCode.value) === KPI_STATUS.PENDING_ACCEPTANCE &&
    base.show
  ) {
    const blockReason = pmPortfolioAcceptKpiBlockedReason(
      scopedPersonalKpisRaw.value,
    );
    if (blockReason) {
      return { ...base, disabled: true, reason: blockReason };
    }
  }
  if (
    base.show &&
    !base.disabled &&
    (base.actionType === "MID_YEAR" || base.actionType === "END_YEAR")
  ) {
    const blockReason = memberTeamReviewBlockedReason(base.actionType);
    if (blockReason) {
      return { ...base, disabled: true, reason: blockReason };
    }
  }
  return base;
});

onMounted(() => {
  loadPmPortfolio(selectedYearParam());
});

watch(
  () => props.year,
  () => {
    void loadPmPortfolio(selectedYearParam());
  },
);

const scopedPersonalKpisRaw = computed(() => {
  const rows = personalKpisRaw.value;
  if (props.portfolioScope === "promotion") {
    return rows.filter((kpi) => kpi.kpiType === "promotion");
  }
  if (props.portfolioScope === "department") {
    return groupDepartmentPortfolioByKpi(rows);
  }
  return rows.filter((kpi) => kpi.kpiType !== "promotion");
});

/** Báo PmLayout sau khi portfolio Personal load / đổi dữ liệu cục bộ. */
watch(scopedPersonalKpisRaw, () => {
  if (!portfolioDataLoaded.value || props.portfolioScope !== "portfolio") return;
  syncPmCreateKpiGateForLayout();
});

const hasPortfolioKpiRows = computed(
  () => scopedPersonalKpisRaw.value.length > 0,
);

const pendingFeedbackKpiCount = computed(() => {
  return scopedPersonalKpisRaw.value.filter(
    (kpi) =>
      Array.isArray(kpi.children) &&
      kpi.children.some((child: any) => isMemberFeedbackPendingForPm(child)),
  ).length;
});

watch(
  [pendingFeedbackKpiCount, () => props.portfolioScope],
  ([count, scope]) => {
    if (scope !== "portfolio" && scope !== "promotion") return;
    emit("feedback-pending-count", { scope, count });
  },
  { immediate: true },
);

/** Chỉ tab KPI Department hiển thị heading trong component; Personal/Promotion dùng title cố định ở PmDashboard. */
const showSectionHeading = computed(
  () => props.portfolioScope === "department",
);

const employeeCommentAnchorId = computed(() => {
  if (props.portfolioScope === "promotion") return "pm-promotion-my-comment";
  if (props.portfolioScope === "department") return "pm-department-my-comment";
  return "pm-portfolio-my-comment";
});

function compareKpiNameEn(a: any, b: any): number {
  return String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "en", {
    sensitivity: "base",
    numeric: true,
  });
}

/** Tab KPI Department: isImportant trước, sau đó tên KPI (en). */
function comparePmDepartmentKpi(a: any, b: any): number {
  const pa = a?.isImportant === true ? 1 : 0;
  const pb = b?.isImportant === true ? 1 : 0;
  const byPriority = pb - pa;
  if (byPriority !== 0) return byPriority;
  return compareKpiNameEn(a, b);
}

/** Tab KPI Department: gom nhiều assignment (mỗi member một dòng BE) thành một KPI + member con. */
function departmentMemberRowToChild(row: any): any {
  const name = String(row.userName ?? row.name ?? "").trim() || "Member";
  return {
    id: String(row.id),
    userId: row.userId != null ? String(row.userId) : undefined,
    name,
    role: String(row.userRole ?? "").trim() || "Member",
    avatar:
      row.userAvatar ??
      (name
        ? name
            .split(" ")
            .map((n: string) => n[0])
            .join("")
            .substring(0, 2)
            .toUpperCase()
        : "U"),
    target: row.target != null ? String(row.target) : "",
    weight: row.weight,
    actualResult: row.actualResult ?? "",
    feedbackNote: row.feedbackNote ?? "",
    feedbackTargetRoleCode: row.feedbackTargetRoleCode,
    selfScore: row.selfScore != null ? Number(row.selfScore) : null,
    pmScore: row.pmScore != null ? Number(row.pmScore) : null,
    gmEvaluationComment: row.gmEvaluationComment,
    statusCode: row.statusCode,
    updateReason: row.updateReason,
    status: row.status,
  };
}

function groupDepartmentPortfolioByKpi(rows: any[]): any[] {
  const buckets = new Map<string, any[]>();
  for (const row of rows) {
    const infoKey = String(row.infoId ?? row.id ?? "").trim();
    if (!infoKey) continue;
    if (!buckets.has(infoKey)) buckets.set(infoKey, []);
    buckets.get(infoKey)!.push(row);
  }

  const grouped: any[] = [];
  for (const memberRows of buckets.values()) {
    memberRows.sort((a, b) =>
      String(a.userName ?? "").localeCompare(String(b.userName ?? ""), "en", {
        sensitivity: "base",
      }),
    );
    const base = memberRows[0];
    const infoParentId = `info-${String(base.infoId ?? base.id)}`;

    const childByKey = new Map<string, any>();
    for (const row of memberRows) {
      const memberChild = departmentMemberRowToChild(row);
      const memberKey =
        String(memberChild.userId ?? "").trim() || String(memberChild.id);
      childByKey.set(memberKey, memberChild);

      for (const c of row.children ?? []) {
        const cascadeChild = {
          ...c,
          id: String(c.id),
          userId: c.userId != null ? String(c.userId) : undefined,
          weight: c.weight ?? row.weight ?? base.weight,
        };
        const cascadeKey =
          String(cascadeChild.userId ?? "").trim() || String(cascadeChild.id);
        if (!childByKey.has(cascadeKey)) {
          childByKey.set(cascadeKey, cascadeChild);
        }
      }
    }

    const children = [...childByKey.values()].sort((a, b) =>
      String(a.name ?? "").localeCompare(String(b.name ?? ""), "en", {
        sensitivity: "base",
      }),
    );

    const rolledStatusCode = pmDepartmentParentRollupStatusCode({
      children,
    });

    grouped.push({
      ...base,
      id: infoParentId,
      isTree: children.length > 0,
      expanded: readKpiExpandedState(infoParentId),
      userName: undefined,
      userId: undefined,
      userRole: undefined,
      userAvatar: undefined,
      actualResult: "",
      selfScore: null,
      pmScore: null,
      statusCode: rolledStatusCode ?? undefined,
      children,
    });
  }

  return grouped.sort(comparePmDepartmentKpi);
}

const groupedPersonalKpis = computed(() => {
  // Tự động gom nhóm dựa trên key "group" (vd: "A - Hiệu quả công việc...")
  const groups = scopedPersonalKpisRaw.value.reduce((acc: any, item: any) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  // Sắp xếp tự động để A nằm trước B, B nằm trước C
  return Object.keys(groups)
    .sort()
    .map((key) => ({
      key,
      label: key, // Dùng luôn tên làm label
      items: [...(groups[key] || [])].sort(
        props.portfolioScope === "department"
          ? comparePmDepartmentKpi
          : compareKpiNameEn,
      ),
    }));
});

function visibleChildrenForItem(item: any): any[] {
  return Array.isArray(item?.children) ? item.children : [];
}

function shouldShowNoAssignmentRow(item: any): boolean {
  if (!isTeamTreeKpi(item) || !item?.expanded) return false;
  const all = Array.isArray(item.children) ? item.children : [];
  return all.length === 0;
}

/** Tổng trọng số (%) của các KPI cha đang hiển thị (đã áp dụng bộ lọc); không cộng dòng con. */
const totalPortfolioWeight = computed(() => {
  let sum = 0;
  for (const g of groupedPersonalKpis.value) {
    for (const item of g.items) {
      const w = item.weight;
      if (w == null || w === "") continue;
      const n = typeof w === "number" ? w : Number(w);
      if (Number.isFinite(n)) sum += n;
    }
  }
  return sum;
});

const totalPortfolioWeightDisplay = computed(() => {
  const s = totalPortfolioWeight.value;
  if (!Number.isFinite(s) || s === 0) return "0";
  return Number.isInteger(s) ? String(s) : s.toFixed(1).replace(/\.?0+$/, "");
});

function formatWeightedTotalDisplay(sum: number): string {
  return formatScoreDisplay(sum);
}

function formatPmScoreCellValue(score: unknown): string {
  if (score == null || score === "") return "-";
  const n = typeof score === "number" ? score : Number(score);
  if (!Number.isFinite(n)) return "-";
  return formatScoreDisplay(n);
}

/**
 * Accept KPI (404→403): mọi KPI cha trong danh sách phải đúng 404;
 * sau đó mới kiểm tra rule phân bổ Team (member ≥405, …).
 */
function pmPortfolioAcceptKpiBlockedReason(rows: any[]): string | null {
  if (rows.length === 0) return null;
  const notPendingAcceptance = rows.filter(
    (item) => Number(item?.statusCode) !== KPI_STATUS.PENDING_ACCEPTANCE,
  );
  if (notPendingAcceptance.length > 0) {
    if (
      notPendingAcceptance.some(
        (item) =>
          Number(item?.statusCode) === KPI_STATUS.FEEDBACK_IN_PROGRESS,
      )
    ) {
      return "Complete or resolve KPI feedback before accepting.";
    }
    return "All KPIs must be Pending Acceptance (404) before you can Accept KPI.";
  }
  return pmTeamAcceptKpiBlockedReason(rows);
}

/**
 * KPI Team: phải có ít nhất một assignment con;
 * mọi thành viên được phân bổ (không tính dòng «dư target» của chính PM) phải ≥405.
 */
function pmTeamAcceptKpiBlockedReason(rows: any[]): string | null {
  const pmUid = currentPmUserId.value.trim();
  for (const item of rows) {
    if (!isTeamTreeKpi(item)) continue;
    const children = Array.isArray(item.children) ? item.children : [];
    if (children.length === 0) {
      return "Allocate the Team KPI to at least one member before accepting it.";
    }
    const others = pmUid
      ? children.filter((c: any) => String(c?.userId ?? "").trim() !== pmUid)
      : children;
    if (others.length === 0) continue;
    if (
      others.some((c: any) => {
        const sc = Number(c?.statusCode);
        if (!Number.isFinite(sc)) return true;
        return (
          sc === KPI_STATUS.FEEDBACK_IN_PROGRESS ||
          isPmPendingAcceptanceLikeStatus(sc) ||
          sc < KPI_STATUS.ACCEPTED
        );
      })
    ) {
      return "Wait for all assigned members to confirm the KPI first.";
    }
  }
  return null;
}

function averageOfNumericList(values: unknown[]): number | null {
  const nums: number[] = [];
  for (const v of values) {
    if (v == null || v === "") continue;
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) nums.push(n);
  }
  if (nums.length === 0) return null;
  let s = 0;
  for (const n of nums) s += n;
  return s / nums.length;
}

/**
 * Self score dùng cho dòng KPI cha và tổng có trọng số: KPI Team = trung bình self
 * do từng thành viên gửi; KPI khác dùng self trên assignment cha.
 */
function effectiveSelfScoreForParent(item: any): number | null {
  if (
    (isTeamTreeKpi(item) || props.portfolioScope === "department") &&
    Array.isArray(item.children) &&
    item.children.length > 0
  ) {
    return averageOfNumericList(item.children.map((c: any) => c.selfScore));
  }
  const raw = item.selfScore;
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

function formatSelfScoreCell(item: any): string {
  const v = effectiveSelfScoreForParent(item);
  if (v == null) return "-";
  return formatWeightedTotalDisplay(v);
}

/** Final score (Supervisor) dòng KPI cha: trung bình điểm các node con (Team / Department). */
function effectivePmScoreForParent(item: any): number | null {
  if (
    (isTeamTreeKpi(item) || props.portfolioScope === "department") &&
    Array.isArray(item.children) &&
    item.children.length > 0
  ) {
    return averageOfNumericList(item.children.map((c: any) => c.pmScore));
  }
  const raw = item.pmScore;
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Final Score — dùng chung tab KPI Personal (`portfolio`) và KPI Promotion (`promotion`). */
function formatPmScoreCell(item: any): string {
  return formatPmScoreCellValue(effectivePmScoreForParent(item));
}

function scoreColorClass(score: unknown): string {
  if (score == null || score === "") return "text-slate-500";
  const n = typeof score === "number" ? score : Number(score);
  if (!Number.isFinite(n)) return "text-slate-500";
  if (n < 3) return "text-rose-600";
  if (n < 4) return "text-amber-500";
  return "text-emerald-600";
}

function collectPortfolioParentRows(): any[] {
  const rows: any[] = [];
  for (const g of groupedPersonalKpis.value) {
    for (const item of g.items) rows.push(item);
  }
  return rows;
}

/** Một vòng lặp: tổng (điểm × trọng số) Self / Supervisor và số dòng góp phần. */
const portfolioWeightedTotals = computed(() => {
  const rows = collectPortfolioParentRows();
  let selfSum = 0;
  let pmSum = 0;
  let selfContributed = 0;
  let pmContributed = 0;
  for (const item of rows) {
    const rawW = item.weight;
    if (rawW === null || rawW === undefined || rawW === "") continue;
    const weightNum = typeof rawW === "number" ? rawW : Number(rawW);
    if (!Number.isFinite(weightNum)) continue;

    const selfNum = effectiveSelfScoreForParent(item);
    if (selfNum != null && Number.isFinite(selfNum)) {
      selfSum += selfNum * weightNum;
      selfContributed += 1;
    }
    const pmNum = effectivePmScoreForParent(item);
    if (pmNum != null && Number.isFinite(pmNum)) {
      pmSum += pmNum * weightNum;
      pmContributed += 1;
    }
  }
  return { selfSum, pmSum, selfContributed, pmContributed };
});

/**
 * Tổng Σ(selfScore × weight) trên các KPI cha đang hiển thị (cùng bộ lọc).
 * Chỉ cộng dòng đã có đủ self score và trọng số; dòng chưa nhập bỏ qua.
 * Không có dòng nào đủ dữ liệu → "-".
 */
const totalWeightedSelfScoreDisplay = computed((): string => {
  const { selfSum, selfContributed } = portfolioWeightedTotals.value;
  if (selfContributed === 0 || !Number.isFinite(selfSum)) return "-";
  return formatWeightedTotalDisplay(selfSum);
});

/**
 * Tổng Σ(Supervisor score × weight) — cùng logic với Self, dùng {@code pmScore} trên dòng cha.
 */
const totalWeightedPmScoreDisplay = computed((): string => {
  const { pmSum, pmContributed } = portfolioWeightedTotals.value;
  if (pmContributed === 0 || !Number.isFinite(pmSum)) return "-";
  return formatWeightedTotalDisplay(pmSum);
});

/** Điểm trung bình Self = (tổng cột Self total) / (tổng trọng số cột Weight). */
const averageSelfScoreDisplay = computed((): string => {
  const tw = totalPortfolioWeight.value;
  const { selfSum, selfContributed } = portfolioWeightedTotals.value;
  if (
    !Number.isFinite(tw) ||
    tw <= 0 ||
    selfContributed === 0 ||
    !Number.isFinite(selfSum)
  )
    return "-";
  return formatWeightedTotalDisplay(selfSum / tw);
});

/** Điểm trung bình Supervisor = (tổng cột Supervisor total) / (tổng trọng số cột Weight). */
const averagePmScoreDisplay = computed((): string => {
  const tw = totalPortfolioWeight.value;
  const { pmSum, pmContributed } = portfolioWeightedTotals.value;
  if (
    !Number.isFinite(tw) ||
    tw <= 0 ||
    pmContributed === 0 ||
    !Number.isFinite(pmSum)
  )
    return "-";
  return formatWeightedTotalDisplay(pmSum / tw);
});

const pmComments = ref({ selfComment: "", supervisorComment: "" });
const statusUpdateSubmitting = ref(false);
const unlockSubmitting = ref(false);
const unlockConfirmModalOpen = ref(false);
const UNLOCK_FROM_GM_WAITING_STATUSES = [
  KPI_STATUS.WAITING_GM_APPROVAL,
  KPI_STATUS.FIRST_WAITING_PM_APPROVAL,
  KPI_STATUS.FIRST_WAITING_GM_APPROVAL,
  KPI_STATUS.SECOND_WAITING_PM_APPROVAL,
  KPI_STATUS.SECOND_WAITING_GM_APPROVAL,
] as const;
const pmSelfCommentReadonly = computed(() => {
  if (
    statusUpdateSubmitting.value ||
    !buttonState.value.show ||
    buttonState.value.disabled
  )
    return true;
  return !(
    buttonState.value.actionType === "MID_YEAR" ||
    buttonState.value.actionType === "END_YEAR"
  );
});
const canUnlockKpi = computed(() => {
  if (!kpiCycleInfo.value) return false;
  const rows = scopedPersonalKpisRaw.value;
  if (!rows.length) return false;
  return rows.some((item) =>
    UNLOCK_FROM_GM_WAITING_STATUSES.includes(Number(item?.statusCode) as any),
  );
});
const evidencePanelOpen = ref(false);
const evidenceDrawerViewOnly = ref(false);
const selectedKpiItem = ref<any>(null);
const feedbackDrawerOpen = ref(false);
const feedbackDrawerAssignment = ref<any | null>(null);
const feedbackDraftText = ref("");
const showAssigneeTargetScaleModal = ref(false);
const assigneeTargetScaleItem = ref<PmAssigneeTargetScaleEditItem | null>(null);

const openEvidenceDrawer = (
  item: any,
  options?: { viewOnly?: boolean },
) => {
  evidenceDrawerViewOnly.value = Boolean(options?.viewOnly);
  selectedKpiItem.value = item;
  evidencePanelOpen.value = true;
};

const openDepartmentEvidenceDrawer = (item: any) => {
  openEvidenceDrawer(
    {
      ...item,
      name: item.userName ? `${item.name} · ${item.userName}` : item.name,
    },
    { viewOnly: true },
  );
};

function isPmEvidenceReadonly(item: any): boolean {
  const sc = Number(item?.statusCode);
  return (
    sc === KPI_STATUS.FIRST_WAITING_GM_APPROVAL ||
    sc === KPI_STATUS.SECOND_WAITING_GM_APPROVAL ||
    sc === KPI_STATUS.COMPLETED
  );
}

function isChildOwnedByCurrentPm(child: any): boolean {
  const uid = String(child?.userId ?? "").trim();
  return uid !== "" && uid === currentPmUserId.value;
}

function isMemberFeedbackPendingForPm(child: any): boolean {
  const role = String(child?.feedbackTargetRoleCode ?? "")
    .trim()
    .toUpperCase();
  return (
    !isChildOwnedByCurrentPm(child) &&
    Number(child?.statusCode) === KPI_STATUS.FEEDBACK_IN_PROGRESS &&
    String(child?.id ?? "").trim() !== "" &&
    role === "PM"
  );
}

function hasMemberSubmittedActualForPmReview(child: any): boolean {
  if (isChildOwnedByCurrentPm(child)) return false;
  const sc = Number(child?.statusCode);
  return Number.isFinite(sc) && sc >= KPI_STATUS.FIRST_WAITING_PM_APPROVAL;
}

const memberFeedbackReviewDrawerOpen = ref(false);
const memberFeedbackReviewTarget = ref<any | null>(null);
function openMemberFeedbackReviewDrawer(child: any, parent: any) {
  const assignmentId = String(child?.id ?? "").trim();
  if (!assignmentId) return;
  memberFeedbackReviewTarget.value = {
    assignmentId,
    parentItem: parent,
    memberName: String(child?.name ?? "").trim() || "Member",
    role: String(child?.role ?? "").trim() || "Member",
    note: String(child?.feedbackNote ?? "").trim() || "No feedback content.",
    parentName: String(parent?.name ?? "").trim() || "KPI",
    parentTarget: parent?.target,
    parentUnitCode: parent?.unitCode,
    parentWeight: parent?.weight,
    parentKpiType: parent?.kpiType,
  };
  memberFeedbackReviewDrawerOpen.value = true;
}

/** KPI Team: chấp nhận → drawer phân bổ + accept-with-cascade. Không phải Team: duyệt/từ chối ngay (407→404). */
function acceptMemberFeedbackFromDrawer() {
  if (props.readonlyYear) return;
  const target = memberFeedbackReviewTarget.value;
  const assignmentId = String(target?.assignmentId ?? "").trim();
  const parent = target?.parentItem;
  if (!assignmentId || !target || !parent) return;
  if (!isTeamTreeKpi(parent)) {
    void decideMemberFeedbackFromDrawer(true);
    return;
  }
  emit("open-assign-after-member-feedback", {
    parentKpi: parent,
    feedbackAssignmentId: assignmentId,
  });
  closeMemberFeedbackReviewDrawer();
}

function closeMemberFeedbackReviewDrawer() {
  memberFeedbackReviewDrawerOpen.value = false;
  memberFeedbackReviewTarget.value = null;
}

function isDecidingMemberFeedback(assignmentId: unknown): boolean {
  return decidingMemberFeedbackIds.value.has(String(assignmentId ?? "").trim());
}

async function decideMemberFeedbackFromDrawer(approve: boolean) {
  if (props.readonlyYear) return;
  const target = memberFeedbackReviewTarget.value;
  const assignmentId = String(target?.assignmentId ?? "").trim();
  if (!assignmentId || isDecidingMemberFeedback(assignmentId)) return;
  const year = Number(currentPortfolioYearParam());
  if (!Number.isFinite(year)) {
    toast.error("Could not determine the cycle year to process feedback.");
    return;
  }
  decidingMemberFeedbackIds.value = new Set(
    decidingMemberFeedbackIds.value,
  ).add(assignmentId);
  try {
    await pmKpiService.decideMemberFeedback({
      year,
      assignmentId,
      approve,
    });
    toast.success(
      approve ? "Member feedback approved." : "Member feedback rejected.",
    );
    closeMemberFeedbackReviewDrawer();
    await loadPmPortfolio(currentPortfolioYearParam());
    emit("timeline-refresh");
  } catch (err: unknown) {
    toast.error(sheetUpdateErrorMessage(err));
  } finally {
    const next = new Set(decidingMemberFeedbackIds.value);
    next.delete(assignmentId);
    decidingMemberFeedbackIds.value = next;
  }
}

/** Drawer kết quả member — `viewOnly` khi PM chỉ xem submission (không sửa). Form theo CALC_RULE cha. */
function pmChildActualCell(child: any, parent: any): string {
  const formatted =
    formatPmActualCellWithUnit(
      formatPmPortfolioActualCell(
        child?.actualResult,
        parent?.calculationTypeCode,
        pmPortfolioActualDisplayMode(parent?.calculationRuleCode),
        { actualOnly: true },
      ),
      parent?.unitCode,
    ) || "-";
  return supervisorMemberActualDisplay(formatted, child?.statusCode, "pm");
}

function openChildEvidenceDrawer(
  child: any,
  parent: any,
  viewOnly = false,
) {
  const pmCanView = canSupervisorViewMemberSelfEvaluation(child?.statusCode, "pm");
  openEvidenceDrawer(
    {
      id: child?.id != null ? String(child.id) : undefined,
      name: `${String(child?.name ?? "Member")} · ${String(parent?.name ?? "KPI")}`,
      target: child?.target ?? "-",
      actualResult: pmCanView ? child?.actualResult ?? "" : "",
      selfScore: pmCanView ? child?.selfScore ?? null : null,
      statusCode: child?.statusCode,
      pmScore: child?.pmScore ?? null,
      pmEvaluationComment: child?.pmEvaluationComment,
      gmEvaluationComment: child?.gmEvaluationComment,
      calculationRuleCode: parent?.calculationRuleCode,
      calculationTypeCode: parent?.calculationTypeCode,
      targetDescription: parent?.targetDescription ?? "",
      unitCode: parent?.unitCode,
      weight: parent?.weight,
    },
    { viewOnly },
  );
}

function currentPortfolioYearParam(): string {
  const y = Number(kpiCycleInfo.value?.year);
  if (Number.isFinite(y) && y > 0) return String(y);
  return selectedYearParam();
}

function openFeedbackDrawer(item: any) {
  if (props.readonlyYear || Boolean(item?.isSelfCreated)) return;
  feedbackDrawerAssignment.value = item;
  feedbackDraftText.value = isPmGmFeedbackPending(item)
    ? String(item?.feedbackNote ?? "").trim()
    : "";
  feedbackDrawerOpen.value = true;
}

function closeFeedbackDrawer() {
  feedbackDrawerOpen.value = false;
  feedbackDrawerAssignment.value = null;
  feedbackDraftText.value = "";
}

async function sendFeedbackToGmForAssignment(item: any) {
  if (props.readonlyYear || Boolean(item?.isSelfCreated)) return;
  const assignmentId = String(item?.id ?? "").trim();
  if (!assignmentId) return;
  if (!isPmPendingAcceptanceLikeStatus(item?.statusCode)) {
    toast.info(
      "Feedback can only be sent when the KPI is pending acceptance.",
    );
    return;
  }
  const feedbackNote = feedbackDraftText.value.trim();
  if (!feedbackNote) {
    toast.error("Enter feedback content.");
    return;
  }
  if (isSendingPmFeedback(assignmentId)) return;

  const year = Number(currentPortfolioYearParam());
  if (!Number.isFinite(year)) {
    toast.error("Could not determine the cycle year to send feedback.");
    return;
  }

  sendingPmFeedbackIds.value = new Set(sendingPmFeedbackIds.value).add(
    assignmentId,
  );
  try {
    await pmKpiService.submitFeedbackToGm({
      year,
      assignmentId,
      feedbackNote,
    });
    feedbackDraftText.value = "";
    toast.success("Feedback sent to GM.");
    closeFeedbackDrawer();
    await loadPmPortfolio(currentPortfolioYearParam());
    emit("timeline-refresh");
  } catch (err: unknown) {
    toast.error(sheetUpdateErrorMessage(err));
  } finally {
    const next = new Set(sendingPmFeedbackIds.value);
    next.delete(assignmentId);
    sendingPmFeedbackIds.value = next;
  }
}

function isPmFeedbackDrawerReadonly(): boolean {
  return (
    Number(feedbackDrawerAssignment.value?.statusCode) ===
    KPI_STATUS.FEEDBACK_IN_PROGRESS
  );
}

watch(
  [feedbackDrawerOpen, memberFeedbackReviewDrawerOpen],
  ([gmDrawerOpen, memberDrawerOpen]) => {
    document.body.style.overflow =
      gmDrawerOpen || memberDrawerOpen ? "hidden" : "";
  },
);

function isRemovingChildAssignment(assignmentId: string): boolean {
  return removingChildAssignmentIds.value.has(String(assignmentId));
}

const removeTeamMemberModalOpen = ref(false);
const removeTeamMemberTarget = ref<{ parent: any; child: any } | null>(null);

function promptRemoveTeamMemberFromKpi(parent: any, child: any) {
  if (props.readonlyYear) return;
  if (!parent?.id || !parent?.infoId || !kpiCycleInfo.value?.id) {
    toast.error("Missing KPI data to delete allocation.");
    return;
  }
  if (!child?.id || !child?.userId) {
    toast.error("Could not determine which member to delete.");
    return;
  }
  removeTeamMemberTarget.value = { parent, child };
  removeTeamMemberModalOpen.value = true;
}

function closeRemoveTeamMemberModal() {
  removeTeamMemberModalOpen.value = false;
  removeTeamMemberTarget.value = null;
}

async function confirmRemoveTeamMemberFromKpi() {
  const target = removeTeamMemberTarget.value;
  if (!target) return;
  const { parent, child } = target;
  if (props.readonlyYear) return;
  if (!parent?.id || !parent?.infoId || !kpiCycleInfo.value?.id) {
    toast.error("Missing KPI data to delete allocation.");
    closeRemoveTeamMemberModal();
    return;
  }
  if (!child?.id || !child?.userId) {
    toast.error("Could not determine which member to delete.");
    closeRemoveTeamMemberModal();
    return;
  }

  const rid = String(child.id);
  removingChildAssignmentIds.value = new Set(
    removingChildAssignmentIds.value,
  ).add(rid);
  closeRemoveTeamMemberModal();
  try {
    const memberTargets: Record<string, number> = {};
    for (const c of parent.children ?? []) {
      if (String(c?.id ?? "") === rid) continue;
      const uid = String(c?.userId ?? "").trim();
      if (!uid) continue;
      memberTargets[uid] = parseTargetNumber(c?.target);
    }

    await pmKpiService.cascadeKpi({
      kpiInformationId: parent.infoId,
      cycleId: kpiCycleInfo.value.id,
      parentAssignmentId: parent.id,
      memberTargets,
    });
    toast.success("Member allocation deleted.");
    await loadPmPortfolio(currentPortfolioYearParam());
    emit("timeline-refresh");
  } catch (err) {
    console.error("Failed to remove assigned member from team KPI", err);
    toast.error("Could not delete allocation. Please try again.");
  } finally {
    const next = new Set(removingChildAssignmentIds.value);
    next.delete(rid);
    removingChildAssignmentIds.value = next;
  }
}

const deletingSelfCreatedKpiIds = ref<Set<string>>(new Set());

const deleteConfirmModalOpen = ref(false);
const deleteConfirmItem = ref<any>(null);

function promptDeleteSelfCreatedPmKpi(item: any) {
  if (props.readonlyYear) return;
  deleteConfirmItem.value = item;
  deleteConfirmModalOpen.value = true;
}

function closeDeleteConfirmModal() {
  deleteConfirmModalOpen.value = false;
  deleteConfirmItem.value = null;
}

async function executeDeleteSelfCreatedPmKpi() {
  if (props.readonlyYear) return;
  const item = deleteConfirmItem.value;
  if (!item?.id) return;

  const assignmentId = String(item.id);
  deletingSelfCreatedKpiIds.value = new Set(
    deletingSelfCreatedKpiIds.value,
  ).add(assignmentId);

  try {
    closeDeleteConfirmModal();
    // Calling the new backend endpoint
    await pmKpiService.deleteSelfCreatedPmKpi(assignmentId);
    toast.success("KPI deleted successfully.");
    await loadPmPortfolio(currentPortfolioYearParam());
    emit("timeline-refresh");
  } catch (err: unknown) {
    toast.error(sheetUpdateErrorMessage(err));
  } finally {
    const next = new Set(deletingSelfCreatedKpiIds.value);
    next.delete(assignmentId);
    deletingSelfCreatedKpiIds.value = next;
  }
}

function sheetUpdateErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const ax = err as { response?: { data?: { message?: string | null } } };
    const m = ax.response?.data?.message;
    if (m != null && String(m).trim() !== "") return String(m);
  }
  if (err instanceof Error) return err.message;
  return "Could not save - please try again";
}

/**
 * Lưu self score + evidences vào DB qua API member (PM có quyền PUT /kpi/member/sheet/:assignmentId cho assignment của chính PM).
 */
async function saveEvidenceData(data: {
  id?: string;
  actualResult: string;
  selfScore: number | null;
  storedFiles?: { id: string; url: string; name?: string }[];
  urls?: { id: string; url: string; name?: string }[];
  openedEvidencesJson?: string;
}) {
  if (props.readonlyYear) {
    toast.warning("Year is locked; data is read-only.");
    return;
  }
  if (isPmEvidenceReadonly(selectedKpiItem.value)) {
    toast.warning(
      "KPI has been submitted for approval; information is read-only.",
    );
    return;
  }
  const assignmentId = data.id;
  if (!assignmentId) {
    evidencePanelOpen.value = false;
    return;
  }

  const body: UpdateMemberSheetItemBody = {};
  if (data.selfScore != null) {
    const n =
      typeof data.selfScore === "number"
        ? data.selfScore
        : Number(data.selfScore);
    if (Number.isFinite(n)) body.selfScore = Math.round(n);
  }

  let evJson: Record<string, unknown> = {};
  if (
    typeof data.actualResult === "string" &&
    data.actualResult.trim() !== ""
  ) {
    try {
      evJson = JSON.parse(data.actualResult) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }

  const filePairs: { url: string; name?: string }[] = (
    data.storedFiles ?? []
  ).map((u) => ({
    url: u.url,
    name: u.name,
  }));
  const urlPairs = (data.urls ?? []).map((u) => ({ url: u.url, name: u.name }));
  appendEvidenceFilesUrlsToPayload(evJson, filePairs, urlPairs);

  const finalActualResult =
    Object.keys(evJson).length > 0 ? JSON.stringify(evJson) : "";
  if (finalActualResult !== "") body.evidences = finalActualResult;

  const prevJson =
    data.openedEvidencesJson ??
    selectedKpiItem.value?.evidencesJson ??
    selectedKpiItem.value?.evidences ??
    selectedKpiItem.value?.actualResult ??
    "";

  try {
    await memberKpiService.updateSheetItem(assignmentId, body);
    if (finalActualResult !== "") {
      try {
        await purgeRemovedUploadedEvidenceFiles(String(prevJson), evJson);
      } catch (error) {
        console.error(
          "Failed to purge removed evidence files from disk",
          error,
        );
      }
    }
    toast.success("Evidence and self score saved.");
    evidencePanelOpen.value = false;
    await loadPmPortfolio(currentPortfolioYearParam());
  } catch (err: unknown) {
    toast.error(sheetUpdateErrorMessage(err));
  }
}

/** Self score hợp lệ cho gửi Send Review (1–5). */
function isValidSelfScore(v: unknown): boolean {
  if (v == null || v === "") return false;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 5;
}

function hasActualResultForSendReview(row: any, parentItem?: any): boolean {
  const calc = parentItem?.calculationTypeCode ?? row?.calculationTypeCode;
  const rule = parentItem?.calculationRuleCode ?? row?.calculationRuleCode;
  const mode = pmPortfolioActualDisplayMode(rule);
  const formatted = formatPmActualCellWithUnit(
    formatPmPortfolioActualCell(row?.actualResult, calc, mode, { actualOnly: true }),
    parentItem?.unitCode ?? row?.unitCode,
  ).trim();
  return formatted !== "";
}

function isPmOwnedTeamChildReadyForSendReview(
  child: any,
  parentItem: any,
): boolean {
  return (
    hasActualResultForSendReview(child, parentItem) &&
    isValidSelfScore(child?.selfScore)
  );
}

/** Validation Send Review: highlight PM-owned KPI rows that are missing self score. */
const sendReviewErrorComment = ref(false);
/** PM-owned KPI parent rows missing self score. */
const sendReviewErrorParentIds = ref<Set<string>>(new Set());

function clearSendReviewFieldHighlights() {
  sendReviewErrorComment.value = false;
  sendReviewErrorParentIds.value = new Set();
}

watch(
  () => pmComments.value.selfComment,
  (v) => {
    if (sendReviewErrorComment.value && String(v ?? "").trim()) {
      sendReviewErrorComment.value = false;
    }
  },
);

function onlyFromStatusForSendReview(): number {
  return Number(currentStatusCode.value) === KPI_STATUS.FIRST_COMPLETED
    ? KPI_STATUS.FIRST_COMPLETED
    : KPI_STATUS.ACCEPTED;
}

/**
 * Send Review (405/503): validate My Comment and PM-owned KPI rows only.
 */
function runSendReviewFieldValidation(): boolean {
  sendReviewErrorComment.value = !pmComments.value.selfComment?.trim();

  const badParents = new Set<string>();
  const onlyFrom = onlyFromStatusForSendReview();

  for (const item of scopedPersonalKpisRaw.value) {
    if (Number(item?.statusCode) !== onlyFrom) continue;
    const pid = String(item.id);
    if (isTeamTreeKpi(item)) {
      const children = Array.isArray(item.children) ? item.children : [];
      const pmOwnedChildren = children.filter((child: any) =>
        isChildOwnedByCurrentPm(child),
      );
      if (
        pmOwnedChildren.some(
          (child: any) => !isPmOwnedTeamChildReadyForSendReview(child, item),
        ) ||
        !isValidSelfScore(effectiveSelfScoreForParent(item))
      ) {
        badParents.add(pid);
      }
      continue;
    }
    if (
      !hasActualResultForSendReview(item) ||
      !isValidSelfScore(effectiveSelfScoreForParent(item))
    ) {
      badParents.add(pid);
    }
  }

  sendReviewErrorParentIds.value = badParents;

  const ok = !sendReviewErrorComment.value && badParents.size === 0;
  if (!ok) {
    scrollToFirstSendReviewFieldError();
  }
  return ok;
}

function scrollToFirstSendReviewFieldError() {
  nextTick(() => {
    if (sendReviewErrorComment.value) {
      document
        .getElementById(employeeCommentAnchorId.value)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const firstParent = [...sendReviewErrorParentIds.value].sort()[0];
    if (firstParent) {
      document
        .getElementById(`pm-kpi-parent-${firstParent}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

const handleSubmitClick = async () => {
  if (props.readonlyYear) return;
  if (
    statusUpdateSubmitting.value ||
    buttonState.value.disabled ||
    !kpiCycleInfo.value?.id
  )
    return;

  if (
    buttonState.value.actionType === "MID_YEAR" ||
    buttonState.value.actionType === "END_YEAR"
  ) {
    if (!runSendReviewFieldValidation()) {
      toast.error("Enter all required information.");
      return;
    }
    clearSendReviewFieldHighlights();
  }

  let nextStatusCode: number;
  let onlyFrom: number;

  if (buttonState.value.actionType === "GOAL_SETTING") {
    nextStatusCode = KPI_STATUS.WAITING_GM_APPROVAL;
    onlyFrom = KPI_STATUS.PENDING_ACCEPTANCE;
  } else if (buttonState.value.actionType === "MID_YEAR") {
    nextStatusCode = KPI_STATUS.FIRST_WAITING_GM_APPROVAL;
    onlyFrom = onlyFromStatusForSendReview();
  } else if (buttonState.value.actionType === "END_YEAR") {
    nextStatusCode = KPI_STATUS.SECOND_WAITING_GM_APPROVAL;
    onlyFrom = onlyFromStatusForSendReview();
  } else {
    return;
  }

  const promotionFlag = props.portfolioScope === "promotion";

  const payload: Record<string, unknown> = {
    cycleId: kpiCycleInfo.value.id,
    statusCode: nextStatusCode,
    promotion: promotionFlag,
    onlyFromStatusCode: onlyFrom,
    includeManagedDepartmentAssignments: true,
  };

  if (
    buttonState.value.actionType === "MID_YEAR" ||
    buttonState.value.actionType === "END_YEAR"
  ) {
    payload.evaluationComments = pmComments.value.selfComment.trim();
  }

  const toastOk =
    buttonState.value.actionType === "GOAL_SETTING"
      ? "KPI submitted to GM for approval."
      : "Evaluation submitted (Send Review).";

  statusUpdateSubmitting.value = true;
  Promise.all([pmKpiService.bulkUpdateKpiStatus(payload)])
    .then(async () => {
      clearSendReviewFieldHighlights();
      toast.success(toastOk);
      await loadPmPortfolio(currentPortfolioYearParam());
      emit("timeline-refresh");
    })
    .catch((err: unknown) => {
      console.error("Failed to update KPI statuses", err);
      toast.error(sheetUpdateErrorMessage(err));
    })
    .finally(() => {
      statusUpdateSubmitting.value = false;
    });
};

function openUnlockConfirmModal() {
  if (props.readonlyYear) return;
  if (
    statusUpdateSubmitting.value ||
    unlockSubmitting.value ||
    !canUnlockKpi.value
  )
    return;
  unlockConfirmModalOpen.value = true;
}

function closeUnlockConfirmModal() {
  if (unlockSubmitting.value) return;
  unlockConfirmModalOpen.value = false;
}

async function confirmUnlockKpi() {
  if (props.readonlyYear) return;
  if (!kpiCycleInfo.value?.id || unlockSubmitting.value) return;
  const rows = scopedPersonalKpisRaw.value;
  const unlockFromStatuses = UNLOCK_FROM_GM_WAITING_STATUSES.filter((status) =>
    rows.some((item) => Number(item?.statusCode) === status),
  );
  if (unlockFromStatuses.length === 0) {
    unlockConfirmModalOpen.value = false;
    toast.info("No KPIs are pending GM approval to unlock.");
    return;
  }
  unlockSubmitting.value = true;
  try {
    for (const status of unlockFromStatuses) {
      await pmKpiService.bulkUpdateKpiStatus({
        cycleId: kpiCycleInfo.value.id,
        statusCode: KPI_STATUS.PENDING_ACCEPTANCE,
        promotion: props.portfolioScope === "promotion",
        onlyFromStatusCode: status,
      });
    }
    unlockConfirmModalOpen.value = false;
    toast.success("KPI unlocked successfully.");
    await loadPmPortfolio(currentPortfolioYearParam());
    emit("timeline-refresh");
  } catch (err: unknown) {
    toast.error(sheetUpdateErrorMessage(err));
  } finally {
    unlockSubmitting.value = false;
  }
}
</script>

<template>
  <div class="animate-fade-in flex flex-col relative">
    <div
      v-if="showSectionHeading"
      class="border-b border-slate-200 px-5 py-4 shrink-0"
    >
      <h3 class="flex items-center gap-2 text-lg font-bold text-slate-800">
        <i class="fas fa-users text-indigo-500" />
        KPI Department
      </h3>
    </div>

    <KpiCreatorRowLegend v-if="hasPortfolioKpiRows" />

    <div v-if="hasPortfolioKpiRows" class="overflow-x-auto w-full">
      <table
        class="pm-kpi-portfolio-table w-full table-fixed border-collapse text-left"
        :class="{ 'pm-kpi-department-table': portfolioScope === 'department' }"
      >
        <colgroup>
          <col class="pm-kpi-col-objective" />
          <col class="pm-kpi-col-status" />
          <col class="pm-kpi-col-target" />
          <col class="pm-kpi-col-weight" />
          <col class="pm-kpi-col-actual" />
          <col class="pm-kpi-col-self" />
          <col class="pm-kpi-col-sup" />
          <col class="pm-kpi-col-action" />
        </colgroup>
        <thead
          class="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold"
        >
          <tr>
            <th class="py-4 px-5">Objectives</th>
            <th class="py-4 px-3 text-center">Status</th>
            <th class="py-4 px-5 text-center">Target</th>
            <th class="py-4 px-3 text-center">Weight</th>
            <th class="py-4 px-5 text-center">Actual Result</th>
            <th class="py-4 px-3 text-center border-x border-slate-100">
              Self Score
            </th>
            <th class="py-4 px-3 text-center">Final Score</th>
            <th class="py-4 px-5 text-center">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <template
            v-for="groupData in groupedPersonalKpis"
            :key="groupData.key"
          >
            <tr class="bg-slate-50 border-y border-slate-200">
              <td colspan="8" class="py-2.5 px-5">
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="text-xs font-bold uppercase tracking-wide text-slate-800"
                  >
                    {{ groupData.label }}
                  </span>
                  <span
                    v-if="portfolioScope === 'department'"
                    class="rounded-md border border-slate-200/80 bg-white px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600 normal-case"
                  >
                    {{ groupData.items.length }} KPI
                  </span>
                </div>
              </td>
            </tr>
            <template v-for="item in groupData.items" :key="item.id">
              <tr
                :id="'pm-kpi-parent-' + item.id"
                class="cursor-pointer group"
                :class="pmKpiParentRowClass(item)"
                @click="toggleKpiExpanded(item)"
              >
                <td class="py-4 px-5 align-middle">
                  <div class="flex items-start gap-2.5">
                    <button
                      v-if="item.isTree"
                      type="button"
                      :aria-expanded="item.expanded"
                      class="mt-0.5 shrink-0 w-5 h-5 flex items-center justify-center rounded bg-slate-100 text-slate-500 border border-slate-200 transition-transform duration-300"
                      :class="item.expanded ? 'rotate-0' : '-rotate-90'"
                      @click.stop="toggleKpiExpanded(item)"
                    >
                      <i class="fas fa-chevron-down text-[10px]" />
                    </button>
                    <div v-else class="w-5 h-5 shrink-0"></div>
                    <div class="flex flex-col gap-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="font-bold text-slate-900 text-sm">
                          {{ item.code }} {{ item.name }}
                        </p>
                        <GmStrategicKpiTypeTag :type="item.kpiType" size="sm" />
                        <i
                          v-if="item.isImportant"
                          class="fas fa-star text-amber-400 text-xs"
                          title="Important KPI"
                        ></i>
                      </div>
                      <div v-if="portfolioScope === 'department' && item.userName" class="flex items-center gap-1.5 mt-0.5">
                        <div
                          class="w-5 h-5 shrink-0 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-600"
                        >
                          {{ item.userAvatar }}
                        </div>
                        <div class="min-w-0 flex items-center gap-1.5">
                          <p class="text-xs font-semibold text-slate-600">
                            {{ item.userName }}
                          </p>
                          <span class="text-[9px] text-slate-400 uppercase bg-slate-50 px-1 border border-slate-200/60 rounded font-medium">
                            {{ item.userRole }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
                <td class="py-4 px-3 text-center align-middle">
                  <div
                    class="inline-flex items-center justify-center gap-1"
                  >
                    <span
                      v-if="pmRowStatusBadge(item, 'parent')"
                      class="pm-kpi-status-pill"
                      :class="pmRowStatusBadge(item, 'parent')?.cls"
                      :title="
                        hasPmRejectedReason(item)
                          ? pmStatusRejectTooltip(item)
                          : pmRowStatusBadge(item, 'parent')?.label
                      "
                    >
                      <span class="truncate">{{
                        pmRowStatusBadge(item, "parent")?.label
                      }}</span>
                    </span>
                    <span v-else class="text-xs font-semibold text-slate-400"
                      >-</span
                    >
                    <span
                      v-if="hasPmRejectedReason(item)"
                      :title="pmStatusRejectTooltip(item)"
                      class="inline-flex shrink-0 items-center text-[10px] font-medium text-orange-700 cursor-pointer hover:bg-orange-100 rounded"
                    >
                      <span
                        class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-orange-300 text-[10px] font-bold leading-none text-orange-700"
                        >?</span
                      >
                    </span>
                  </div>
                </td>
                <td class="py-4 px-5 align-middle text-center">
                  <PmKpiTableAlignedCell>
                    <span
                      :class="pmTargetPillClass(pmParentTargetBalance(item))"
                      :title="pmParentTargetTitle(item)"
                    >
                      {{ formatTargetCellWithUnit(item.target, item.unitCode) }}
                    </span>
                    <template #hint>
                      <KpiScoringRulesPreviewTooltip
                        :target-description="item.targetDescription"
                      />
                    </template>
                  </PmKpiTableAlignedCell>
                </td>
                <td class="py-4 px-3 text-center align-middle">
                  <span
                    class="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-md tabular-nums"
                    >{{ item.weight }}</span
                  >
                </td>
                <td class="py-4 px-5 align-middle text-center">
                  <span
                    :class="[
                      PM_PORTFOLIO_ACTUAL_CELL_CLASS,
                      pmDepartmentParentActualColorClass(item),
                    ]"
                  >
                    {{ formatPmTeamParentActualCell(item) || "-" }}
                  </span>
                </td>
                <td
                  class="py-4 px-3 text-center align-middle border-x border-slate-100 transition-shadow"
                  :class="
                    sendReviewErrorParentIds.has(String(item.id))
                      ? 'bg-rose-50/50 ring-2 ring-inset ring-rose-500 rounded-md'
                      : 'bg-blue-50/20'
                  "
                >
                  <span
                    class="text-xs font-bold tabular-nums"
                    :class="scoreColorClass(effectiveSelfScoreForParent(item))"
                    >{{ formatSelfScoreCell(item) }}</span
                  >
                </td>
                <td class="py-4 px-3 text-center align-middle">
                  <PmKpiTableAlignedCell>
                    <span
                      class="text-xs font-bold tabular-nums"
                      :class="scoreColorClass(effectivePmScoreForParent(item))"
                      >{{ formatPmScoreCell(item) }}</span
                    >
                    <template #hint>
                      <PmFinalScoreCommentTooltip
                        :comment="item.gmEvaluationComment"
                      />
                    </template>
                  </PmKpiTableAlignedCell>
                </td>
                <td class="py-4 px-5 text-center align-middle">
                  <div class="flex items-center justify-center gap-2">
                    <template v-if="props.portfolioScope === 'department'">
                      <button
                        v-if="item.userId"
                        type="button"
                        title="View evidence"
                        aria-label="View evidence"
                        @click.stop="openDepartmentEvidenceDrawer(item)"
                        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-600 shadow-sm hover:bg-slate-50 hover:text-blue-600"
                      >
                        <i class="far fa-eye text-xs" aria-hidden="true" />
                      </button>
                    </template>
                    <template v-else>
                      <!-- Team KPI: phân bổ + Feedback GM (404/407); trước đây Feedback chỉ nằm trong nhánh !isTree nên PM team không thấy nút. -->
                      <button
                        v-if="canEditAssigneeTargetScale(item)"
                        type="button"
                        title="Sửa target và thang điểm"
                        aria-label="Sửa target và thang điểm"
                        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-[10px] font-bold text-sky-800 shadow-sm hover:bg-sky-100"
                        @click.stop="openAssigneeTargetScaleEditor(item)"
                      >
                        <i class="fas fa-bullseye text-xs" aria-hidden="true" />
                      </button>
                      <button
                        v-if="canShowTeamAllocationButton(item)"
                        type="button"
                        @click.stop="$emit('open-assign', item)"
                        :disabled="
                          isPmGmFeedbackPending(item) ||
                          isPmKpiLockedAfterPmAccept(item) ||
                          isTeamAllocationEditLocked(item)
                        "
                        :title="teamAllocationEditLockReason(item) ?? 'Edit allocation'"
                        aria-label="Edit allocation"
                        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-[10px] font-bold text-violet-800 shadow-sm hover:bg-violet-100"
                        :class="
                          isPmGmFeedbackPending(item) ||
                          isPmKpiLockedAfterPmAccept(item) ||
                          isTeamAllocationEditLocked(item)
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-70 hover:bg-slate-100'
                            : ''
                        "
                      >
                        <i class="fas fa-sliders-h text-xs" aria-hidden="true" />
                      </button>
                      <button
                        v-if="canShowSelfCreatedKpiEditButton(item)"
                        type="button"
                        @click.stop="$emit('open-assign', item)"
                        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-[10px] font-bold text-amber-800 shadow-sm hover:bg-amber-100"
                        :title="
                          Number(item.statusCode) === KPI_STATUS.REJECTED
                            ? 'Edit KPI and resubmit to GM'
                            : 'Edit KPI before sending to GM for approval'
                        "
                        aria-label="Edit KPI"
                      >
                        <i class="fas fa-pen text-xs" aria-hidden="true" />
                      </button>
                      <button
                        v-if="canShowPmFeedbackToGmButton(item)"
                        type="button"
                        @click.stop="openFeedbackDrawer(item)"
                        title="Send feedback to GM"
                        aria-label="Send feedback to GM"
                        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-[10px] font-bold text-violet-800 shadow-sm hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <i class="fas fa-message text-xs" aria-hidden="true" />
                      </button>
                      <!-- Individual (Portfolio) / Promotion (tab Promotion): chỉ Edit sau khi Accept KPI -->
                      <button
                        v-else-if="
                          !item.isTree && !canShowSelfCreatedKpiEditButton(item)
                        "
                        type="button"
                        :disabled="
                          isPmDirectAssignmentEditLockedBeforeAccept(item)
                        "
                        :title="pmDirectAssignmentEditLockReason(item)"
                        @click.stop="openEvidenceDrawer(item)"
                        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold shadow-sm"
                        :class="
                          isPmDirectAssignmentEditLockedBeforeAccept(item)
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-70'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-600'
                        "
                        :aria-label="
                          props.readonlyYear ? 'View evidence' : 'Edit evidence'
                        "
                      >
                        <i
                          :class="
                            props.readonlyYear
                              ? 'far fa-eye text-xs'
                              : 'fas fa-pen text-xs'
                          "
                          aria-hidden="true"
                        />
                      </button>
                      <button
                        v-if="canShowSelfCreatedDeleteButton(item)"
                        type="button"
                        :disabled="deletingSelfCreatedKpiIds.has(item.id)"
                        title="Delete KPI"
                        aria-label="Delete KPI"
                        @click.stop="promptDeleteSelfCreatedPmKpi(item)"
                        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-[10px] font-bold text-rose-700 shadow-sm hover:bg-rose-100"
                        :class="
                          deletingSelfCreatedKpiIds.has(item.id)
                            ? 'cursor-not-allowed opacity-70'
                            : ''
                        "
                      >
                        <i
                          :class="
                            deletingSelfCreatedKpiIds.has(item.id)
                              ? 'fas fa-spinner fa-spin text-xs'
                              : 'fas fa-trash text-xs'
                          "
                        />
                      </button>
                    </template>
                  </div>
                </td>
              </tr>
              <template
                v-if="
                  item.isTree &&
                  item.expanded &&
                  visibleChildrenForItem(item).length
                "
              >
                <tr
                  v-for="child in visibleChildrenForItem(item)"
                  :key="`${item.id}-${child.id}`"
                  class="pm-kpi-child-row bg-slate-50/70 hover:bg-slate-100/90 border-t border-slate-100/90 transition-colors"
                  @click.stop
                >
                  <td class="py-3 px-5 align-top relative min-w-0">
                    <div
                      class="absolute left-[30px] top-0 bottom-0 w-px bg-purple-200"
                    />
                    <div
                      class="absolute left-[30px] top-1/2 w-4 h-px bg-purple-200"
                    />
                    <div class="flex items-center gap-2 pl-[46px]">
                      <div
                        class="w-6 h-6 shrink-0 rounded-full border border-slate-200 bg-white flex items-center justify-center text-[9px] font-bold text-slate-600"
                      >
                        {{ child.avatar }}
                      </div>
                      <div class="min-w-0">
                        <p class="text-xs font-bold text-slate-800 truncate">
                          {{ child.name }}
                        </p>
                        <p class="text-[9px] text-slate-500 uppercase truncate">
                          {{ child.role }}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td class="py-3 px-3 text-center align-top">
                    <div
                      class="inline-flex items-center justify-center gap-1"
                    >
                      <span
                        v-if="pmRowStatusBadge(child, 'child')"
                        class="pm-kpi-status-pill"
                        :class="pmRowStatusBadge(child, 'child')?.cls"
                        :title="
                          hasPmRejectedReason(child)
                            ? pmStatusRejectTooltip(child)
                            : pmRowStatusBadge(child, 'child')?.label
                        "
                      >
                        <span class="truncate">{{
                          pmRowStatusBadge(child, "child")?.label
                        }}</span>
                      </span>
                      <span v-else class="text-xs font-semibold text-slate-400"
                        >-</span
                      >
                      <span
                        v-if="hasPmRejectedReason(child)"
                        :title="pmStatusRejectTooltip(child)"
                        class="inline-flex shrink-0 items-center text-[10px] font-medium text-orange-700 cursor-pointer hover:bg-orange-100 rounded"
                      >
                        <span
                          class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-orange-300 text-[10px] font-bold leading-none text-orange-700"
                          >?</span
                        >
                      </span>
                    </div>
                  </td>
                  <td class="py-3 px-5 align-top text-center">
                    <PmKpiTableAlignedCell>
                      <span :class="pmTargetPillClass(null)">
                        {{
                          formatTargetCellWithUnit(child.target, item.unitCode)
                        }}
                      </span>
                    </PmKpiTableAlignedCell>
                  </td>
                  <td class="py-3 px-3 text-center align-top">
                    <span
                      class="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-md tabular-nums"
                    >
                      {{
                        child.weight != null && child.weight !== ""
                          ? child.weight
                          : "-"
                      }}
                    </span>
                  </td>
                  <td class="py-3 px-5 align-top text-center">
                    <span
                      :class="[
                        PM_PORTFOLIO_ACTUAL_CELL_CLASS,
                        pmDepartmentChildActualColorClass(item, child),
                      ]"
                    >
                      {{ pmChildActualCell(child, item) }}
                    </span>
                  </td>
                  <td
                    class="py-3 px-3 text-center align-top bg-blue-50/10 border-x border-slate-100"
                  >
                    <span
                      class="text-xs font-bold tabular-nums"
                      :class="
                        scoreColorClass(
                          canSupervisorViewMemberSelfEvaluation(
                            child.statusCode,
                            'pm',
                          )
                            ? child.selfScore
                            : null,
                        )
                      "
                      >{{
                        supervisorMemberSelfScoreDisplay(
                          child.selfScore,
                          child.statusCode,
                          "pm",
                        )
                      }}</span
                    >
                  </td>
                  <td class="py-3 px-3 text-center align-top">
                    <PmKpiTableAlignedCell>
                      <span
                        class="text-xs font-bold tabular-nums"
                        :class="scoreColorClass(child.pmScore)"
                        >{{ formatPmScoreCellValue(child.pmScore) }}</span
                      >
                      <template #hint>
                        <PmFinalScoreCommentTooltip
                          :comment="child.gmEvaluationComment"
                        />
                      </template>
                    </PmKpiTableAlignedCell>
                  </td>
                  <td class="py-3 px-5 text-center align-top">
                    <div class="flex items-center justify-center gap-1.5">
                      <template v-if="props.portfolioScope === 'department'">
                        <button
                          v-if="child.userId"
                          type="button"
                          title="View evidence"
                          aria-label="View evidence"
                          @click.stop="openChildEvidenceDrawer(child, item, true)"
                          class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-[10px] font-bold text-slate-600 shadow-sm hover:bg-slate-50 hover:text-blue-600"
                        >
                          <i class="far fa-eye text-[10px]" aria-hidden="true" />
                        </button>
                      </template>
                      <template v-else>
                        <button
                          v-if="
                            !props.readonlyYear &&
                            isMemberFeedbackPendingForPm(child)
                          "
                          type="button"
                          @click.stop="
                            openMemberFeedbackReviewDrawer(child, item)
                          "
                          title="Process feedback"
                          aria-label="Process feedback"
                          class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-violet-200 bg-violet-50 text-[10px] font-bold text-violet-700 shadow-sm hover:bg-violet-100"
                        >
                          <i class="far fa-comment-dots text-[10px]" aria-hidden="true" />
                        </button>
                        <button
                          v-if="!isChildOwnedByCurrentPm(child)"
                          type="button"
                          :disabled="
                            props.readonlyYear ||
                            isRemovingChildAssignment(child.id) ||
                            hasMemberSubmittedActualForPmReview(child)
                          "
                          :title="
                            props.readonlyYear
                              ? 'Year is locked; data is read-only.'
                              : hasMemberSubmittedActualForPmReview(child)
                                ? 'Member has submitted actuals for PM approval; allocation cannot be edited.'
                                : 'Remove member from KPI'
                          "
                          aria-label="Remove member from KPI"
                          @click.stop="
                            promptRemoveTeamMemberFromKpi(item, child)
                          "
                          class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold shadow-sm"
                          :class="
                            props.readonlyYear ||
                            isRemovingChildAssignment(child.id) ||
                            hasMemberSubmittedActualForPmReview(child)
                              ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-70'
                              : 'border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100'
                          "
                        >
                          <i
                            class="text-[10px]"
                            :class="
                              isRemovingChildAssignment(child.id)
                                ? 'fas fa-spinner fa-spin'
                                : 'fas fa-trash'
                            "
                          />
                        </button>
                        <button
                          v-if="isChildOwnedByCurrentPm(child)"
                          type="button"
                          :disabled="
                            isPmTeamSelfRowActualEditLockedBeforeAccept(item)
                          "
                          :title="pmTeamSelfRowLockReason(item)"
                          @click.stop="
                            openChildEvidenceDrawer(
                              child,
                              item,
                              props.readonlyYear,
                            )
                          "
                          class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold shadow-sm"
                          :class="
                            isPmTeamSelfRowActualEditLockedBeforeAccept(item)
                              ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-70'
                              : 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          "
                          :aria-label="
                            props.readonlyYear ? 'View evidence' : 'Edit actual'
                          "
                        >
                          <i
                            :class="
                              props.readonlyYear
                                ? 'far fa-eye text-[10px]'
                                : 'fas fa-pen text-[10px]'
                            "
                            aria-hidden="true"
                          />
                        </button>
                        <button
                          v-else
                          type="button"
                          title="View member submission"
                          aria-label="View member submission"
                          @click.stop="openChildEvidenceDrawer(child, item, true)"
                          class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-[10px] font-bold text-slate-600 shadow-sm hover:bg-slate-50 hover:text-blue-600"
                        >
                          <i class="far fa-eye text-[10px]" aria-hidden="true" />
                        </button>
                      </template>
                    </div>
                  </td>
                </tr>
              </template>
              <tr
                v-if="shouldShowNoAssignmentRow(item)"
                class="bg-slate-50/70 border-t border-slate-100/90"
                @click.stop
              >
                <td
                  colspan="8"
                  class="py-3 px-5 text-center text-xs font-semibold text-slate-400"
                >
                  No Assignment
                </td>
              </tr>
            </template>
          </template>
        </tbody>

        <tfoot
          v-if="portfolioScope !== 'department'"
          class="bg-slate-100/80 border-t-2 border-slate-200 font-bold"
        >
          <tr>
            <td
              colspan="3"
              class="py-4 px-5 text-right text-slate-700 uppercase text-xs tracking-wider"
            >
              Total weight:
            </td>
            <td class="py-4 px-3 text-center">
              <span class="text-xs text-slate-800 tabular-nums">{{
                totalPortfolioWeightDisplay
              }}</span
              ><span class="text-[10px] text-slate-500 font-medium ml-1"
                >pts</span
              >
            </td>
            <td class="py-4 px-5" />
            <td
              class="py-4 px-3 text-center text-slate-500 text-xs tabular-nums border-x border-slate-100"
            >
              {{ totalWeightedSelfScoreDisplay }}
            </td>
            <td
              class="py-4 px-3 text-center text-slate-500 text-xs tabular-nums"
            >
              {{ totalWeightedPmScoreDisplay }}
            </td>
            <td class="py-4 px-3"></td>
          </tr>
          <tr class="bg-violet-50/50 border-t border-slate-200">
            <td
              colspan="5"
              class="py-4 px-5 text-right text-violet-800 uppercase text-xs tracking-wider"
            >
              Average score:
            </td>
            <td
              class="py-4 px-3 text-center bg-violet-100/80 border-x border-violet-200"
            >
              <span
                class="text-lg font-bold"
                :class="
                  averageSelfScoreDisplay === '-'
                    ? 'text-slate-500 text-sm'
                    : 'text-violet-500 text-lg font-extrabold'
                "
                >{{ averageSelfScoreDisplay }}</span
              >
            </td>
            <td class="py-4 px-3 text-center text-sm font-bold">
              <span
                :class="
                  averagePmScoreDisplay === '-'
                    ? 'text-slate-500'
                    : 'text-violet-700 text-lg font-extrabold'
                "
                >{{ averagePmScoreDisplay }}</span
              >
            </td>
            <td class="py-4 px-3"></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div
      v-else
      class="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-16 text-center"
    >
      <i class="fas fa-inbox mb-3 text-3xl text-slate-300" aria-hidden="true" />
      <p class="text-sm font-semibold text-slate-600">No KPIs available.</p>
    </div>

    <EvaluationCommentBlock
      v-if="hasPortfolioKpiRows && portfolioScope !== 'department'"
      v-model:employeeComment="pmComments.selfComment"
      v-model:managerComment="pmComments.supervisorComment"
      :employee-comment-section-id="employeeCommentAnchorId"
      employeeTitle="Employee's Comment"
      managerTitle="Supervisor Comment"
      :employee-readonly="pmSelfCommentReadonly"
      :manager-readonly="true"
      :employee-highlight-error="sendReviewErrorComment"
    />
    <div v-if="hasPortfolioKpiRows && portfolioScope !== 'department'" class="mt-6 mb-8 flex justify-center">
      <button
        type="button"
        v-if="buttonState.show"
        :disabled="buttonState.disabled"
        :title="
          buttonState.disabled && buttonState.reason
            ? buttonState.reason
            : undefined
        "
        @click="handleSubmitClick"
        class="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-6 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <i class="fas fa-paper-plane text-sm" /> {{ buttonState.text }}
      </button>
    </div>
    <EvaluationEvidenceDrawer
      :open="evidencePanelOpen"
      :item="selectedKpiItem"
      :readonly="
        props.readonlyYear ||
        evidenceDrawerViewOnly ||
        props.portfolioScope === 'department' ||
        isPmEvidenceReadonly(selectedKpiItem)
      "
      self-score-footer-readonly
      :save-evidence="saveEvidenceData"
      @close="evidencePanelOpen = false"
    />

    <Teleport to="body">
      <Transition name="pm-feedback-drawer">
        <div
          v-if="feedbackDrawerOpen && feedbackDrawerAssignment"
          class="fixed inset-0 z-[120] flex justify-end"
          role="dialog"
          aria-modal="true"
        >
          <div
            class="pm-feedback-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
            @click="closeFeedbackDrawer"
          />
          <aside
            class="pm-feedback-panel relative flex h-full w-full max-w-full flex-col border-l border-slate-200 bg-white shadow-2xl md:w-[460px]"
          >
            <header class="border-b border-slate-200 bg-white px-5 py-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="mb-2 flex items-center gap-2">
                    <GmStrategicKpiTypeTag
                      :type="feedbackDrawerAssignment.kpiType"
                      size="sm"
                    />
                  </div>
                  <h4
                    class="truncate text-2xl font-bold leading-tight text-slate-900"
                  >
                    {{ feedbackDrawerAssignment.name }}
                  </h4>
                  <div
                    class="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-semibold text-slate-700"
                  >
                    <p>
                      Target:
                      <span class="font-bold text-slate-900">
                        {{
                          formatTargetCellWithUnit(
                            feedbackDrawerAssignment.target,
                            feedbackDrawerAssignment.unitCode,
                          )
                        }}
                      </span>
                    </p>
                    <p>
                      Weight:
                      <span class="font-bold text-slate-900">{{
                        feedbackDrawerAssignment.weight ?? "-"
                      }}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  @click="closeFeedbackDrawer"
                >
                  <i class="fas fa-times text-xs" />
                </button>
              </div>
            </header>

            <div class="flex-1 overflow-y-auto bg-slate-50/40">
              <section class="border-b border-slate-200 bg-white px-5 py-4">
                <h4
                  class="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900"
                >
                  <i class="fas fa-align-left text-xs text-violet-600" />
                  Adjustment Proposal
                </h4>
                <div class="space-y-3">
                  <div>
                    <label
                      class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
                    >
                      Detailed Content
                    </label>
                    <div
                      v-if="isPmFeedbackDrawerReadonly()"
                      class="min-h-[88px] whitespace-pre-wrap rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700"
                    >
                      {{ feedbackDraftText || "No feedback content." }}
                    </div>
                    <textarea
                      v-else
                      v-model="feedbackDraftText"
                      rows="4"
                      class="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                      placeholder="Describe your reason or proposed solution..."
                    />
                  </div>
                  <div class="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                      @click="closeFeedbackDrawer"
                    >
                      {{ isPmFeedbackDrawerReadonly() ? "Close" : "Cancel" }}
                    </button>
                    <button
                      v-if="!isPmFeedbackDrawerReadonly()"
                      type="button"
                      :disabled="
                        isSendingPmFeedback(feedbackDrawerAssignment.id) ||
                        !feedbackDraftText.trim()
                      "
                      class="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                      @click="
                        sendFeedbackToGmForAssignment(feedbackDrawerAssignment)
                      "
                    >
                      <i
                        :class="
                          isSendingPmFeedback(feedbackDrawerAssignment.id)
                            ? 'fas fa-spinner fa-spin text-xs'
                            : 'fas fa-paper-plane text-xs'
                        "
                      />
                      Send to manager
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </aside>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="pm-feedback-drawer">
        <div
          v-if="memberFeedbackReviewDrawerOpen && memberFeedbackReviewTarget"
          class="fixed inset-0 z-[125] flex justify-end"
          role="dialog"
          aria-modal="true"
        >
          <div
            class="pm-feedback-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
            @click="closeMemberFeedbackReviewDrawer"
          />
          <aside
            class="pm-feedback-panel relative flex h-full w-full max-w-full flex-col border-l border-slate-200 bg-white shadow-2xl md:w-[460px]"
          >
            <header class="border-b border-slate-200 bg-white px-5 py-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <h4
                      class="truncate text-2xl font-bold leading-tight text-slate-900"
                    >
                      {{ memberFeedbackReviewTarget.parentName }}
                    </h4>
                    <GmStrategicKpiTypeTag
                      :type="memberFeedbackReviewTarget.parentKpiType"
                      size="sm"
                    />
                  </div>
                  <div
                    class="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-semibold text-slate-700"
                  >
                    <p>
                      Target:
                      <span class="font-bold text-slate-900">
                        {{
                          formatTargetCellWithUnit(
                            memberFeedbackReviewTarget.parentTarget,
                            memberFeedbackReviewTarget.parentUnitCode,
                          )
                        }}
                      </span>
                    </p>
                    <p>
                      Weight:
                      <span class="font-bold text-slate-900">{{
                        memberFeedbackReviewTarget.parentWeight ?? "-"
                      }}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  @click="closeMemberFeedbackReviewDrawer"
                >
                  <i class="fas fa-times text-xs" />
                </button>
              </div>
            </header>

            <div class="flex-1 overflow-y-auto bg-slate-50/40">
              <section class="border-b border-slate-200 bg-white px-5 py-4">
                <h4
                  class="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900"
                >
                  <i class="fas fa-align-left text-xs text-violet-600" />
                  Feedback from {{ memberFeedbackReviewTarget.memberName }}
                </h4>
                <div>
                  <label
                    class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    Feedback Content
                  </label>
                  <div
                    class="min-h-[88px] whitespace-pre-wrap rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700"
                  >
                    {{ memberFeedbackReviewTarget.note }}
                  </div>
                </div>
                <p class="mb-2 text-[11px] font-medium text-slate-600">
                  Team KPI: "Accept and allocate" opens the allocation drawer;
                  after "Confirm allocation and close feedback", the system
                  records it as one approval + allocation save transaction.
                </p>
                <div class="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    :disabled="
                      isDecidingMemberFeedback(
                        memberFeedbackReviewTarget.assignmentId,
                      )
                    "
                    class="rounded-md border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    @click="decideMemberFeedbackFromDrawer(false)"
                  >
                    Reject feedback
                  </button>
                  <button
                    type="button"
                    :disabled="
                      isDecidingMemberFeedback(
                        memberFeedbackReviewTarget.assignmentId,
                      )
                    "
                    class="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                    @click="acceptMemberFeedbackFromDrawer()"
                  >
                    <i class="fas fa-sliders-h text-xs" />
                    Accept and allocate
                  </button>
                </div>
              </section>
            </div>
          </aside>
        </div>
      </Transition>
    </Teleport>
    <Teleport to="body">
      <Transition name="gm-diag-filter-pop">
        <div
          v-if="removeTeamMemberModalOpen && removeTeamMemberTarget"
          class="fixed inset-0 z-[300] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pm-remove-team-member-title"
        >
          <div
            class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            @click="closeRemoveTeamMemberModal"
          />
          <div
            class="relative w-full max-w-md transform overflow-hidden rounded-xl bg-white p-6 text-left align-middle shadow-xl transition-all"
          >
            <h3
              id="pm-remove-team-member-title"
              class="flex items-center gap-2 text-lg font-bold leading-6 text-slate-900"
            >
              <i class="fas fa-exclamation-triangle text-rose-500" />
              Confirm member removal
            </h3>
            <div class="mt-3">
              <p class="text-sm text-slate-600">
                Remove allocation for
                <span class="font-bold text-slate-800">{{
                  removeTeamMemberTarget.child?.name ?? "this member"
                }}</span>
                from KPI
                <span class="font-bold text-slate-800">{{
                  removeTeamMemberTarget.parent?.name ?? ""
                }}</span>?
              </p>
              <p class="mt-2 text-sm font-medium text-rose-600">
                This action cannot be undone.
              </p>
            </div>
            <div class="mt-6 flex justify-end gap-3">
              <button
                type="button"
                class="inline-flex justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none"
                @click="closeRemoveTeamMemberModal"
              >
                Cancel
              </button>
              <button
                type="button"
                :disabled="
                  isRemovingChildAssignment(
                    String(removeTeamMemberTarget.child?.id ?? ''),
                  )
                "
                class="inline-flex justify-center rounded-lg border border-transparent bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                @click="confirmRemoveTeamMemberFromKpi"
              >
                <i
                  v-if="
                    isRemovingChildAssignment(
                      String(removeTeamMemberTarget.child?.id ?? ''),
                    )
                  "
                  class="fas fa-spinner fa-spin text-xs"
                />
                Remove member
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    <Teleport to="body">
      <Transition name="gm-diag-filter-pop">
        <div
          v-if="deleteConfirmModalOpen"
          class="fixed inset-0 z-[300] flex items-center justify-center p-4"
        >
          <div
            class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            @click="closeDeleteConfirmModal"
          ></div>
          <div
            class="relative w-full max-w-md transform overflow-hidden rounded-xl bg-white p-6 text-left align-middle shadow-xl transition-all"
          >
            <h3
              class="text-lg font-bold leading-6 text-slate-900 flex items-center gap-2"
            >
              <i class="fas fa-exclamation-triangle text-rose-500"></i> Confirm
              KPI deletion
            </h3>
            <div class="mt-3">
              <p class="text-sm text-slate-600">
                Are you sure you want to delete KPI
                <span class="font-bold text-slate-800"
                  >"{{ deleteConfirmItem?.name }}"</span
                >?
              </p>
              <p class="text-sm text-rose-600 mt-2 font-medium">
                Note: This action cannot be undone.
              </p>
            </div>
            <div class="mt-6 flex justify-end gap-3">
              <button
                type="button"
                class="inline-flex justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none"
                @click="closeDeleteConfirmModal"
              >
                Cancel
              </button>
              <button
                type="button"
                class="inline-flex justify-center rounded-lg border border-transparent bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 focus:outline-none"
                @click="executeDeleteSelfCreatedPmKpi"
              >
                Delete KPI
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    <Teleport to="body">
      <Transition name="gm-diag-filter-pop">
        <div
          v-if="unlockConfirmModalOpen"
          class="fixed inset-0 z-[300] flex items-center justify-center p-4"
        >
          <div
            class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            @click="closeUnlockConfirmModal"
          ></div>
          <div
            class="relative w-full max-w-md transform overflow-hidden rounded-xl bg-white p-6 text-left align-middle shadow-xl transition-all"
          >
            <h3
              class="text-lg font-bold leading-6 text-slate-900 flex items-center gap-2"
            >
              <i class="fas fa-lock-open text-amber-500"></i> Confirm KPI unlock
            </h3>
            <div class="mt-3">
              <p class="text-sm text-slate-600">
                Are you sure you want to unlock all of these KPIs?
              </p>
            </div>
            <div class="mt-6 flex justify-end gap-3">
              <button
                type="button"
                :disabled="unlockSubmitting"
                class="inline-flex justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                @click="closeUnlockConfirmModal"
              >
                No
              </button>
              <button
                type="button"
                :disabled="unlockSubmitting"
                class="inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                @click="confirmUnlockKpi"
              >
                <i
                  v-if="unlockSubmitting"
                  class="fas fa-spinner fa-spin text-xs"
                />
                <i v-else class="fas fa-lock-open text-xs" />
                Yes
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <PmAssigneeTargetScaleModal
      v-model="showAssigneeTargetScaleModal"
      :item="assigneeTargetScaleItem"
      @saved="onAssigneeTargetScaleSaved"
    />
  </div>
</template>

<style scoped>
.gm-diag-filter-pop-enter-active,
.gm-diag-filter-pop-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.gm-diag-filter-pop-enter-from,
.gm-diag-filter-pop-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
.gm-diag-filter-pop-enter-to,
.gm-diag-filter-pop-leave-from {
  opacity: 1;
  transform: scale(1);
}

/* Cùng một bảng + colgroup → dòng breakdown thẳng cột với header/parent */
.pm-kpi-portfolio-table col.pm-kpi-col-objective {
  width: 23%;
}
.pm-kpi-portfolio-table col.pm-kpi-col-target {
  width: 13%;
}
/* Strategic Diagnostics: Actual Result = 2/15 cột lưới (mọi tab PM) */
.pm-kpi-portfolio-table col.pm-kpi-col-actual {
  width: 13.333%;
  min-width: 5.5rem;
}
.pm-kpi-portfolio-table col.pm-kpi-col-status {
  width: 15%;
  min-width: 11.5rem;
}
.pm-kpi-portfolio-table col.pm-kpi-col-weight {
  width: 5%;
  max-width: 3.75rem;
}
.pm-kpi-portfolio-table col.pm-kpi-col-self {
  width: 7%;
  max-width: 5.25rem;
}
.pm-kpi-portfolio-table col.pm-kpi-col-sup {
  width: 7%;
  max-width: 5.25rem;
}

.pm-kpi-status-pill {
  display: inline-flex;
  max-width: 100%;
  cursor: default;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border-width: 1px;
  padding: 0.125rem 0.5rem;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.25;
  text-align: center;
  white-space: normal;
}
.pm-kpi-portfolio-table col.pm-kpi-col-action {
  width: 15%;
  min-width: 8.5rem;
}

.pm-kpi-child-row {
  animation: pm-kpi-child-in 0.22s ease;
}
@keyframes pm-kpi-child-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .pm-kpi-child-row {
    animation: none;
  }
}

.pm-feedback-drawer-enter-active,
.pm-feedback-drawer-leave-active {
  transition-duration: 0.32s;
}
.pm-feedback-drawer-enter-active .pm-feedback-backdrop,
.pm-feedback-drawer-leave-active .pm-feedback-backdrop {
  transition: opacity 0.32s ease;
}
.pm-feedback-drawer-enter-active .pm-feedback-panel,
.pm-feedback-drawer-leave-active .pm-feedback-panel {
  transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);
}
.pm-feedback-drawer-enter-from .pm-feedback-backdrop,
.pm-feedback-drawer-leave-to .pm-feedback-backdrop {
  opacity: 0;
}
.pm-feedback-drawer-enter-to .pm-feedback-backdrop,
.pm-feedback-drawer-leave-from .pm-feedback-backdrop {
  opacity: 1;
}
.pm-feedback-drawer-enter-from .pm-feedback-panel,
.pm-feedback-drawer-leave-to .pm-feedback-panel {
  transform: translate3d(100%, 0, 0);
}
.pm-feedback-drawer-enter-to .pm-feedback-panel,
.pm-feedback-drawer-leave-from .pm-feedback-panel {
  transform: translate3d(0, 0, 0);
}
</style>
