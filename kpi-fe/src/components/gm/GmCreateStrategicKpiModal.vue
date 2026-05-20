<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import type { GmBscPerspective, GmHierarchyKpi, GmHierarchyPm, GmStrategicKpiKind } from '@/types/gm-workspace'
import type { GmStrategicKpiEditData } from '@/types/gm-strategic-kpi-edit'
import { normalizeStrategicKpiKind } from '@/utils/gm-strategic-kpi-kind'
import { useGmKpiCategoryOptions } from '@/composables/useGmKpiCategoryOptions'
import { useKpiCalculationReference } from '@/composables/useKpiCalculationReference'
import { useKpiUnitOptions } from '@/composables/useKpiUnitOptions'
import { useRankOptions } from '@/composables/useRankOptions'
import { useDepartmentManagerOptions } from '@/composables/useDepartmentManagerOptions'
import {
  apiGetMembersByRank,
  apiGetPromotionAssignees,
  apiGetStrategicKpiTypes,
} from '@/services/modules/kpi-reference.service'
import { gmKpiService } from '@/services/modules/kpi-gm.service'
import type { GmKpiCycleOption } from '@/types/gm-kpi-cycle'
import { mapGmDiagnosticsApiKpisToHierarchyRows } from '@/utils/mapGmDiagnosticsApiToHierarchy'
import { kpiFormUnitToUnitCode, kpiUnitCodeToFormUnit } from '@/utils/kpiUnitCodes'
import {
  codesFromPersistedCalculationMethod,
  persistedCalculationMethodFromTypeAndRule,
} from '@/utils/kpiCalculationCodes'
import type { KpiTypeOption } from '@/types/kpi-type-option'
import type { MemberByRankOption } from '@/types/member-by-rank'
import {
  strategicKpiKindFromCreatePayload,
  strategicKpiKindFromTypeCode,
  strategicKpiTypeIconClass,
  typeCodeFromStrategicKpiKind,
} from '@/utils/strategicKpiTypeCodes'
import type { GmKpiTemplateItemRow, GmKpiTemplatePackageRow } from '@/types/gm-kpi-template'
import type { DepartmentManagerOption } from '@/types/department-manager'
import {
  parseTrimmedTargetNumber,
  targetRowHasValidationIssue,
  validateNonNegativeTargetBatch,
  validateNonNegativeTargetValue,
} from '@/utils/kpiTargetValidation'
import GmStrategicKpiTypeTag from '@/components/gm/GmStrategicKpiTypeTag.vue'
import ScoringRulesHelpTooltip from '@/components/kpi/ScoringRulesHelpTooltip.vue'
import { GM_BSC_LABELS, GM_BSC_ORDER, normalizeGmBscPerspective } from '@/utils/gm-bsc-diagnostics'
import {
  buildScoringRulesPayload,
  emptyScoringRulesPayload,
  extractRawInputFromApiTargetDescription,
  validateScoringRulesDsl,
} from '@/utils/kpiScoringRulesDsl'
import { useAuthStore } from '@/stores/auth.store'

interface DirectMemberOption {
  val: string
  short: string
  label: string
  dept: string
  rank: string
  avatar: string
}

/** Drawer tạo Strategic KPI — theo `Documents/index.html` (drawer + formula + input-required). */
const open = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    /** UUID `kpi_cycles.id` đang chọn ở header GM (`GET /common/kpi-cycles`). */
    cycleId: string
    /** Khi có — drawer mở ở chế độ sửa, điền form từ dòng diagnostics; không hiện block sao chép KPI. */
    editInitial?: GmHierarchyKpi | null
    /**
     * Chu kỳ đánh giá đã tải ở `GmLayout` — nếu có phần tử thì drawer không gọi lại `getKpiCyclesForEvaluation`.
     */
    prefetchedEvaluationCycles?: GmKpiCycleOption[] | null
    /**
     * `kpi_assignments.id` của feedback đang được duyệt (mở drawer từ luồng "Duyệt feedback").
     * Khi có — highlight đúng dòng assign tương ứng để GM dễ nhận biết đang sửa target cho ai.
     */
    feedbackAssignmentId?: string | null
  }>(),
  {
    cycleId: '',
    editInitial: null,
    prefetchedEvaluationCycles: null,
    feedbackAssignmentId: null,
  },
)

const isEditingFromDiagnostics = computed(() => props.editInitial != null)
const authStore = useAuthStore()
const gmUserId = computed(() => String(authStore.user?.id ?? '').trim())

/**
 * Map `kpi_assignments.id` (feedback) → `users.id` để highlight đúng dòng assignee trong drawer.
 * Gồm assignment của PM (PM feedback GM) và member/leader trong cây cascade.
 */
function resolveFeedbackAssigneeUserIdFromKpi(
  kpi: GmHierarchyKpi | null | undefined,
  assignmentId: string,
): string | null {
  const aid = String(assignmentId ?? '').trim()
  if (!aid || !kpi || !Array.isArray(kpi.pmOwners)) return null
  for (const pm of kpi.pmOwners) {
    if (String(pm.assignmentId ?? '').trim() === aid) {
      return pmSelectionKey(pm)
    }
    for (const m of pm.members ?? []) {
      if (String(m.assignmentId ?? '').trim() === aid) {
        return String(m.id ?? '').trim() || null
      }
    }
    for (const ld of pm.leaders ?? []) {
      const own = ld.leaderOwnRow
      if (own && String(own.assignmentId ?? '').trim() === aid) {
        return String(own.id ?? '').trim() || null
      }
      for (const m of ld.members ?? []) {
        if (String(m.assignmentId ?? '').trim() === aid) {
          return String(m.id ?? '').trim() || null
        }
      }
    }
  }
  return null
}

const feedbackAssigneeUserId = computed<string | null>(() => {
  const aid = String(props.feedbackAssignmentId ?? '').trim()
  if (!aid) return null
  return resolveFeedbackAssigneeUserIdFromKpi(props.editInitial, aid)
})

function isFeedbackAssignee(userId: string | null | undefined): boolean {
  const target = feedbackAssigneeUserId.value
  if (!target) return false
  return String(userId ?? '').trim() === target
}

const isDirectFeedbackSplitEdit = computed(() => {
  return Boolean(props.feedbackAssignmentId && props.editInitial) &&
    (kpiTypeCode.value === 101 || kpiTypeCode.value === 103)
})

/** GM duyệt feedback PM (KPI Team): chỉ hiển thị PM gửi feedback, không sửa/xóa. */
const isGmFeedbackCascadingAllocationReview = computed(() => {
  return (
    Boolean(props.feedbackAssignmentId && props.editInitial) &&
    kpiType.value === 'cascading' &&
    !isDirectFeedbackSplitEdit.value
  )
})

const visibleSelectedPMs = computed(() => {
  if (!isGmFeedbackCascadingAllocationReview.value) {
    return selectedPMs.value
  }
  const uid = feedbackAssigneeUserId.value
  if (!uid) return []
  return selectedPMs.value.filter((id) => String(id).trim() === uid)
})

const visibleSelectedMembers = computed(() => {
  if (!isDirectFeedbackSplitEdit.value) return selectedMembers.value
  const uid = feedbackAssigneeUserId.value
  if (!uid) return []
  return selectedMembers.value.filter((id) => String(id).trim() === uid)
})

const feedbackIndividualMemberCard = computed(() => {
  if (!isDirectFeedbackSplitEdit.value) return null
  const uid = feedbackAssigneeUserId.value
  if (!uid) return null
  for (const rank of selectedRanks.value) {
    const ids = selectedRankMembers.value[rank] ?? []
    if (!ids.includes(uid)) continue
    const rankMeta = rankRows.value.find((item) => item.code === rank)
    const member = membersByRank(rank).find((m) => m.val === uid)
    if (member) {
      return { rank, rankLabel: rankMeta?.name ?? rank, member }
    }
  }
  return {
    rank: selectedRanks.value[0] ?? '',
    rankLabel: '',
    member: {
      val: uid,
      short: `User ${uid.slice(0, 8)}…`,
      dept: '',
      rank: '',
      avatar: '?',
      label: uid,
    },
  }
})

const strategicEditDetailLoading = ref(false)
const strategicEditDetailError = ref<string | null>(null)

function parseDiagnosticsKpiInformationId(kpi: GmHierarchyKpi | null | undefined): string | null {
  const id = String(kpi?.id ?? '').trim()
  if (!id) return null
  if (id.startsWith('diag-kpi-')) {
    const raw = id.slice('diag-kpi-'.length).trim()
    return raw || null
  }
  if (USER_ID_UUID_RE.test(id)) return id
  return null
}

const emit = defineEmits<{
  saved: [payload: Record<string, unknown> | Record<string, unknown>[]]
  /** Khi drawer tự gọi API chu kỳ (không dùng `prefetchedEvaluationCycles`) — đồng bộ header. */
  evaluationCyclesLoaded: [rows: GmKpiCycleOption[]]
}>()

/** «Năm đánh giá»: `GET /kpi/gm/kpi-cycles-for-evaluation` — chu kỳ kpi_cycles, year ≥ hiện tại. */
const evaluationCycleRows = ref<GmKpiCycleOption[]>([])
const evaluationCyclesLoading = ref(false)
const evaluationCyclesError = ref<string | null>(null)

async function loadEvaluationCycles() {
  evaluationCyclesLoading.value = true
  evaluationCyclesError.value = null
  try {
    evaluationCycleRows.value = await gmKpiService.getKpiCyclesForEvaluation()
    emit('evaluationCyclesLoaded', evaluationCycleRows.value)
  } catch (e: unknown) {
    evaluationCycleRows.value = []
    evaluationCyclesError.value = e instanceof Error ? e.message : 'Could not load evaluation cycles'
  } finally {
    evaluationCyclesLoading.value = false
  }
}

/** Dùng chu kỳ từ layout nếu đã có; tránh gọi trùng API khi mở drawer. */
async function ensureEvaluationCyclesForDrawer() {
  const pre = props.prefetchedEvaluationCycles
  if (Array.isArray(pre) && pre.length > 0) {
    evaluationCycleRows.value = [...pre]
    evaluationCyclesError.value = null
    evaluationCyclesLoading.value = false
    return
  }
  await loadEvaluationCycles()
}

const evaluationYearOptions = computed(() =>
  evaluationCycleRows.value.map((r) => ({
    id: r.id,
    label: String(r.year),
  })),
)

function resolveDefaultFormCycleUuid(): string {
  const rows = evaluationCycleRows.value
  const header = String(props.cycleId).trim()
  if (!rows.length) return header
  if (rows.some((r) => r.id === header)) return header
  if (/^\d+$/.test(header)) {
    const y = parseInt(header, 10)
    const match = rows.find((r) => r.year === y)
    if (match) return match.id
  }
  return rows[0]?.id ?? header
}

function resolveCurrentYearFormCycleUuid(): string {
  const rows = evaluationCycleRows.value
  const currentYear = new Date().getFullYear()
  const match = rows.find((r) => r.year === currentYear)
  return match?.id ?? resolveDefaultFormCycleUuid()
}

/** «Năm nguồn» sao chép: `GET /kpi/gm/kpi-cycles-with-kpis` (chỉ dữ liệu từ API). */
const copySourceCycleApiRows = ref<GmKpiCycleOption[]>([])
const copyCyclesLoading = ref(false)
const copyCyclesError = ref<string | null>(null)

const copySourceYearOptions = computed(() =>
  copySourceCycleApiRows.value.map((r) => {
    const y = String(r.year)
    return { id: y, label: y }
  }),
)

async function loadCopySourceCycles() {
  copyCyclesLoading.value = true
  copyCyclesError.value = null
  try {
    copySourceCycleApiRows.value = await gmKpiService.getKpiCyclesWithKpis()
  } catch (e: unknown) {
    copySourceCycleApiRows.value = []
    copyCyclesError.value = e instanceof Error ? e.message : 'Could not load KPI cycle list'
  } finally {
    copyCyclesLoading.value = false
  }
}

type StrategicKpiType = GmStrategicKpiKind

/** Dropdown = quy tắc (RULE). Radio = chiều so sánh khi rule có nhiều lựa chọn. */
const DEFAULT_CALCULATION_RULE_CODE = 802
const DEFAULT_CALCULATION_TYPE_CODE = 701

/** Mã `sys_status_codes` KPI_TYPE — mặc định 102 TEAM (Cascading). */
const kpiTypeCode = ref<number>(102)
const kpiType = computed<StrategicKpiType>({
  get: () => strategicKpiKindFromTypeCode(kpiTypeCode.value),
  set: (v) => {
    kpiTypeCode.value = typeCodeFromStrategicKpiKind(v)
  },
})

/** Cascading + Individual + Promotion đều có ô Target tổng (catalog); chỉ Team có thêm phân bổ PM. */
const needsStrategicTargetInput = computed(
  () =>
    kpiType.value === 'cascading' ||
    kpiType.value === 'individual' ||
    kpiType.value === 'promotion',
)

const kpiTypeRows = ref<KpiTypeOption[]>([])
const kpiTypesLoading = ref(false)
const kpiTypesError = ref<string | null>(null)

async function loadKpiTypes() {
  kpiTypesLoading.value = true
  kpiTypesError.value = null
  try {
    const rows = await apiGetStrategicKpiTypes()
    kpiTypeRows.value = Array.isArray(rows) ? rows : []
    const codes = new Set(kpiTypeRows.value.map((r) => r.code))
    if (!codes.has(kpiTypeCode.value)) {
      kpiTypeCode.value = kpiTypeRows.value[0]?.code ?? 102
    }
  } catch (e: unknown) {
    kpiTypeRows.value = []
    kpiTypesError.value = e instanceof Error ? e.message : 'Could not load KPI types'
  } finally {
    kpiTypesLoading.value = false
  }
}

const perspective = ref<string>('')

const { categories: kpiCategories, loading: kpiCategoriesLoading, error: kpiCategoriesError, load: loadKpiCategories } =
  useGmKpiCategoryOptions()
const {
  options: kpiUnitOptions,
  loading: kpiUnitsLoading,
  error: kpiUnitsError,
  load: loadKpiUnits,
} = useKpiUnitOptions()
const {
  calcRulesWithTypes,
  loading: calcRefLoading,
  error: calcRefError,
  load: loadCalculationReference,
} = useKpiCalculationReference()
const {
  users: pmUsers,
  loading: pmUsersLoading,
  error: pmUsersError,
  load: loadPmUsers,
} = useDepartmentManagerOptions()
const {
  ranks: rankRows,
  loading: ranksLoading,
  error: ranksError,
  load: loadRanks,
} = useRankOptions()

/** Checkbox rank — `val` = `ranks.code` (đồng bộ member mock / payload), sort tự nhiên R1 → R10. */
const rankOptionsForUi = computed(() =>
  [...rankRows.value]
    .sort((a, b) =>
      String(a.code ?? '').localeCompare(String(b.code ?? ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      }),
    )
    .map((r) => ({
      val: r.code,
      label: r.name,
    })),
)

/** Member theo `ranks.code` — tải từ `GET /kpi/reference/members-by-rank`. */
const membersByRankCache = ref<Record<string, MemberByRankOption[]>>({})
const membersByRankLoading = ref<Record<string, boolean>>({})
const membersByRankError = ref<Record<string, string | null>>({})

function clearMembersByRankState() {
  membersByRankCache.value = {}
  membersByRankLoading.value = {}
  membersByRankError.value = {}
}

function initialsFromFullName(name: string): string {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

function mapMemberByRankToDirect(m: MemberByRankOption): DirectMemberOption {
  const dept = m.departmentName?.trim() || '—'
  const rank = (m.rankCode && String(m.rankCode).trim()) || '—'
  return {
    val: m.id,
    short: m.fullName,
    label: `${m.fullName} — ${dept} · ${rank}`,
    dept,
    rank,
    avatar: initialsFromFullName(m.fullName),
  }
}

/** KPI Promotion — `GET /kpi/reference/promotion-assignees`. */
const promotionAssigneeRows = ref<MemberByRankOption[]>([])
const promotionAssigneesLoading = ref(false)
const promotionAssigneesError = ref<string | null>(null)

function clearPromotionAssigneeState() {
  promotionAssigneeRows.value = []
  promotionAssigneesLoading.value = false
  promotionAssigneesError.value = null
}

async function loadPromotionAssignees() {
  promotionAssigneesLoading.value = true
  promotionAssigneesError.value = null
  try {
    const rows = await apiGetPromotionAssignees()
    promotionAssigneeRows.value = Array.isArray(rows) ? rows : []
  } catch (e: unknown) {
    promotionAssigneeRows.value = []
    promotionAssigneesError.value =
      e instanceof Error ? e.message : 'Could not load people list (Promotion)'
  } finally {
    promotionAssigneesLoading.value = false
  }
}

const promotionAssigneeDirectOptions = computed(() => promotionAssigneeRows.value.map(mapMemberByRankToDirect))

async function ensureMembersLoadedForRank(rankCode: string) {
  const code = String(rankCode ?? '').trim()
  if (!code || membersByRankCache.value[code]) return
  membersByRankLoading.value = { ...membersByRankLoading.value, [code]: true }
  membersByRankError.value = { ...membersByRankError.value, [code]: null }
  try {
    const rows = await apiGetMembersByRank(code)
    membersByRankCache.value = { ...membersByRankCache.value, [code]: Array.isArray(rows) ? rows : [] }
  } catch (e: unknown) {
    membersByRankCache.value = { ...membersByRankCache.value, [code]: [] }
    membersByRankError.value = {
      ...membersByRankError.value,
      [code]: e instanceof Error ? e.message : 'Could not load member list',
    }
  } finally {
    membersByRankLoading.value = { ...membersByRankLoading.value, [code]: false }
  }
}

function isRankMemberListLoaded(rankCode: string): boolean {
  const code = String(rankCode ?? '').trim()
  return code !== '' && Object.prototype.hasOwnProperty.call(membersByRankCache.value, code)
}

/** Rank có ít nhất một member (sau khi đã tải xong); rank chưa tải hoặc đang tải → coi như không chọn được. */
function rankHasMembers(rankCode: string): boolean {
  const code = String(rankCode ?? '').trim()
  if (!code) return false
  if (membersByRankLoading.value[code]) return false
  if (!isRankMemberListLoaded(code)) return false
  return (membersByRankCache.value[code] ?? []).length > 0
}

function rankAssignCheckboxTitle(rankCode: string, rankLabel: string): string {
  const code = String(rankCode ?? '').trim()
  if (!code) return ''
  if (membersByRankLoading.value[code] || !isRankMemberListLoaded(code)) {
    return 'Loading members for this rank…'
  }
  if (!rankHasMembers(code)) return 'No members in this rank'
  const lab = String(rankLabel ?? '').trim()
  return lab || code
}

function pruneIndividualRanksWithoutMembers() {
  selectedRanks.value = selectedRanks.value.filter((r) => rankHasMembers(r))
  const next: Record<string, string[]> = { ...selectedRankMembers.value }
  for (const k of Object.keys(next)) {
    if (!rankHasMembers(k)) delete next[k]
  }
  selectedRankMembers.value = next
  expandedRankSections.value = expandedRankSections.value.filter((r) => rankHasMembers(r))
}

const prefetchIndividualRankMembersInFlight = ref(false)

const kpiName = ref('')
const description = ref('')
const targetValue = ref<string>('')
const unit = ref<string>('MM')
/** Đồng bộ `kpis_information.is_important` — không gửi mặc định true. */
const isImportantKpi = ref(false)
const weightPct = ref<string>('')
/** Dropdown «Phân loại cách tính» — mã quy tắc (RULE). */
const calculationRuleCode = ref(DEFAULT_CALCULATION_RULE_CODE)
/** Radio chiều tính theo quy tắc đã chọn (có thể null). */
const calculationTypeCode = ref<number | null>(DEFAULT_CALCULATION_TYPE_CODE)

const typesForSelectedRule = computed(
  () => calcRulesWithTypes.value.find((row) => row.code === calculationRuleCode.value)?.calcTypes ?? [],
)

/** UUID `kpi_cycles.id` — dropdown «Năm đánh giá» (đồng bộ DB). */
const formCycleId = ref('')

const selectedPMs = ref<string[]>([])
const pmTargets = ref<Record<string, string>>({})
const selectedRanks = ref<string[]>([])
const selectedMembers = ref<string[]>([])
const selectedRankMembers = ref<Record<string, string[]>>({})
const expandedRankSections = ref<string[]>([])
const individualRankMemberSearch = ref('')
/** Bộ lọc trong dropdown Assign To (Direct — Individual Members). */
const memberAssignSearch = ref('')

/** Snapshot dòng đang sửa — giữ khi lưu để gửi `editingKpiId` / tên cũ (parent có thể clear `editInitial` trước khi đóng). */
const editSessionSnapshot = ref<GmHierarchyKpi | null>(null)

const assignDropdown = ref<'pm' | 'member' | null>(null)
/** Chỉ vùng trigger + list (không gồm khối target PM bên dưới) — dùng cho đóng khi click ra ngoài. */
const assignPmSurfaceRef = ref<HTMLElement | null>(null)
const assignMemberSurfaceRef = ref<HTMLElement | null>(null)
const saving = ref(false)

/** Lỗi validate trước khi emit `saved` (mock / không gọi API). */
const formErrors = ref<Record<string, string>>({})
const errorBannerRef = ref<HTMLElement | null>(null)

function clearFormErrors() {
  formErrors.value = {}
}

function parseTargetInput(raw: string | number | null | undefined): number {
  const n = parseTrimmedTargetNumber(raw)
  return n != null && n >= 0 ? n : 0
}

const strategicTargetValueNum = computed(() => parseTargetInput(targetValue.value))

const selectedPmTargetsTotal = computed(() =>
  selectedPMs.value.reduce((sum, id) => sum + parseTargetInput(pmTargets.value[id]), 0),
)

const remainingTargetForGm = computed(() => {
  const remaining = strategicTargetValueNum.value - selectedPmTargetsTotal.value
  return remaining > 0 ? remaining : 0
})

const canShowAssignToMe = computed(
  () => isEditingFromDiagnostics.value && kpiType.value === 'cascading' && gmUserId.value !== '',
)

/** Tránh watch(kpiType) xóa assignment khi đang áp template “Sao chép KPI”. */
const isApplyingCopyTemplate = ref(false)
/** Tránh watch(kpiType) xóa PM khi hydrate form sửa. */
const isHydratingFromEdit = ref(false)

/** Tab tạo KPI (chỉ khi tạo mới): tùy chỉnh · từ bộ mẫu. */
const createTab = ref<'custom' | 'template'>('custom')
const templatePackages = ref<GmKpiTemplatePackageRow[]>([])
const templatePackageId = ref('')
const templateItems = ref<GmKpiTemplateItemRow[]>([])
const templatePackagesLoading = ref(false)
const templateItemsLoading = ref(false)
const templateApiError = ref<string | null>(null)
const templateSelectedKeys = ref<Set<string>>(new Set())
const savingTemplateBatch = ref(false)
const templateSelectAllInputRef = ref<HTMLInputElement | null>(null)

async function loadTemplatePackages() {
  templatePackagesLoading.value = true
  templateApiError.value = null
  try {
    const rows = await gmKpiService.getKpiTemplates()
    templatePackages.value = rows
    const cur = String(templatePackageId.value ?? '').trim()
    if (cur && !rows.some((r) => r.id === cur)) {
      templatePackageId.value = ''
      templateItems.value = []
    }
  } catch (e: unknown) {
    templatePackages.value = []
    templatePackageId.value = ''
    templateItems.value = []
    templateApiError.value =
      e instanceof Error ? e.message : 'Could not load KPI template packages.'
  } finally {
    templatePackagesLoading.value = false
  }
}

async function loadTemplateItemsForPackage(id: string) {
  const tid = String(id ?? '').trim()
  if (!tid) {
    templateItems.value = []
    return
  }
  templateItemsLoading.value = true
  templateApiError.value = null
  try {
    templateItems.value = await gmKpiService.getKpiTemplateItems(tid)
  } catch (e: unknown) {
    templateItems.value = []
    templateApiError.value =
      e instanceof Error ? e.message : 'Could not load KPIs in the template package.'
  } finally {
    templateItemsLoading.value = false
  }
}

type GmTemplateKpiPickRow = {
  key: string
  label: string
  kindLabel: string
  item: GmKpiTemplateItemRow
}

const templateKpiRows = computed<GmTemplateKpiPickRow[]>(() =>
  templateItems.value.map((it) => ({
    key: it.templateItemId,
    label: it.masterCode?.trim() ? `${it.masterCode.trim()} · ${it.masterName}` : it.masterName,
    kindLabel: templateKindRowLabelFromTypeCode(it.typeCode),
    item: it,
  })),
)

/** Giống `buildDisplayGroups` trên Strategic KPIs Tracking & Diagnostics: category khi có `categoryId`, không thì 4 khía cạnh BSC (theo mock). */
type GmTemplateKpiDisplayGroup = { key: string; label: string; rows: GmTemplateKpiPickRow[] }

const templateKpiDisplayGroups = computed<GmTemplateKpiDisplayGroup[]>(() => {
  const rows = templateKpiRows.value
  if (!rows.length) return []

  const useCategory = rows.some((r) => Boolean(String(r.item.categoryId ?? '').trim()))
  if (useCategory) {
    const meta = new Map<string, { label: string; rows: GmTemplateKpiPickRow[] }>()
    for (const r of rows) {
      const id = String(r.item.categoryId ?? '').trim() || 'uncategorized'
      const label = String(r.item.categoryName ?? '').trim() || 'Uncategorized'
      if (!meta.has(id)) meta.set(id, { label, rows: [] })
      meta.get(id)!.rows.push(r)
    }
    return [...meta.entries()]
      .sort((a, b) => a[1].label.localeCompare(b[1].label, 'vi'))
      .map(([key, v]) => ({ key, label: v.label, rows: v.rows }))
  }

  const byBsc = new Map<GmBscPerspective, GmTemplateKpiPickRow[]>()
  for (const id of GM_BSC_ORDER) byBsc.set(id, [])
  for (const r of rows) {
    const p = normalizeGmBscPerspective(r.item.diagnosticsFallbackGroup)
    byBsc.get(p)!.push(r)
  }
  return GM_BSC_ORDER.map((perspective) => ({
    key: perspective,
    label: GM_BSC_LABELS[perspective],
    rows: byBsc.get(perspective)!,
  })).filter((g) => g.rows.length > 0)
})

function templateKindRowLabelFromTypeCode(typeCode: number): string {
  const kind = strategicKpiKindFromTypeCode(typeCode)
  if (kind === 'cascading') return 'CASCADING'
  if (kind === 'individual') return 'INDIVIDUAL'
  return 'PROMOTION'
}

const templateSelectAllChecked = computed(() => {
  const keys = templateKpiRows.value.map((r) => r.key)
  if (!keys.length) return false
  return keys.every((k) => templateSelectedKeys.value.has(k))
})

const templateSelectAllIndeterminate = computed(() => {
  const keys = templateKpiRows.value.map((r) => r.key)
  if (!keys.length) return false
  const n = keys.filter((k) => templateSelectedKeys.value.has(k)).length
  return n > 0 && n < keys.length
})

watch(
  [templateSelectAllChecked, templateSelectAllIndeterminate, templateKpiRows],
  () => {
    void nextTick(() => {
      const el = templateSelectAllInputRef.value
      if (!el) return
      el.indeterminate = templateSelectAllIndeterminate.value
      el.checked = templateSelectAllChecked.value
    })
  },
  { flush: 'post' },
)

function toggleTemplateSelectAll() {
  const keys = templateKpiRows.value.map((r) => r.key)
  if (templateSelectAllChecked.value) templateSelectedKeys.value = new Set()
  else templateSelectedKeys.value = new Set(keys)
}

function toggleTemplateRowKey(key: string) {
  const next = new Set(templateSelectedKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  templateSelectedKeys.value = next
}

watch(templatePackageId, (id) => {
  templateSelectedKeys.value = new Set()
  void loadTemplateItemsForPackage(String(id ?? ''))
})

watch(
  () => props.editInitial,
  () => {
    createTab.value = 'custom'
  },
)

function buildPayloadFromTemplateApiItem(it: GmKpiTemplateItemRow): Record<string, unknown> | null {
  const cid = String(it.categoryId ?? '').trim()
  if (!cid) return null
  const typeCode = it.typeCode
  if (!Number.isFinite(typeCode)) return null
  const unitCode = it.unitCode
  if (!Number.isFinite(unitCode)) return null
  const kind = strategicKpiKindFromTypeCode(typeCode)
  const calculationMethod = persistedCalculationMethodFromTypeAndRule(
    it.calculationTypeCode ?? null,
    it.calculationRuleCode ?? 802,
  )
  let parsedTargetDesc = emptyScoringRulesPayload()
  if (it.targetDescription) {
    if (typeof it.targetDescription === 'string') {
      try {
        const parsed = JSON.parse(it.targetDescription)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          parsedTargetDesc = parsed as any
        }
      } catch (e) {
        console.warn('Failed to parse targetDescription string:', e)
      }
    } else if (typeof it.targetDescription === 'object') {
      parsedTargetDesc = it.targetDescription as any
    }
  }

  const base: Record<string, unknown> = {
    cycleId: resolveCurrentYearFormCycleUuid(),
    typeCode,
    perspective: cid,
    kpiName: String(it.masterName ?? '').trim() || 'KPI',
    targetDescription: parsedTargetDesc,
    targetValue: it.defaultTargetValue != null ? Number(it.defaultTargetValue) : null,
    unitCode,
    weightPct: it.defaultWeight != null ? String(it.defaultWeight) : '0',
    calculationMethod,
    isImportant: false,
  }
  if (kind === 'cascading') {
    base.assignPMs = [] as string[]
    base.pmTargets = {} as Record<string, string>
  } else if (kind === 'individual') {
    base.memberIds = [] as string[]
  } else {
    base.memberIds = [] as string[]
  }
  return base
}

async function confirmTemplateBatchCreate() {
  if (!String(templatePackageId.value ?? '').trim()) {
    clearFormErrors()
    formErrors.value = { template: 'Please select a KPI template package first.' }
    await nextTick()
    errorBannerRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    return
  }
  const rows = templateKpiRows.value.filter((r) => templateSelectedKeys.value.has(r.key))
  if (!rows.length) {
    clearFormErrors()
    formErrors.value = { template: 'Select at least one KPI in the package.' }
    await nextTick()
    errorBannerRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    return
  }
  clearFormErrors()
  savingTemplateBatch.value = true
  const payloads: Record<string, unknown>[] = []
  for (const row of rows) {
    const p = buildPayloadFromTemplateApiItem(row.item)
    if (p) payloads.push(p)
  }
  savingTemplateBatch.value = false
  if (payloads.length === 0) {
    formErrors.value = { template: 'Could not build payload from the selected template.' }
    return
  }
  emit('saved', payloads)
  open.value = false
}

/** Dropdown sao chép — năm nguồn + KPI (theo năm). */
const copySourceYear = ref(String(new Date().getFullYear()))
const copyFromId = ref('')
const copyKpiPickerOpen = ref(false)
const copyKpiFilterQuery = ref('')
const copyKpiPickerSurfaceRef = ref<HTMLElement | null>(null)
const copyKpiPickerSearchRef = ref<HTMLInputElement | null>(null)

/** Dropdown «Nhóm KPI»: `GET /kpi/gm/kpi-categories` + dòng đang sửa nếu chưa có trong danh sách. */
const perspectiveOptions = computed((): { value: string; label: string }[] => {
  const opts = kpiCategories.value.map((c) => ({ value: c.id, label: c.name }))
  const snap = editSessionSnapshot.value
  const cid = snap?.categoryId?.trim() ?? ''
  const cname = snap?.categoryName?.trim() ?? ''
  if (cid && cname && !opts.some((o) => o.value === cid)) {
    opts.unshift({ value: cid, label: cname })
  }
  return opts
})

/** KPI diagnostics theo «Năm nguồn» — `GET /kpi/gm/diagnostics-hierarchy?year=`. */
const copyKpiHierarchyRows = ref<GmHierarchyKpi[]>([])
const copyKpisLoading = ref(false)
const copyKpisError = ref<string | null>(null)

async function loadCopyKpisForSourceYear() {
  const y = Number.parseInt(String(copySourceYear.value).trim(), 10)
  if (!Number.isFinite(y)) {
    copyKpiHierarchyRows.value = []
    return
  }
  copyKpisLoading.value = true
  copyKpisError.value = null
  try {
    const data = await gmKpiService.getDiagnosticsHierarchy(y)
    copyKpiHierarchyRows.value = mapGmDiagnosticsApiKpisToHierarchyRows(data.kpis)
  } catch (e: unknown) {
    copyKpiHierarchyRows.value = []
    copyKpisError.value = e instanceof Error ? e.message : 'Could not load KPI list for the year'
  } finally {
    copyKpisLoading.value = false
  }
}

/** Danh sách KPI để sao chép — theo năm nguồn đã chọn (API). */
const copyKpiListForYear = computed(() =>
  copyKpiHierarchyRows.value.map((kpi) => ({
    id: kpi.id,
    label: String(kpi.name ?? '').trim() || kpi.id,
  })),
)

const copyKpiSelectedLabel = computed(() => {
  if (!copyFromId.value) return ''
  const row = copyKpiListForYear.value.find((o) => o.id === copyFromId.value)
  return row?.label ?? ''
})

const filteredCopyKpisForPicker = computed(() => {
  const q = copyKpiFilterQuery.value.trim().toLowerCase()
  const rows = copyKpiListForYear.value
  if (!q) return rows
  return rows.filter((o) => {
    const hay = `${o.label} ${o.id}`.toLowerCase()
    return hay.includes(q)
  })
})

watch(copySourceYear, async () => {
  copyFromId.value = ''
  copyKpiPickerOpen.value = false
  copyKpiFilterQuery.value = ''
  if (!open.value || isEditingFromDiagnostics.value) return
  await loadCopyKpisForSourceYear()
})

function closeCopyKpiPicker() {
  if (!copyKpiPickerOpen.value) return
  copyKpiPickerOpen.value = false
  copyKpiFilterQuery.value = ''
}

function toggleCopyKpiPicker() {
  const next = !copyKpiPickerOpen.value
  copyKpiPickerOpen.value = next
  if (next) {
    assignDropdown.value = null
    copyKpiFilterQuery.value = ''
    void nextTick(() => copyKpiPickerSearchRef.value?.focus())
  } else {
    copyKpiFilterQuery.value = ''
  }
}

function selectCopyKpiFromPicker(id: string) {
  if (!id) return
  copyFromId.value = id
  applyCopyFromKpi(id)
  closeCopyKpiPicker()
}

function applyCopyFromKpi(id: string) {
  assignDropdown.value = null
  if (!id) return
  const kpi = copyKpiHierarchyRows.value.find((r) => r.id === id)
  if (!kpi) return
  isApplyingCopyTemplate.value = true
  formCycleId.value = String(props.cycleId)
  fillCreateFormFieldsFromHierarchyKpi(kpi)
  isApplyingCopyTemplate.value = false
  if (normalizeStrategicKpiKind(kpi.kpiType) === 'individual') {
    void loadRanks()
  } else if (normalizeStrategicKpiKind(kpi.kpiType) === 'promotion') {
    void loadPromotionAssignees()
  }
  const apiIdForCopy = parseDiagnosticsKpiInformationId(kpi)
  if (!apiIdForCopy) return
  void gmKpiService
    .getStrategicKpiForEdit(apiIdForCopy)
    .then((data) => {
      const cm = String(data.calculationMethod ?? '').trim()
      if (cm) hydrateCalculationFromPersisted(cm)
      description.value = extractRawInputFromApiTargetDescription(data.targetDescription)
    })
    .catch(() => {
      // Giữ giá trị công thức / quy tắc chấm điểm hiện tại nếu không tải được dữ liệu chi tiết KPI nguồn.
    })
}

const assignLabel = computed(() => {
  if (kpiType.value === 'promotion') return 'Assign To Individuals'
  if (kpiType.value === 'individual') return 'Assign To Ranks / Roles'
  return 'Assign to department manager'
})

/** Tooltip cho công thức đang chọn (select + icon). */
const selectedFormulaExpression = computed(() => {
  const ruleRow = calcRulesWithTypes.value.find((row) => row.code === calculationRuleCode.value)
  if (!ruleRow) return 'Select a calculation rule.'
  const parts = [ruleRow.label]
  const types = typesForSelectedRule.value
  const typeRow = types.find((t) => t.code === calculationTypeCode.value)
  if (types.length > 1 && typeRow) parts.push(`Comparison: ${typeRow.label}.`)
  else if (types.length === 1 && typeRow) parts.push(`Comparison: ${typeRow.label}.`)
  return parts.join(' — ')
})

/** Rule COMMENT (803) — không dùng CALC_TYPE (703 đã bỏ). */
const COMMENT_RULE_CODE = 803

function clampCalculationTypeToRule() {
  if (calculationRuleCode.value === COMMENT_RULE_CODE) {
    calculationTypeCode.value = null
    return
  }
  const types = typesForSelectedRule.value
  if (!types.length) {
    calculationTypeCode.value = null
    return
  }
  const cur = calculationTypeCode.value
  if (cur != null && types.some((t) => t.code === cur)) return
  calculationTypeCode.value = types[0]!.code
}

function resolvePersistedCalculationMethod(): string {
  return persistedCalculationMethodFromTypeAndRule(calculationTypeCode.value, calculationRuleCode.value)
}

/** Áp `calculationMethod` đã lưu / mẫu sao chép → state form. */
function hydrateCalculationFromPersisted(cm: string) {
  const { calculationTypeCode: tc, calculationRuleCode: rc } = codesFromPersistedCalculationMethod(cm)
  calculationRuleCode.value = rc
  calculationTypeCode.value = tc
  clampCalculationTypeToRule()
}

const filteredMemberOptions = computed(() => {
  const q = memberAssignSearch.value.trim().toLowerCase()
  const base = promotionAssigneeDirectOptions.value
  if (!q) return base
  return base.filter((m) => {
    const hay = `${m.short} ${m.dept} ${m.rank} ${m.val} ${m.label}`.toLowerCase()
    return hay.includes(q)
  })
})

function memberByVal(id: string) {
  const row = promotionAssigneeDirectOptions.value.find((m) => m.val === id)
  if (row) return row
  return {
    val: id,
    short: String(id).slice(0, 8),
    label: id,
    dept: '—',
    rank: '—',
    avatar: initialsFromFullName(String(id)),
  }
}

function membersByRank(rank: string): DirectMemberOption[] {
  const raw = membersByRankCache.value[rank] ?? []
  return raw.map(mapMemberByRankToDirect)
}

const individualRankCards = computed(() => {
  const query = individualRankMemberSearch.value.trim().toLowerCase()

  return selectedRanks.value.map((rank) => {
    const rankMeta = rankRows.value.find((item) => item.code === rank)
    const allMembers = membersByRank(rank)
    const loadingMembers = !!membersByRankLoading.value[rank]
    const membersLoadError = membersByRankError.value[rank] ?? null
    const members = !query
      ? allMembers
      : allMembers.filter((member) => {
          const haystack = `${member.short} ${member.dept} ${member.rank} ${member.label}`.toLowerCase()
          return haystack.includes(query)
        })
    const defaultIds = allMembers.map((member) => member.val)
    const selectedIds = selectedRankMembers.value[rank] ?? defaultIds
    return {
      rank,
      label: rankMeta?.name ?? rank,
      allMembers,
      members,
      selectedIds,
      selectedCount: selectedIds.length,
      totalCount: allMembers.length,
      isExpanded: expandedRankSections.value.includes(rank),
      loadingMembers,
      membersLoadError,
    }
  })
})

function selectedRankMemberCount(rank: string) {
  return (selectedRankMembers.value[rank] ?? []).length
}

function totalRankMemberCount(rank: string) {
  return membersByRank(rank).length
}

function isRankFullySelected(rank: string) {
  const total = totalRankMemberCount(rank)
  return total > 0 && selectedRankMemberCount(rank) === total
}

function isRankPartiallySelected(rank: string) {
  const selected = selectedRankMemberCount(rank)
  const total = totalRankMemberCount(rank)
  return selected > 0 && selected < total
}

function typeCardClassForCode(code: number) {
  const base =
    'relative cursor-pointer rounded-lg border p-3 text-left transition-all hover:border-blue-300'
  const selected = kpiTypeCode.value === code
  if (!selected) return `${base} border-slate-200 bg-white`
  if (code === 103) return `${base} border-purple-500 bg-purple-50`
  return `${base} border-blue-500 bg-blue-50`
}

function applyFeedbackPmOnlyToAssignSelection() {
  if (!isGmFeedbackCascadingAllocationReview.value) return
  const uid = feedbackAssigneeUserId.value
  if (!uid) return
  selectedPMs.value = [uid]
  const tv = String(pmTargets.value[uid] ?? '').trim()
  pmTargets.value = { [uid]: tv }
  assignDropdown.value = null
}

function applyFeedbackMemberOnlyToAssignSelection() {
  if (!isDirectFeedbackSplitEdit.value) return
  const uid = feedbackAssigneeUserId.value
  if (!uid) return
  if (kpiType.value === 'promotion') {
    selectedMembers.value = [uid]
    assignDropdown.value = null
    return
  }
  if (kpiType.value !== 'individual') return
  const nextRanks: string[] = []
  const nextMap: Record<string, string[]> = {}
  for (const rank of selectedRanks.value) {
    const picked = (selectedRankMembers.value[rank] ?? []).filter((id) => id === uid)
    if (picked.length) {
      nextRanks.push(rank)
      nextMap[rank] = picked
    }
  }
  selectedRanks.value = nextRanks
  selectedRankMembers.value = nextMap
  expandedRankSections.value = [...nextRanks]
  assignDropdown.value = null
}

function togglePm(val: string) {
  if (isGmFeedbackCascadingAllocationReview.value) return
  const i = selectedPMs.value.indexOf(val)
  if (i === -1) {
    selectedPMs.value = [...selectedPMs.value, val]
    if (!(val in pmTargets.value)) pmTargets.value = { ...pmTargets.value, [val]: '' }
  } else {
    selectedPMs.value = selectedPMs.value.filter((v) => v !== val)
    const { [val]: _, ...rest } = pmTargets.value
    pmTargets.value = rest
  }
}

function assignRemainingToMe() {
  if (!canShowAssignToMe.value || remainingTargetForGm.value <= 0) return
  const me = gmUserId.value
  if (!me) return
  if (!selectedPMs.value.includes(me)) {
    selectedPMs.value = [...selectedPMs.value, me]
  }
  const cur = parseTargetInput(pmTargets.value[me])
  pmTargets.value = {
    ...pmTargets.value,
    [me]: String(cur + remainingTargetForGm.value),
  }
}

const USER_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function formatPmOptionLabel(u: DepartmentManagerOption): string {
  const u0 = u.username?.trim()
  const base = u0 ? `${u.fullName} (${u0})` : u.fullName
  const depts = u.managingDepartmentsLabel?.trim()
  if (depts) return `${base} — ${depts}`
  return base
}

/** Chip / target row — ưu tiên dữ liệu từ API `department-managers`; chưa có thì rút gọn UUID hoặc chuỗi legacy. */
function pmSelectionKey(pm: Pick<GmHierarchyPm, 'ownerUserId' | 'id' | 'name'>): string {
  return String(pm.ownerUserId || '').trim() || String(pm.id || '').trim() || String(pm.name || '').trim()
}

function normalizeUniqueDepartmentManagerIds(ids: string[]): string[] {
  const validManagerIds = new Set(pmUsers.value.map((u) => String(u.id ?? '').trim()).filter(Boolean))
  const selfId = gmUserId.value
  if (selfId) validManagerIds.add(selfId)
  const fallbackKeepAll = validManagerIds.size === 0
  const seen = new Set<string>()
  const result: string[] = []
  for (const rawId of ids) {
    const id = String(rawId ?? '').trim()
    if (!id || seen.has(id)) continue
    if (!fallbackKeepAll && !validManagerIds.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result
}

function pmChipLabel(id: string): string {
  if (id === gmUserId.value) {
    return authStore.user?.fullName?.trim() || authStore.user?.name || 'Me'
  }
  const row = pmUsers.value.find((x) => x.id === id)
  if (row) return formatPmOptionLabel(row)
  if (USER_ID_UUID_RE.test(id)) return `User ${id.slice(0, 8)}…`
  return id
}

async function toggleRank(val: string) {
  if (isDirectFeedbackSplitEdit.value) return
  const i = selectedRanks.value.indexOf(val)
  if (i === -1) {
    if (!rankHasMembers(val)) return
    selectedRanks.value = [...selectedRanks.value, val]
    await ensureMembersLoadedForRank(val)
    const members = membersByRank(val)
    selectedRankMembers.value = {
      ...selectedRankMembers.value,
      [val]: members.map((member) => member.val),
    }
    if (!expandedRankSections.value.includes(val)) {
      expandedRankSections.value = [...expandedRankSections.value, val]
    }
    return
  }

  selectedRanks.value = selectedRanks.value.filter((v) => v !== val)
  const nextMembers = { ...selectedRankMembers.value }
  delete nextMembers[val]
  selectedRankMembers.value = nextMembers
  expandedRankSections.value = expandedRankSections.value.filter((v) => v !== val)
}

function toggleMember(val: string) {
  if (isDirectFeedbackSplitEdit.value) return
  const i = selectedMembers.value.indexOf(val)
  if (i === -1) selectedMembers.value = [...selectedMembers.value, val]
  else selectedMembers.value = selectedMembers.value.filter((v) => v !== val)
}

function toggleRankMember(rank: string, memberId: string) {
  if (isDirectFeedbackSplitEdit.value) return
  const current = selectedRankMembers.value[rank] ?? []
  const exists = current.includes(memberId)
  selectedRankMembers.value = {
    ...selectedRankMembers.value,
    [rank]: exists ? current.filter((id) => id !== memberId) : [...current, memberId],
  }
}

function isRankMemberSelected(rank: string, memberId: string) {
  return (selectedRankMembers.value[rank] ?? []).includes(memberId)
}

function toggleRankSection(rank: string) {
  if (expandedRankSections.value.includes(rank)) {
    expandedRankSections.value = expandedRankSections.value.filter((item) => item !== rank)
    return
  }
  expandedRankSections.value = [...expandedRankSections.value, rank]
}

function pmSelected(val: string) {
  return selectedPMs.value.includes(val)
}

function toggleAssignPmDropdown() {
  assignDropdown.value = assignDropdown.value === 'pm' ? null : 'pm'
}

function onDocClick(e: MouseEvent) {
  const t = e.target
  if (!(t instanceof Node)) return
  const copySurf = copyKpiPickerSurfaceRef.value
  if (copyKpiPickerOpen.value && (!copySurf || !copySurf.contains(t))) {
    copyKpiPickerOpen.value = false
    copyKpiFilterQuery.value = ''
  }
  const dd = assignDropdown.value
  if (!dd) return
  const surfaceEl =
    dd === 'pm' ? assignPmSurfaceRef.value : dd === 'member' ? assignMemberSurfaceRef.value : null
  if (!surfaceEl || !surfaceEl.contains(t)) assignDropdown.value = null
}

function extractPlainKpiName(displayName: string): string {
  const s = String(displayName ?? '').trim()
  const m = /^[A-Z][\w.]*\s*·\s*(.+)$/i.exec(s)
  return m ? m[1]!.trim() : s
}

function extractLeadingNumberFromText(s: string): string {
  const m = /(\d+(?:\.\d+)?)/.exec(String(s ?? '').replace(/\u00a0/g, ' '))
  return m ? m[1]! : ''
}

/** Điền form tạo KPI từ một dòng diagnostics (dùng cho sửa từ bảng và cho sao chép nhanh). */
function fillCreateFormFieldsFromHierarchyKpi(kpi: GmHierarchyKpi) {
  clearFormErrors()
  kpiTypeCode.value = typeCodeFromStrategicKpiKind(normalizeStrategicKpiKind(kpi.kpiType))
  perspective.value =
    kpi.categoryId && String(kpi.categoryId).trim()
      ? String(kpi.categoryId).trim()
      : kpiCategories.value[0]?.id ?? ''
  const plainName = (kpi.investigateKpiName?.trim() || extractPlainKpiName(kpi.name)).trim()
  kpiName.value = plainName || String(kpi.name ?? '').trim()
  description.value = ''
  weightPct.value = String(kpi.weight ?? '')
    .replace(/%/g, '')
    .trim()

  if (kpiType.value === 'cascading') {
    const fromPm = kpi.pmOwners[0]?.target
    const raw = extractLeadingNumberFromText(fromPm ?? '') || extractLeadingNumberFromText(kpi.target)
    targetValue.value = raw
    unit.value = kpiUnitCodeToFormUnit(kpi.unitCode)
    selectedPMs.value = normalizeUniqueDepartmentManagerIds(kpi.pmOwners.map(pmSelectionKey).filter(Boolean))
    const nextPm: Record<string, string> = {}
    for (const p of kpi.pmOwners) {
      const key = pmSelectionKey(p)
      if (!selectedPMs.value.includes(key)) continue
      const n = extractLeadingNumberFromText(p.target)
      if (n) nextPm[key] = n
    }
    pmTargets.value = nextPm
  } else {
    const raw = extractLeadingNumberFromText(kpi.target ?? '')
    targetValue.value = raw
    unit.value = kpiUnitCodeToFormUnit(kpi.unitCode)
    selectedPMs.value = []
    pmTargets.value = {}
  }

  hydrateCalculationFromPersisted('mean_actual_plan')
  selectedRanks.value = []
  selectedMembers.value = []
  selectedRankMembers.value = {}
  expandedRankSections.value = []
  memberAssignSearch.value = ''
  isImportantKpi.value = kpi.isImportant === true
}

function hydrateFormFromHierarchyKpi(kpi: GmHierarchyKpi) {
  isHydratingFromEdit.value = true
  editSessionSnapshot.value = kpi
  copyFromId.value = ''
  copyKpiPickerOpen.value = false
  copyKpiFilterQuery.value = ''
  formCycleId.value = String(props.cycleId)
  fillCreateFormFieldsFromHierarchyKpi(kpi)
  void nextTick(() => {
    isHydratingFromEdit.value = false
  })
}

function weightPctStringFromApi(w: unknown): string {
  if (typeof w === 'number' && Number.isFinite(w)) return String(w)
  return String(w ?? '')
    .replace(/%/g, '')
    .trim()
}

async function distributeIndividualMembersFromServerIds(memberIds: string[]) {
  /** Luôn tải ranks trước — nếu `memberIds` rỗng (KPI từ template chưa giao) mà return sớm thì không gọi API → UI rank trống. */
  await loadRanks()
  const idSet = new Set(memberIds.map((x) => String(x).trim()).filter(Boolean))
  if (idSet.size === 0) {
    selectedRanks.value = []
    selectedRankMembers.value = {}
    expandedRankSections.value = []
    return
  }
  const nextRanks: string[] = []
  const nextMap: Record<string, string[]> = {}
  for (const opt of rankOptionsForUi.value) {
    const code = String(opt.val ?? '').trim()
    if (!code) continue
    await ensureMembersLoadedForRank(code)
    const members = membersByRankCache.value[code] ?? []
    const picked = members.filter((m) => idSet.has(String(m.id).trim())).map((m) => String(m.id).trim())
    if (picked.length) {
      nextRanks.push(code)
      nextMap[code] = picked
    }
  }
  selectedRanks.value = nextRanks
  selectedRankMembers.value = nextMap
  expandedRankSections.value = [...nextRanks]
}

async function hydrateFormFromStrategicKpiEditData(data: GmStrategicKpiEditData, kpiRow: GmHierarchyKpi) {
  isHydratingFromEdit.value = true
  editSessionSnapshot.value = kpiRow
  copyFromId.value = ''
  copyKpiPickerOpen.value = false
  copyKpiFilterQuery.value = ''
  clearFormErrors()
  strategicEditDetailError.value = null

  formCycleId.value = String(data.cycleId ?? '').trim()
  kpiTypeCode.value =
    typeof data.typeCode === 'number' && Number.isFinite(data.typeCode)
      ? data.typeCode
      : Number.parseInt(String(data.typeCode ?? '102'), 10) || 102
  perspective.value =
    data.perspective && String(data.perspective).trim()
      ? String(data.perspective).trim()
      : kpiCategories.value[0]?.id ?? ''
  kpiName.value = String(data.kpiName ?? '').trim()
  description.value = extractRawInputFromApiTargetDescription(data.targetDescription)
  weightPct.value = weightPctStringFromApi(data.weightPct)

  if (kpiTypeCode.value === 102 || kpiTypeCode.value === 101 || kpiTypeCode.value === 103) {
    const tv = data.targetValue
    if (tv != null && tv !== '' && Number.isFinite(Number(tv))) {
      targetValue.value = String(tv)
    } else {
      targetValue.value = ''
    }
  } else {
    targetValue.value = ''
  }

  unit.value = kpiUnitCodeToFormUnit(data.unitCode)
  hydrateCalculationFromPersisted(String(data.calculationMethod ?? 'mean_actual_plan').trim())
  isImportantKpi.value = data.isImportant === true
  selectedPMs.value = []
  pmTargets.value = {}
  selectedRanks.value = []
  selectedMembers.value = []
  selectedRankMembers.value = {}
  expandedRankSections.value = []
  individualRankMemberSearch.value = ''
  memberAssignSearch.value = ''

  if (kpiTypeCode.value === 102) {
    const rawPm = data.pmTargets ?? {}
    const feedbackUid = feedbackAssigneeUserId.value
    if (isGmFeedbackCascadingAllocationReview.value && feedbackUid) {
      selectedPMs.value = [feedbackUid]
      const v = rawPm[feedbackUid]
      pmTargets.value = {
        [feedbackUid]:
          v != null && v !== ''
            ? typeof v === 'number' && Number.isFinite(v)
              ? String(v)
              : String(v).trim()
            : '',
      }
    } else {
      selectedPMs.value = normalizeUniqueDepartmentManagerIds(
        (data.assignPMs ?? []).map((u) => String(u).trim()).filter(Boolean),
      )
      const selectedPmSet = new Set(selectedPMs.value)
      const nextPm: Record<string, string> = {}
      for (const [k, v] of Object.entries(rawPm)) {
        const key = String(k ?? '').trim()
        if (!key || !selectedPmSet.has(key) || v == null || v === '') continue
        nextPm[key] = typeof v === 'number' && Number.isFinite(v) ? String(v) : String(v).trim()
      }
      pmTargets.value = nextPm
    }
  } else if (kpiTypeCode.value === 101) {
    const fromMemberIds = (data.memberIds ?? []).map((u) => String(u).trim()).filter(Boolean)
    const fromMemberTargets = Object.keys((data as { memberTargets?: Record<string, unknown> }).memberTargets ?? {})
      .map((u) => String(u).trim())
      .filter(Boolean)
    const splitMemberId = feedbackAssigneeUserId.value
    const merged = splitMemberId
      ? [splitMemberId]
      : [...new Set([...fromMemberIds, ...fromMemberTargets])]
    await distributeIndividualMembersFromServerIds(merged)
  } else if (kpiTypeCode.value === 103) {
    const splitMemberId = feedbackAssigneeUserId.value
    selectedMembers.value = splitMemberId
      ? [splitMemberId]
      : (data.memberIds ?? []).map((u) => String(u).trim()).filter(Boolean)
  }

  await nextTick(() => {
    isHydratingFromEdit.value = false
    if (isGmFeedbackCascadingAllocationReview.value) {
      applyFeedbackPmOnlyToAssignSelection()
    }
    if (isDirectFeedbackSplitEdit.value) {
      applyFeedbackMemberOnlyToAssignSelection()
    }
  })
}

watch(kpiType, () => {
  if (isApplyingCopyTemplate.value || isHydratingFromEdit.value) return
  assignDropdown.value = null
  selectedPMs.value = []
  pmTargets.value = {}
  clearMembersByRankState()
  selectedRanks.value = []
  selectedMembers.value = []
  selectedRankMembers.value = {}
  expandedRankSections.value = []
  individualRankMemberSearch.value = ''
  memberAssignSearch.value = ''
  const allowedRules = new Set(calcRulesWithTypes.value.map((row) => row.code))
  if (!allowedRules.has(calculationRuleCode.value)) {
    calculationRuleCode.value = calcRulesWithTypes.value[0]?.code ?? DEFAULT_CALCULATION_RULE_CODE
    calculationTypeCode.value = DEFAULT_CALCULATION_TYPE_CODE
  }
  clampCalculationTypeToRule()
  if (kpiType.value === 'individual' && open.value) {
    void loadRanks()
  } else if (kpiType.value === 'promotion' && open.value) {
    void loadPromotionAssignees()
  }
})

/** Tải member từng rank để biết rank nào rỗng → disable checkbox (chỉ KPI individual). */
watch(
  () => [open.value, kpiType.value, ranksLoading.value, rankRows.value] as const,
  async ([isOpen, kind, rLoading, rows]) => {
    if (!isOpen || kind !== 'individual' || rLoading || !rows.length) return
    if (prefetchIndividualRankMembersInFlight.value) return
    prefetchIndividualRankMembersInFlight.value = true
    try {
      const opts = rankOptionsForUi.value
      await Promise.all(opts.map((o) => ensureMembersLoadedForRank(String(o.val ?? '').trim())))
      if (!open.value || kpiType.value !== 'individual') return
      pruneIndividualRanksWithoutMembers()
    } finally {
      prefetchIndividualRankMembersInFlight.value = false
    }
  },
)

watch(calculationRuleCode, () => {
  clampCalculationTypeToRule()
})

watch(
  calcRulesWithTypes,
  (rows) => {
    if (!rows.length) return
    if (!rows.some((r) => r.code === calculationRuleCode.value)) {
      calculationRuleCode.value = rows[0]!.code
    }
    clampCalculationTypeToRule()
  },
  { deep: true },
)

watch(assignDropdown, (v) => {
  if (v !== 'member') memberAssignSearch.value = ''
  if (v) closeCopyKpiPicker()
})

function resetForm() {
  clearMembersByRankState()
  clearPromotionAssigneeState()
  copyFromId.value = ''
  formCycleId.value = resolveDefaultFormCycleUuid()

  const rows = evaluationCycleRows.value
  const headerYear =
    rows.find((r) => r.id === formCycleId.value)?.year ?? new Date().getFullYear()

  const copyOpts = copySourceYearOptions.value
  const copyIds = new Set(copyOpts.map((c) => c.id))
  const hy = String(headerYear)
  const resolvedCopyYear =
    copyOpts.length === 0 ? hy : copyIds.has(hy) ? hy : String(copyOpts[0]!.id)
  copySourceYear.value = resolvedCopyYear
  kpiType.value = 'cascading'
  perspective.value = kpiCategories.value[0]?.id ?? ''
  kpiName.value = ''
  description.value = ''
  targetValue.value = ''
  unit.value = 'MM'
  isImportantKpi.value = false
  weightPct.value = ''
  calculationRuleCode.value = DEFAULT_CALCULATION_RULE_CODE
  calculationTypeCode.value = DEFAULT_CALCULATION_TYPE_CODE
  selectedPMs.value = []
  pmTargets.value = {}
  selectedRanks.value = []
  selectedMembers.value = []
  selectedRankMembers.value = {}
  expandedRankSections.value = []
  individualRankMemberSearch.value = ''
  memberAssignSearch.value = ''
  copyKpiPickerOpen.value = false
  copyKpiFilterQuery.value = ''
  createTab.value = 'custom'
  templatePackageId.value = ''
  templatePackages.value = []
  templateItems.value = []
  templateApiError.value = null
  templateSelectedKeys.value = new Set()
  clearFormErrors()
}

watch(open, async (v) => {
  if (v) {
    await Promise.all([
      loadKpiCategories(),
      loadKpiTypes(),
      loadCopySourceCycles(),
      ensureEvaluationCyclesForDrawer(),
      loadKpiUnits(),
      loadCalculationReference(),
      loadPmUsers(),
    ])
    if (props.editInitial) {
      createTab.value = 'custom'
      strategicEditDetailError.value = null
      const apiIdForEdit = parseDiagnosticsKpiInformationId(props.editInitial)
      if (apiIdForEdit) {
        strategicEditDetailLoading.value = true
        try {
          const data = await gmKpiService.getStrategicKpiForEdit(apiIdForEdit)
          await hydrateFormFromStrategicKpiEditData(data, props.editInitial)
        } catch (e: unknown) {
          strategicEditDetailError.value =
            e instanceof Error ? e.message : 'Could not load KPI data for editing'
          hydrateFormFromHierarchyKpi(props.editInitial)
        } finally {
          strategicEditDetailLoading.value = false
        }
      } else {
        hydrateFormFromHierarchyKpi(props.editInitial)
      }
      const kind = normalizeStrategicKpiKind(props.editInitial.kpiType)
      if (kind === 'individual' && !apiIdForEdit) {
        await loadRanks()
      } else if (kind === 'promotion') {
        await loadPromotionAssignees()
      }
    } else {
      resetForm()
      await loadCopyKpisForSourceYear()
      await loadTemplatePackages()
    }
    window.addEventListener('click', onDocClick)
  } else {
    editSessionSnapshot.value = null
    strategicEditDetailLoading.value = false
    strategicEditDetailError.value = null
    window.removeEventListener('click', onDocClick)
    assignDropdown.value = null
    copyKpiPickerOpen.value = false
    copyKpiFilterQuery.value = ''
    clearPromotionAssigneeState()
  }
})

watch(
  () => props.cycleId,
  (id) => {
    if (!open.value) return
    const t = String(id ?? '').trim()
    if (!t) return
    if (evaluationCycleRows.value.some((r) => r.id === t)) {
      formCycleId.value = t
    }
  },
)

watch(
  () => rankRows.value,
  (rows) => {
    if (!rows.length) return
    const codes = new Set(rows.map((r) => r.code))
    selectedRanks.value = selectedRanks.value.filter((c) => codes.has(c))
    const next: Record<string, string[]> = { ...selectedRankMembers.value }
    for (const k of Object.keys(next)) {
      if (!codes.has(k)) delete next[k]
    }
    selectedRankMembers.value = next
    expandedRankSections.value = expandedRankSections.value.filter((k) => codes.has(k))

    const nextCache: Record<string, MemberByRankOption[]> = { ...membersByRankCache.value }
    const nextLoad: Record<string, boolean> = { ...membersByRankLoading.value }
    const nextErr: Record<string, string | null> = { ...membersByRankError.value }
    for (const k of Object.keys(nextCache)) {
      if (!codes.has(k)) {
        delete nextCache[k]
        delete nextLoad[k]
        delete nextErr[k]
      }
    }
    membersByRankCache.value = nextCache
    membersByRankLoading.value = nextLoad
    membersByRankError.value = nextErr
  },
)

onUnmounted(() => {
  window.removeEventListener('click', onDocClick)
})

function close() {
  open.value = false
}

function validateForm(): boolean {
  clearFormErrors()
  const err: Record<string, string> = {}

  if (!kpiName.value.trim()) {
    err.kpiName = 'Please enter a KPI name.'
  }

  if (!String(perspective.value).trim()) {
    err.perspective = 'Select a KPI group (kpi_categories).'
  }

  if (evaluationYearOptions.value.length === 0) {
    err.formCycleId =
      evaluationCyclesError.value || 'No KPI cycle (year ≥ current year) is configured.'
  } else if (!String(formCycleId.value).trim()) {
    err.formCycleId = 'Select an evaluation cycle (KPI year).'
  }

  if (needsStrategicTargetInput.value) {
    const targetErr = validateNonNegativeTargetValue(targetValue.value, { required: true })
    if (targetErr) err.targetValue = targetErr
  }

  const wStr = String(weightPct.value).trim()
  const wNum = Number.parseFloat(wStr)
  if (!wStr) {
    err.weightPct = 'Enter weight (%).'
  } else if (!Number.isFinite(wNum) || wNum <= 0 || wNum > 100) {
    err.weightPct = 'Weight must be between 1 and 100.'
  }

  const ruleOpts = calcRulesWithTypes.value
  if (!ruleOpts.some((row) => row.code === calculationRuleCode.value)) {
    err.calculationMethod = 'Select a calculation rule.'
  } else {
    const types = typesForSelectedRule.value
    if (types.length > 0) {
      const tc = calculationTypeCode.value
      if (tc == null || !types.some((t) => t.code === tc)) {
        err.calculationMethod = 'Select a calculation direction.'
      }
    }
  }

  const descTrim = description.value.trim()
  if (!descTrim) {
    err.scoringRules = 'Enter scoring rules (levels 1–5 per syntax).'
  } else {
    const vr = validateScoringRulesDsl(description.value)
    if (!vr.ok) {
      err.scoringRules = vr.errors.join(' ')
    }
  }

  if (kpiType.value === 'cascading' && selectedPMs.value.length > 0) {
    const pmsToValidate = isGmFeedbackCascadingAllocationReview.value
      ? visibleSelectedPMs.value
      : selectedPMs.value
    const batchErr = validateNonNegativeTargetBatch(
      pmsToValidate.map((pmId) => ({
        raw: pmTargets.value[pmId],
        label: pmChipLabel(pmId),
      })),
      { requireAllFilled: true },
    )
    if (batchErr) {
      err.pmTargets =
        batchErr === 'Enter a target for each selected assignee.'
          ? 'PMs selected — enter a separate target for each PM'
          : batchErr
    }
  }

  if (isDirectFeedbackSplitEdit.value && !feedbackAssigneeUserId.value) {
    err.assign = 'Cannot identify the member who sent feedback.'
  }

  formErrors.value = err
  return Object.keys(err).length === 0
}

function pmTargetRowHasValidationIssue(pmId: string): boolean {
  if (!formErrors.value.pmTargets) return false
  return targetRowHasValidationIssue(pmTargets.value[pmId], { required: true })
}

async function save() {
  if (!validateForm()) {
    await nextTick()
    errorBannerRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    return
  }

  saving.value = true
  const payload: Record<string, unknown> = {
    typeCode: kpiTypeCode.value,
    /** UUID `kpi_categories.id` — nhóm KPI trên DB (tên field legacy `perspective`). */
    perspective: perspective.value,
    kpiName: kpiName.value,
    targetDescription: description.value.trim()
      ? buildScoringRulesPayload(description.value)
      : null,
    targetValue: needsStrategicTargetInput.value
      ? Number.parseFloat(String(targetValue.value).trim())
      : null,
    unit: unit.value,
    unitCode: kpiFormUnitToUnitCode(unit.value),
    weightPct: weightPct.value,
    cycleId: formCycleId.value,
    calculationMethod: resolvePersistedCalculationMethod(),
    isImportant: isImportantKpi.value,
  }
  if (kpiType.value === 'cascading') {
    payload.assignPMs = [...selectedPMs.value]
    payload.pmTargets = { ...pmTargets.value }
  } else if (kpiType.value === 'individual') {
    payload.ranks = [...selectedRanks.value]
    payload.rankMemberIds = { ...selectedRankMembers.value }
    payload.memberIds = Object.values(selectedRankMembers.value).flat()
  } else {
    payload.memberIds = [...selectedMembers.value]
  }

  const feedbackSplitAssignmentId = String(props.feedbackAssignmentId ?? '').trim()
  const feedbackSplitMemberId = feedbackAssigneeUserId.value
  if (isDirectFeedbackSplitEdit.value && feedbackSplitAssignmentId && feedbackSplitMemberId) {
    payload.memberIds = [feedbackSplitMemberId]
    if (kpiType.value === 'individual') {
      const filteredRankMemberIds: Record<string, string[]> = {}
      for (const [rank, ids] of Object.entries(selectedRankMembers.value)) {
        const picked = ids.filter((id) => id === feedbackSplitMemberId)
        if (picked.length > 0) filteredRankMemberIds[rank] = picked
      }
      payload.rankMemberIds = filteredRankMemberIds
      payload.ranks = Object.keys(filteredRankMemberIds)
    }
    payload.feedbackSplitAssignmentId = feedbackSplitAssignmentId
  }

  const editSnap = editSessionSnapshot.value
  if (editSnap && !payload.feedbackSplitAssignmentId) {
    payload.editingKpiId = editSnap.id
    payload.previousInvestigateKpiName =
      editSnap.investigateKpiName?.trim() || extractPlainKpiName(editSnap.name)
    if (editSnap.investigateDeptId) payload.editingDeptId = editSnap.investigateDeptId
  }

  await new Promise((r) => setTimeout(r, 500))
  saving.value = false
  emit('saved', payload)
  open.value = false
}
</script>

<template>
  <Teleport to="body">
    <Transition name="gm-kpi-drawer">
      <div
        v-if="open"
        class="fixed inset-0 z-[100]"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="isEditingFromDiagnostics ? 'gm-edit-kpi-title' : 'gm-create-kpi-title'"
      >
        <div
          class="gm-kpi-drawer-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
          @click="close"
        />

        <div
          class="gm-kpi-drawer-panel absolute bottom-0 right-0 top-0 flex w-full max-w-full flex-col border-l border-slate-200 bg-slate-50 shadow-2xl md:max-w-[700px] lg:max-w-[800px]"
        >
          <!-- Drawer Header -->
          <div class="z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2
                :id="isEditingFromDiagnostics ? 'gm-edit-kpi-title' : 'gm-create-kpi-title'"
                class="flex items-center gap-2 text-lg font-bold text-slate-800"
              >
                <span class="rounded-lg bg-blue-100 p-1.5 text-blue-700 shadow-sm">
                  <i class="fas fa-bullseye text-sm" />
                </span>
                {{ isEditingFromDiagnostics ? 'Edit strategic KPI' : 'Create Strategic KPI' }}
              </h2>
              <p class="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {{
                  isEditingFromDiagnostics
                    ? 'Edit strategic KPI details'
                    : 'Define organization-level targets'
                }}
              </p>
            </div>
            <button
              type="button"
              class="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
              aria-label="Close"
              @click="close"
            >
              <i class="fas fa-times text-base" />
            </button>
          </div>

          <!-- Tab: tạo tùy chỉnh · từ template (chỉ khi tạo mới) -->
          <div
            v-if="!isEditingFromDiagnostics"
            class="shrink-0 border-b border-slate-200 bg-white px-5 pb-4 pt-1"
          >
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                :class="[
                  'flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-xs font-bold transition-all',
                  createTab === 'custom'
                    ? 'border-blue-500 bg-blue-50/90 text-blue-800 shadow-sm ring-1 ring-blue-100'
                    : 'border-transparent bg-slate-100/80 text-slate-600 hover:border-slate-200 hover:bg-slate-50',
                ]"
                @click="createTab = 'custom'"
              >
                <i class="fas fa-pen-to-square" aria-hidden="true" />
                Create custom KPI
              </button>
              <button
                type="button"
                :class="[
                  'flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-xs font-bold transition-all',
                  createTab === 'template'
                    ? 'border-blue-500 bg-blue-50/90 text-blue-800 shadow-sm ring-1 ring-blue-100'
                    : 'border-transparent bg-slate-100/80 text-slate-600 hover:border-slate-200 hover:bg-slate-50',
                ]"
                @click="createTab = 'template'"
              >
                <i class="fas fa-table-columns" aria-hidden="true" />
                From template
              </button>
            </div>
          </div>

          <!-- Drawer Body -->
          <div class="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-6">
            <p
              v-if="strategicEditDetailLoading"
              class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
              role="status"
            >
              Loading KPI data from server…
            </p>
            <p
              v-else-if="strategicEditDetailError"
              class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"
              role="alert"
            >
              {{ strategicEditDetailError }} — showing cached diagnostics row; verify assignees before
              saving.
            </p>
            <div
              v-if="Object.keys(formErrors).length > 0"
              id="gm-create-kpi-errors"
              ref="errorBannerRef"
              class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900 shadow-sm"
              role="alert"
            >
              <p class="mb-2 flex items-center gap-2 font-bold">
                <i class="fas fa-circle-exclamation text-rose-600" aria-hidden="true" />
                {{ isEditingFromDiagnostics ? 'Please fix the following before saving.' : 'Please fix the following before creating the KPI.' }}
              </p>
              <ul class="list-inside list-disc space-y-0.5 text-[11px] font-semibold text-rose-800">
                <li v-for="(msg, key) in formErrors" :key="key">{{ msg }}</li>
              </ul>
            </div>

            <div v-show="isEditingFromDiagnostics || createTab === 'custom'" class="space-y-6">
            <!-- Sao chép KPI — chỉ khi tạo mới -->
            <div
              v-if="!isEditingFromDiagnostics"
              class="rounded-lg border border-indigo-100 bg-indigo-50/90 p-4 shadow-sm ring-1 ring-indigo-100"
            >
              <div class="mb-3 flex items-center gap-2 text-indigo-900">
                <i class="fas fa-copy text-xs" aria-hidden="true" />
                <p class="text-[10px] font-bold uppercase tracking-wider">
                  Quick copy from existing KPI
                </p>
              </div>
              <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div class="w-full shrink-0 sm:w-36">
                  <label
                    for="gm-copy-source-year"
                    class="mb-1 block text-[9px] font-bold uppercase tracking-wider text-indigo-900/85"
                  >
                    Source year
                  </label>
                  <p v-if="copyCyclesError" class="mb-1 text-[9px] font-semibold text-rose-600">
                    {{ copyCyclesError }}
                  </p>
                  <div class="relative">
                    <select
                      id="gm-copy-source-year"
                      v-model="copySourceYear"
                      :disabled="copyCyclesLoading"
                      class="w-full cursor-pointer appearance-none rounded-lg border border-indigo-200 bg-white py-2 pl-3 pr-9 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option v-for="c in copySourceYearOptions" :key="c.id" :value="c.id">
                        {{ c.label }}
                      </option>
                    </select>
                    <i
                      class="fas fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                      aria-hidden="true"
                    />
                  </div>
                </div>
                <div class="min-w-0 flex-1">
                  <label
                    for="gm-copy-kpi-select"
                    class="mb-1 block text-[9px] font-bold uppercase tracking-wider text-indigo-900/85"
                  >
                    KPI
                  </label>
                  <p v-if="copyKpisError" class="mb-1 text-[9px] font-semibold text-rose-600">
                    {{ copyKpisError }}
                  </p>
                  <div ref="copyKpiPickerSurfaceRef" class="relative">
                    <button
                      id="gm-copy-kpi-select"
                      type="button"
                      :disabled="copyKpisLoading"
                      class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-white py-2 pl-3 pr-3 text-left text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                      :class="copyFromId ? 'font-medium text-slate-800' : 'font-medium text-slate-500'"
                      :aria-expanded="copyKpiPickerOpen"
                      aria-haspopup="listbox"
                      aria-controls="gm-copy-kpi-listbox"
                      @click.stop="toggleCopyKpiPicker()"
                    >
                      <span class="min-w-0 flex-1 truncate">
                        {{
                          copyFromId
                            ? copyKpiSelectedLabel
                            : '-- Select a KPI to load details & assignment --'
                        }}
                      </span>
                      <i
                        class="fas fa-chevron-down shrink-0 text-[10px] text-slate-400 transition-transform duration-150"
                        :class="{ 'rotate-180': copyKpiPickerOpen }"
                        aria-hidden="true"
                      />
                    </button>
                    <div
                      v-show="copyKpiPickerOpen"
                      id="gm-copy-kpi-listbox"
                      role="listbox"
                      class="absolute left-0 right-0 z-[60] mt-1 flex max-h-72 flex-col overflow-hidden rounded-lg border border-indigo-200 bg-white shadow-xl ring-1 ring-indigo-100/80"
                      @click.stop
                      @keydown.escape.stop.prevent="closeCopyKpiPicker()"
                    >
                      <div
                        class="sticky top-0 z-10 shrink-0 border-b border-indigo-100 bg-indigo-50/80 p-2"
                        @click.stop
                      >
                        <div class="relative">
                          <i
                            class="fas fa-search pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                            aria-hidden="true"
                          />
                          <input
                            ref="copyKpiPickerSearchRef"
                            v-model="copyKpiFilterQuery"
                            type="search"
                            autocomplete="off"
                            placeholder="Type KPI name to filter…"
                            class="w-full rounded-md border border-indigo-200 bg-white py-1.5 pl-8 pr-2 text-xs font-medium text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                            @click.stop
                          />
                        </div>
                      </div>
                      <div class="custom-scrollbar max-h-52 flex-1 overflow-y-auto p-1">
                        <button
                          v-for="o in filteredCopyKpisForPicker"
                          :key="o.id"
                          type="button"
                          role="option"
                          class="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-800 outline-none transition hover:bg-indigo-50 focus-visible:bg-indigo-50"
                          :class="
                            copyFromId === o.id
                              ? 'bg-indigo-100/80 text-indigo-950 ring-1 ring-indigo-200'
                              : ''
                          "
                          :aria-selected="copyFromId === o.id"
                          @click="selectCopyKpiFromPicker(o.id)"
                        >
                          {{ o.label }}
                        </button>
                        <p
                          v-if="filteredCopyKpisForPicker.length === 0"
                          class="px-3 py-6 text-center text-xs font-medium text-slate-500"
                        >
                          <template v-if="copyKpiFilterQuery.trim()">
                            No KPIs match “{{ copyKpiFilterQuery.trim() }}”.
                          </template>
                          <template v-else> No KPIs in the list. </template>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Thông tin cơ bản & phân loại -->
            <div class="gm-kpi-section-card rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <label class="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-800">
                <span class="rounded-lg bg-slate-100 p-1.5 text-indigo-600">
                  <i class="fas fa-file-lines text-sm" />
                </span>
                Basic information &amp; classification
              </label>
              <div class="space-y-4">
                <div class="flex flex-col gap-3 sm:flex-row">
                  <div class="sm:w-1/3">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      KPI group (kpi_categories) <span class="text-rose-500">*</span>
                    </label>
                    <p v-if="kpiCategoriesError" class="mb-1 text-[10px] font-semibold text-rose-600">
                      {{ kpiCategoriesError }}
                    </p>
                    <div class="relative">
                      <select
                        v-model="perspective"
                        :disabled="kpiCategoriesLoading"
                        class="input-required w-full cursor-pointer appearance-none rounded-md py-2 pl-3 pr-8 text-xs font-bold text-slate-800 outline-none transition-all disabled:cursor-not-allowed disabled:opacity-60"
                        :class="formErrors.perspective ? '!border-rose-400 !bg-rose-50/50' : ''"
                      >
                        <option value="" disabled>{{ kpiCategoriesLoading ? 'Loading…' : '— Select group —' }}</option>
                        <option v-for="o in perspectiveOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
                      </select>
                      <i class="fas fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400" />
                    </div>
                    <p v-if="formErrors.perspective" class="mt-1 text-[10px] font-semibold text-rose-600">
                      {{ formErrors.perspective }}
                    </p>
                  </div>
                  <div class="min-w-0 sm:flex-1">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      KPI Name <span class="text-rose-500">*</span>
                    </label>
                    <input
                      v-model="kpiName"
                      type="text"
                      placeholder="e.g. Enterprise Delivery Rate"
                      class="input-required w-full rounded-md px-3 py-2 text-xs font-bold text-slate-800 outline-none transition-all"
                      :class="formErrors.kpiName ? '!border-rose-400 !bg-rose-50/50' : ''"
                    />
                    <p v-if="formErrors.kpiName" class="mt-1 text-[10px] font-semibold text-rose-600">
                      {{ formErrors.kpiName }}
                    </p>
                  </div>
                </div>

                <div>
                  <label class="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    KPI assignment type <span class="text-rose-500">*</span>
                  </label>
                  <p v-if="kpiTypesError" class="mb-2 text-[10px] font-semibold text-rose-600">{{ kpiTypesError }}</p>
                  <p v-else-if="kpiTypesLoading" class="mb-2 text-[10px] font-medium text-slate-500">
                    Loading KPI types…
                  </p>
                  <div
                    class="grid grid-cols-1 gap-3"
                    :class="[
                      kpiTypeRows.length <= 1 ? '' : kpiTypeRows.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3',
                    ]"
                  >
                    <button
                      v-for="opt in kpiTypeRows"
                      :key="opt.code"
                      type="button"
                      :disabled="kpiTypesLoading || strategicEditDetailLoading"
                      :class="typeCardClassForCode(opt.code)"
                      @click="kpiTypeCode = opt.code"
                    >
                      <div class="mb-1.5 flex items-center gap-2">
                        <span class="rounded border border-slate-100 bg-slate-50 p-1 shadow-sm">
                          <i :class="strategicKpiTypeIconClass(opt.code)" />
                        </span>
                        <span class="text-xs font-bold leading-snug text-slate-800">{{
                          opt.description || opt.name
                        }}</span>
                      </div>
                    </button>
                  </div>
                  <p
                    v-if="!kpiTypesLoading && !kpiTypesError && kpiTypeRows.length === 0"
                    class="mt-2 text-[11px] font-medium text-amber-800"
                  >
                    No KPI type data (KPI_TYPE group in the system).
                  </p>
                </div>

                <div
                  class="grid grid-cols-1 gap-4"
                  :class="needsStrategicTargetInput ? 'sm:grid-cols-2 sm:gap-x-6' : ''"
                >
                  <div v-if="needsStrategicTargetInput" class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Target <span class="text-rose-500">*</span>
                    </label>
                    <input
                      v-model="targetValue"
                      type="number"
                      placeholder="95"
                      min="0"
                      class="input-required min-h-[38px] w-full rounded-md px-2.5 py-2 text-xs font-bold text-slate-800 outline-none transition-all"
                      :class="formErrors.targetValue ? '!border-rose-400 !bg-rose-50/50' : ''"
                    />
                    <p v-if="formErrors.targetValue" class="mt-1 text-[10px] font-semibold text-rose-600">
                      {{ formErrors.targetValue }}
                    </p>
                  </div>
                  <div class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Weight <span class="text-rose-500">*</span>
                    </label>
                    <div class="relative">
                      <input
                        v-model="weightPct"
                        type="number"
                        placeholder="30"
                        min="1"
                        max="100"
                        class="input-required min-h-[38px] w-full rounded-md py-2 pl-2.5 pr-6 text-xs font-bold text-slate-800 outline-none transition-all"
                        :class="formErrors.weightPct ? '!border-rose-400 !bg-rose-50/50' : ''"
                      />
                      <span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-blue-400">%</span>
                    </div>
                    <p v-if="formErrors.weightPct" class="mt-1 text-[10px] font-semibold text-rose-600">
                      {{ formErrors.weightPct }}
                    </p>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-6">
                  <div class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Unit <span class="text-rose-500">*</span>
                    </label>
                    <p v-if="kpiUnitsError" class="mb-1 text-[10px] font-semibold text-amber-700">
                      {{ kpiUnitsError }}
                    </p>
                    <div class="relative">
                      <select
                        v-model="unit"
                        class="input-required min-h-[38px] w-full cursor-pointer appearance-none rounded-md py-2 pl-2.5 pr-7 text-xs font-bold text-slate-800 outline-none transition-all"
                        :disabled="kpiUnitsLoading"
                      >
                        <option v-for="u in kpiUnitOptions" :key="u.value" :value="u.value">{{ u.label }}</option>
                      </select>
                      <i class="fas fa-chevron-down pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400" />
                    </div>
                  </div>
                  <div class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Evaluation year <span class="text-rose-500">*</span>
                    </label>
                    <p v-if="evaluationCyclesError" class="mb-1 text-[10px] font-semibold text-amber-700">
                      {{ evaluationCyclesError }}
                    </p>
                    <div class="relative w-full">
                      <select
                        v-model="formCycleId"
                        class="input-required min-h-[38px] w-full cursor-pointer appearance-none rounded-md py-2 pl-2.5 pr-7 text-xs font-bold text-slate-800 outline-none transition-all"
                        :class="formErrors.formCycleId ? '!border-rose-400 !bg-rose-50/50' : ''"
                        :disabled="evaluationCyclesLoading || evaluationYearOptions.length === 0"
                      >
                        <option v-for="c in evaluationYearOptions" :key="c.id" :value="c.id">
                          {{ c.label }}
                        </option>
                      </select>
                      <i class="fas fa-chevron-down pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400" />
                    </div>
                    <p v-if="formErrors.formCycleId" class="mt-1 text-[10px] font-semibold text-rose-600">
                      {{ formErrors.formCycleId }}
                    </p>
                  </div>
                </div>

                <label
                  class="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  <input
                    v-model="isImportantKpi"
                    type="checkbox"
                    class="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400/40"
                  />
                  <span>Important KPI</span>
                </label>

                <!-- Phân loại cách tính: quy tắc (dropdown) + chiều tính (radio khi có) -->
                <div>
                  <p v-if="calcRefError" class="mb-1 text-[10px] font-semibold text-amber-700">
                    {{ calcRefError }}
                  </p>
                  <div class="mb-1.5 flex items-center gap-1.5">
                    <label class="block flex-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Calculation type <span class="text-rose-500">*</span>
                    </label>
                    <span
                      class="inline-flex shrink-0 cursor-help text-slate-400 transition-colors hover:text-blue-600"
                      :title="selectedFormulaExpression"
                      tabindex="0"
                      role="note"
                      aria-label="Selected formula expression"
                    >
                      <i class="fas fa-circle-question text-[12px]" aria-hidden="true" />
                    </span>
                  </div>
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
                    <div
                      class="relative min-w-0 w-full sm:min-w-[22rem] md:min-w-[26rem] lg:min-w-[28rem] sm:flex-[1.35]"
                    >
                      <select
                        v-model.number="calculationRuleCode"
                        class="input-required min-h-[38px] w-full cursor-pointer appearance-none rounded-md py-2 pr-7 text-xs font-bold text-slate-800 outline-none transition-all"
                        :class="[
                          typesForSelectedRule.length > 1 ? 'pl-8' : 'pl-2.5',
                          formErrors.calculationMethod ? '!border-rose-400 !bg-rose-50/50' : '',
                        ]"
                        :disabled="calcRefLoading"
                        :title="selectedFormulaExpression"
                      >
                        <option
                          v-for="row in calcRulesWithTypes"
                          :key="row.code"
                          :value="row.code"
                          :title="row.label"
                        >
                          {{ row.label }}
                        </option>
                      </select>
                      <i
                        v-if="typesForSelectedRule.length > 1"
                        class="fas fa-calculator pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                        aria-hidden="true"
                      />
                      <i class="fas fa-chevron-down pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400" />
                    </div>
                    <div
                      v-if="typesForSelectedRule.length > 1"
                      class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-slate-200/90 bg-slate-50/70 px-2.5 py-2"
                    >
                      <label
                        v-for="t in typesForSelectedRule"
                        :key="t.code"
                        class="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-700"
                      >
                        <input
                          v-model.number="calculationTypeCode"
                          type="radio"
                          name="gm-kpi-calc-type"
                          :value="t.code"
                          class="h-3.5 w-3.5 border-slate-300 text-slate-700 focus:ring-slate-400/40"
                        />
                        {{ t.label }}
                      </label>
                    </div>
                  </div>
                  <p v-if="formErrors.calculationMethod" class="mt-1 text-[10px] font-semibold text-rose-600">
                    {{ formErrors.calculationMethod }}
                  </p>
                </div>

                <div>
                  <div class="mb-1.5 flex items-center gap-1.5">
                    <label class="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Scoring rules <span class="text-rose-500">*</span>
                    </label>
                    <ScoringRulesHelpTooltip aria-label="Scoring rules syntax example" />
                  </div>
                  <textarea
                    v-model="description"
                    rows="5"
                    placeholder="1: &lt;50&#10;2: 50-70&#10;3: 71-85&#10;4: 86-99&#10;5: &gt;=100"
                    class="custom-scrollbar min-h-[7.5rem] w-full resize-y rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none transition-all focus:ring-2"
                    :class="
                      formErrors.scoringRules
                        ? '!border-rose-400 !bg-rose-50/70 focus:border-rose-400 focus:ring-rose-100'
                        : 'input-required focus:border-blue-400 focus:ring-blue-100'
                    "
                  />
                  <p v-if="formErrors.scoringRules" class="mt-1 text-[10px] font-semibold text-rose-600">
                    {{ formErrors.scoringRules }}
                  </p>
                </div>
              </div>
            </div>

          <!-- Phân bổ / Giao việc -->
          <div
            v-show="isEditingFromDiagnostics || createTab === 'custom'"
            class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div class="mb-3 flex items-center justify-between gap-2">
              <label class="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-800">
                <span class="rounded-lg bg-slate-100 p-1.5 text-indigo-600">
                  <i class="fas fa-diagram-project text-sm" />
                </span>
                Assignment &amp; rollout
              </label>
            </div>

            <div>
              <template v-if="!isGmFeedbackCascadingAllocationReview && !isDirectFeedbackSplitEdit">
                <div class="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <label class="block min-w-0 flex-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {{ assignLabel }}
                    <span class="text-[9px] font-semibold text-slate-400"> (Optional)</span>
                  </label>
                  <button
                    v-if="canShowAssignToMe"
                    type="button"
                    class="inline-flex shrink-0 items-center gap-1 rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-[10px] font-bold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="remainingTargetForGm <= 0"
                    @click="assignRemainingToMe"
                  >
                    <i class="fas fa-user-check text-[10px]" />
                    Assign to me
                  </button>
                </div>
                <p
                  v-if="canShowAssignToMe"
                  class="mb-2 text-[10px] font-semibold tabular-nums leading-snug text-slate-600"
                  title="Target KPI · Assigned · For GM"
                >
                  <span class="font-bold text-slate-800">{{ strategicTargetValueNum }}</span>
                  <span class="mx-1 text-slate-300">/</span>
                  <span>{{ selectedPmTargetsTotal }} Assigned</span>
                  <span class="mx-1 text-slate-300">·</span>
                  <span :class="remainingTargetForGm > 0 ? 'text-emerald-700' : 'text-slate-500'">
                    GM +{{ remainingTargetForGm }}
                  </span>
                </p>
              </template>

              <!-- Cascading: PM multi — ref chỉ bọc trigger + list; khối target nằm ngoài để click đóng list -->
              <div v-if="kpiType === 'cascading'" class="space-y-3">
                <p
                  v-if="isGmFeedbackCascadingAllocationReview"
                  class="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] font-semibold leading-snug text-amber-900"
                >
                  Only the PM who sent feedback is shown. You may adjust their target; other managers cannot be added or removed.
                </p>
                <template v-if="!isGmFeedbackCascadingAllocationReview">
                <div ref="assignPmSurfaceRef" class="relative">
                  <button
                    type="button"
                    class="input-optional relative flex min-h-[38px] w-full flex-wrap items-center gap-1.5 rounded-md py-1.5 pl-8 pr-7 text-left text-xs font-bold text-slate-700 transition-all"
                    @click.stop="toggleAssignPmDropdown"
                  >
                    <span class="w-full font-medium text-slate-400">
                      {{
                        selectedPMs.length === 0
                          ? 'Select one or more department managers…'
                          : `${selectedPMs.length} manager(s) selected — click to add more; remove from the list below`
                      }}
                    </span>
                  </button>
                  <i class="fas fa-users pointer-events-none absolute left-2.5 top-2.5 text-[10px] text-slate-400" />
                  <i class="fas fa-chevron-down pointer-events-none absolute right-2.5 top-2.5 text-[10px] text-slate-400" />

                  <div
                    v-show="assignDropdown === 'pm'"
                    class="custom-scrollbar absolute left-0 z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl"
                    @click.stop
                  >
                    <p
                      v-if="pmUsersError"
                      class="border-b border-amber-100 bg-amber-50 px-4 py-2 text-[11px] text-amber-900"
                    >
                      {{ pmUsersError }}
                    </p>
                    <div v-if="pmUsersLoading" class="px-4 py-3 text-xs font-medium text-slate-500">
                      Loading department managers…
                    </div>
                    <template v-else>
                      <label
                        v-for="opt in pmUsers"
                        :key="opt.id"
                        class="group flex cursor-pointer items-center border-b border-slate-100 px-4 py-2.5 transition-colors last:border-0"
                        :class="
                          isFeedbackAssignee(opt.id)
                            ? 'bg-amber-50/90 hover:bg-amber-100/70'
                            : 'hover:bg-slate-50'
                        "
                      >
                        <input
                          type="checkbox"
                          class="mr-3 h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          :checked="pmSelected(opt.id)"
                          @change="togglePm(opt.id)"
                        />
                        <span
                          class="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-bold text-slate-700 group-hover:text-blue-600"
                        >
                          <span class="truncate">{{ formatPmOptionLabel(opt) }}</span>
                          <span
                            v-if="isFeedbackAssignee(opt.id)"
                            class="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800"
                            title="Processing feedback for this person"
                          >
                            <i class="fas fa-comment-dots text-[8px]" />
                            Feedback
                          </span>
                        </span>
                      </label>
                      <p v-if="pmUsers.length === 0" class="px-4 py-3 text-xs text-slate-500">
                        No departments have an assigned manager.
                      </p>
                    </template>
                  </div>
                </div>
                </template>

                <div
                  v-if="visibleSelectedPMs.length > 0"
                  class="space-y-2 rounded-xl border border-blue-100 bg-blue-50/50 p-4 shadow-inner"
                  :class="isGmFeedbackCascadingAllocationReview ? 'border-amber-200 bg-amber-50/40' : ''"
                >
                  <p class="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase text-blue-800">
                    <i class="fas fa-crosshairs text-[10px]" />
                    {{
                      isGmFeedbackCascadingAllocationReview
                        ? 'PM feedback — assigned manager'
                        : 'Targets per manager'
                    }}
                  </p>
                  <p v-if="formErrors.pmTargets" class="mb-2 text-[11px] font-semibold leading-snug text-rose-600">
                    {{ formErrors.pmTargets }}
                  </p>
                  <div
                    v-for="pm in visibleSelectedPMs"
                    :key="pm"
                    class="flex flex-col justify-between gap-2 rounded-lg border p-2.5 shadow-sm sm:flex-row sm:items-center sm:gap-3"
                    :class="
                      isFeedbackAssignee(pm)
                        ? 'border-amber-300 bg-amber-50 ring-1 ring-amber-200'
                        : 'border-slate-200 bg-white'
                    "
                  >
                    <span class="flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-slate-700 sm:w-[38%]">
                      <i class="fas fa-user shrink-0 text-[10px] text-slate-400" />
                      <span class="truncate">{{ pmChipLabel(pm) }}</span>
                      <span
                        v-if="isFeedbackAssignee(pm)"
                        class="ml-1 inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800"
                        title="Processing feedback for this person"
                      >
                        <i class="fas fa-comment-dots text-[8px]" />
                        Feedback
                      </span>
                    </span>
                    <div class="flex min-w-0 flex-1 items-center gap-2">
                      <input
                        v-model="pmTargets[pm]"
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Enter target..."
                        :disabled="isGmFeedbackCascadingAllocationReview && !isFeedbackAssignee(pm)"
                        class="min-w-0 flex-1 rounded-md border bg-white px-2 py-1 text-xs font-bold text-slate-800 outline-none transition-all focus:ring-1 focus:ring-blue-100"
                        :class="
                          pmTargetRowHasValidationIssue(pm)
                            ? 'border-rose-400 focus:border-rose-500'
                            : 'border-slate-200 focus:border-blue-400'
                        "
                      />
                      <span class="shrink-0 text-[10px] font-bold text-slate-400">{{ unit }}</span>
                      <button
                        v-if="!isGmFeedbackCascadingAllocationReview"
                        type="button"
                        class="shrink-0 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700 transition-colors hover:bg-rose-100"
                        @click="togglePm(pm)"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Independent: rank chips + member override -->
              <div v-else-if="kpiType === 'individual'" class="space-y-4">
                <p
                  v-if="isDirectFeedbackSplitEdit"
                  class="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] font-semibold leading-snug text-amber-900"
                >
                  Only the member who sent feedback is shown. You cannot assign other ranks or members.
                </p>
                <template v-if="!isDirectFeedbackSplitEdit">
                <p v-if="ranksError" class="text-[11px] font-semibold text-amber-800">{{ ranksError }}</p>
                <p v-else-if="ranksLoading" class="text-[11px] font-medium text-slate-500">Loading ranks…</p>
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                  <label
                    v-for="rk in rankOptionsForUi"
                    :key="rk.val"
                    :title="rankAssignCheckboxTitle(rk.val, rk.label)"
                    class="flex items-center gap-2 rounded-lg border bg-white p-2 shadow-sm transition-colors"
                    :class="[
                      rankHasMembers(rk.val) ? 'cursor-pointer hover:bg-blue-50/50' : 'cursor-not-allowed bg-slate-50/80',
                      selectedRanks.includes(rk.val)
                        ? 'border-blue-500 bg-blue-50'
                        : rankHasMembers(rk.val)
                          ? 'border-slate-200'
                          : 'border-slate-200/60',
                    ]"
                  >
                    <input
                      type="checkbox"
                      class="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      :class="rankHasMembers(rk.val) ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'"
                      :checked="isRankFullySelected(rk.val)"
                      :indeterminate="isRankPartiallySelected(rk.val)"
                      :disabled="!rankHasMembers(rk.val)"
                      @change="rankHasMembers(rk.val) && toggleRank(rk.val)"
                    />
                    <div class="flex min-w-0 flex-col leading-none">
                      <span
                        class="text-xs font-bold"
                        :class="[
                          selectedRanks.includes(rk.val) ? 'text-blue-700' : rankHasMembers(rk.val) ? 'text-slate-700' : 'text-slate-400',
                        ]"
                      >{{ rk.val }}</span>
                      <span
                        class="mt-1 block truncate text-[9px]"
                        :class="rankHasMembers(rk.val) ? 'text-slate-500' : 'text-slate-400'"
                        :title="rk.label"
                      >{{ rk.label }}</span>
                    </div>
                  </label>
                </div>

                <div v-if="selectedRanks.length > 0" class="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                  <div>
                    <p class="text-[10px] font-bold uppercase tracking-wider text-blue-700">Members by rank</p>
                  </div>

                  <div class="relative">
                    <i
                      class="fas fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                    />
                    <input
                      v-model="individualRankMemberSearch"
                      type="text"
                      placeholder="Search by member name or section..."
                      class="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                    >
                  </div>

                  <div v-if="individualRankCards.length > 0" class="space-y-2">
                    <div
                      v-for="rankCard in individualRankCards"
                      :key="rankCard.rank"
                      class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                    >
                      <button
                        type="button"
                        class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                        @click="toggleRankSection(rankCard.rank)"
                      >
                        <div class="min-w-0">
                          <div class="flex items-center gap-2">
                            <span class="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                              {{ rankCard.rank }}
                            </span>
                            <span class="truncate text-sm font-bold text-slate-800">{{ rankCard.label }}</span>
                          </div>
                          <p class="mt-1 text-[11px] text-slate-500">
                            Selected {{ rankCard.selectedCount }}/{{ rankCard.totalCount }} members
                          </p>
                        </div>
                        <i
                          class="fas fa-chevron-down text-xs text-slate-400 transition-transform duration-200"
                          :class="rankCard.isExpanded ? 'rotate-180' : ''"
                        />
                      </button>

                      <div v-if="rankCard.isExpanded" class="border-t border-slate-100 px-4 py-3">
                        <div v-if="rankCard.loadingMembers" class="text-xs font-medium text-slate-500">
                          Loading members…
                        </div>
                        <p v-else-if="rankCard.membersLoadError" class="text-xs font-medium text-rose-700">
                          {{ rankCard.membersLoadError }}
                        </p>
                        <div v-else-if="rankCard.members.length === 0" class="text-xs font-medium text-slate-400">
                          {{
                            individualRankMemberSearch.trim()
                              ? 'No members match the filter for this rank.'
                              : 'No people with this rank in the system.'
                          }}
                        </div>

                        <div v-else class="space-y-2">
                          <label
                            v-for="member in rankCard.members"
                            :key="member.val"
                            class="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors"
                            :class="
                              isFeedbackAssignee(member.val)
                                ? 'border-amber-300 bg-amber-50 ring-1 ring-amber-200 hover:bg-amber-100/60'
                                : 'border-slate-200 hover:bg-slate-50'
                            "
                          >
                            <input
                              type="checkbox"
                              class="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              :checked="isRankMemberSelected(rankCard.rank, member.val)"
                              @change="toggleRankMember(rankCard.rank, member.val)"
                            />
                            <div
                              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-500"
                            >
                              {{ member.avatar }}
                            </div>
                            <div class="min-w-0 flex-1">
                              <p class="truncate text-xs font-bold text-slate-700">{{ member.short }}</p>
                              <p class="truncate text-[10px] text-slate-500">{{ member.dept }}</p>
                            </div>
                            <span
                              v-if="isFeedbackAssignee(member.val)"
                              class="ml-1 inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800"
                              title="Processing feedback for this person"
                            >
                              <i class="fas fa-comment-dots text-[8px]" />
                              Feedback
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    v-else
                    class="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-xs font-medium text-slate-500"
                  >
                    No members match the keyword by name or section.
                  </div>
                </div>
                </template>
                <div
                  v-else-if="feedbackIndividualMemberCard"
                  class="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-inner"
                >
                  <p class="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                    Member feedback — assignee
                  </p>
                  <div
                    class="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 ring-1 ring-amber-200"
                  >
                    <div
                      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-500"
                    >
                      {{ feedbackIndividualMemberCard.member.avatar }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-xs font-bold text-slate-700">
                        {{ feedbackIndividualMemberCard.member.short }}
                      </p>
                      <p class="truncate text-[10px] text-slate-500">
                        {{ feedbackIndividualMemberCard.member.dept }}
                        <span
                          v-if="feedbackIndividualMemberCard.rank"
                          class="text-slate-400"
                        >
                          ·
                        </span>
                        <span
                          v-if="feedbackIndividualMemberCard.rank"
                          class="text-indigo-500"
                        >
                          {{ feedbackIndividualMemberCard.rank }}
                          {{ feedbackIndividualMemberCard.rankLabel ? `(${feedbackIndividualMemberCard.rankLabel})` : '' }}
                        </span>
                      </p>
                    </div>
                    <span
                      class="ml-1 inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800"
                      title="Processing feedback for this person"
                    >
                      <i class="fas fa-comment-dots text-[8px]" />
                      Feedback
                    </span>
                  </div>
                </div>
              </div>

              <!-- Direct: members — ref chỉ trigger + list -->
              <div v-else ref="assignMemberSurfaceRef" class="relative">
                <p
                  v-if="isDirectFeedbackSplitEdit"
                  class="mb-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] font-semibold leading-snug text-amber-900"
                >
                  Only the member who sent feedback is shown. You cannot add or remove other members.
                </p>
                <template v-if="!isDirectFeedbackSplitEdit">
                <button
                  type="button"
                  class="input-optional relative flex min-h-[38px] w-full flex-wrap items-center gap-1.5 rounded-md py-1.5 pl-8 pr-7 text-left text-xs font-bold text-slate-700 transition-all"
                  @click.stop="assignDropdown = assignDropdown === 'member' ? null : 'member'"
                >
                  <span class="w-full font-medium text-slate-400">
                    {{
                      selectedMembers.length === 0
                        ? 'Search and select multiple members...'
                        : `${selectedMembers.length} member(s) selected — click to add more; remove from the list below`
                    }}
                  </span>
                </button>
                <i class="fas fa-user-plus pointer-events-none absolute left-2.5 top-2.5 text-[10px] text-slate-400" />
                <i class="fas fa-chevron-down pointer-events-none absolute right-2.5 top-2.5 text-[10px] text-slate-400" />

                <div
                  v-show="assignDropdown === 'member'"
                  class="absolute left-0 z-50 mt-1 flex max-h-72 w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
                  @click.stop
                >
                  <div
                    class="sticky top-0 z-10 shrink-0 border-b border-slate-100 bg-slate-50 p-2"
                    @click.stop
                  >
                    <div class="relative">
                      <i
                        class="fas fa-search pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                      />
                      <input
                        v-model="memberAssignSearch"
                        type="text"
                        placeholder="Search by name, department or rank..."
                        class="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-xs font-medium text-slate-800 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        @click.stop
                      />
                    </div>
                  </div>
                  <p
                    v-if="promotionAssigneesError"
                    class="shrink-0 border-b border-amber-100 bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-800"
                  >
                    {{ promotionAssigneesError }}
                  </p>
                  <div
                    v-if="promotionAssigneesLoading"
                    class="shrink-0 border-b border-slate-100 px-3 py-6 text-center text-xs font-medium text-slate-500"
                  >
                    Loading people…
                  </div>
                  <div class="custom-scrollbar flex-1 overflow-y-auto p-1">
                    <template v-if="filteredMemberOptions.length > 0">
                      <label
                        v-for="m in filteredMemberOptions"
                        :key="m.val"
                        class="group flex cursor-pointer items-center rounded-md border-b border-slate-50 px-3 py-2 transition-colors last:border-0"
                        :class="
                          isFeedbackAssignee(m.val)
                            ? 'bg-amber-50/90 hover:bg-amber-100/70'
                            : 'hover:bg-slate-50'
                        "
                      >
                        <input
                          type="checkbox"
                          class="mr-3 mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          :checked="selectedMembers.includes(m.val)"
                          @change="toggleMember(m.val)"
                        />
                        <div class="flex min-w-0 flex-1 items-center gap-3">
                          <div
                            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-500"
                          >
                            {{ m.avatar }}
                          </div>
                          <div class="min-w-0 flex-1 flex-col">
                            <span
                              class="block text-sm font-bold leading-tight text-slate-700 group-hover:text-blue-600"
                            >{{ m.short }}</span>
                            <span
                              class="mt-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
                            >
                              {{ m.dept }}
                              <span class="text-slate-400">•</span>
                              <span class="text-indigo-500">{{ m.rank }}</span>
                            </span>
                          </div>
                          <span
                            v-if="isFeedbackAssignee(m.val)"
                            class="ml-1 inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800"
                            title="Processing feedback for this person"
                          >
                            <i class="fas fa-comment-dots text-[8px]" />
                            Feedback
                          </span>
                        </div>
                      </label>
                    </template>
                    <p
                      v-else-if="!promotionAssigneesLoading"
                      class="px-3 py-4 text-center text-xs font-medium text-slate-500"
                    >
                      {{
                        promotionAssigneeDirectOptions.length === 0
                          ? 'No people available yet.'
                          : 'No members match the filter.'
                      }}
                    </p>
                  </div>
                </div>
                </template>

                <div
                  v-if="visibleSelectedMembers.length > 0"
                  class="mt-2 space-y-1.5 rounded-lg border p-3"
                  :class="
                    isDirectFeedbackSplitEdit
                      ? 'border-amber-200 bg-amber-50/40'
                      : 'border-blue-100 bg-blue-50/50'
                  "
                >
                  <p
                    class="mb-1 text-[10px] font-bold uppercase tracking-wide"
                    :class="isDirectFeedbackSplitEdit ? 'text-amber-800' : 'text-blue-800'"
                  >
                    {{
                      isDirectFeedbackSplitEdit
                        ? 'Member feedback — assignee'
                        : 'Selected members'
                    }}
                  </p>
                  <div
                    v-for="id in visibleSelectedMembers"
                    :key="id"
                    class="flex items-center justify-between gap-2 rounded-md border px-3 py-2 shadow-sm"
                    :class="
                      isFeedbackAssignee(id)
                        ? 'border-amber-300 bg-amber-50 ring-1 ring-amber-200'
                        : 'border-slate-200 bg-white'
                    "
                  >
                    <span class="flex min-w-0 items-center gap-1.5">
                      <span class="min-w-0 truncate text-[11px] font-bold text-slate-700">
                        {{ memberByVal(id)?.short ?? id }}
                      </span>
                      <span
                        v-if="isFeedbackAssignee(id)"
                        class="ml-1 inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800"
                        title="Processing feedback for this person"
                      >
                        <i class="fas fa-comment-dots text-[8px]" />
                        Feedback
                      </span>
                    </span>
                    <button
                      v-if="!isDirectFeedbackSplitEdit"
                      type="button"
                      class="shrink-0 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700 transition-colors hover:bg-rose-100"
                      @click="toggleMember(id)"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>

          <!-- Tab: chọn KPI từ gói template -->
          <div
            v-show="!isEditingFromDiagnostics && createTab === 'template'"
            class="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <label
              class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
              for="gm-template-package"
            >
              KPI template package
            </label>
            <p v-if="templateApiError" class="mb-2 text-[11px] font-semibold text-rose-600">
              {{ templateApiError }}
            </p>
            <div class="relative">
              <select
                id="gm-template-package"
                v-model="templatePackageId"
                :disabled="templatePackagesLoading || templatePackages.length === 0"
                class="w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-slate-50/80 py-2.5 pl-3 pr-9 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <template v-if="templatePackages.length === 0">
                  <option value="" disabled>
                    {{ templatePackagesLoading ? 'Loading packages…' : 'No template packages on the system' }}
                  </option>
                </template>
                <template v-else>
                  <option value="" disabled>— Select template package —</option>
                  <option v-for="s in templatePackages" :key="s.id" :value="s.id">
                    {{ s.name }}
                  </option>
                </template>
              </select>
              <i
                class="fas fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                aria-hidden="true"
              />
            </div>
            <p v-if="templateItemsLoading" class="text-[11px] font-medium text-slate-500">
              Loading KPIs in package…
            </p>
            <div
              class="overflow-hidden rounded-lg border border-slate-200 bg-white"
              :class="!templatePackageId.trim() ? 'pointer-events-none opacity-60' : ''"
            >
              <label
                class="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 text-slate-700"
              >
                <input
                  ref="templateSelectAllInputRef"
                  type="checkbox"
                  class="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  :disabled="!templatePackageId.trim()"
                  :checked="templateSelectAllChecked"
                  @change="toggleTemplateSelectAll()"
                />
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-600">Select all</span>
              </label>
              <div class="divide-y divide-slate-100">
                <p
                  v-if="!templatePackageId.trim() && !templateItemsLoading"
                  class="px-4 py-6 text-center text-xs font-medium text-slate-500"
                >
                  Select a template package above to load sample KPIs.
                </p>
                <p
                  v-else-if="!templateItemsLoading && templateKpiRows.length === 0 && templatePackageId"
                  class="px-4 py-6 text-center text-xs font-medium text-slate-500"
                >
                  This package has no template KPIs (kpi_template_items).
                </p>
                <template v-for="group in templateKpiDisplayGroups" :key="'tpl-grp-' + group.key">
                  <div class="border-t border-slate-100 first:border-t-0">
                    <div
                      class="flex items-center gap-2 border-b border-slate-100/80 bg-slate-50/90 px-4 py-2"
                    >
                      <span class="text-[11px] font-bold uppercase tracking-wider text-slate-800">{{
                        group.label
                      }}</span>
                      <span
                        class="rounded-md border border-slate-200/80 bg-white px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600"
                        >{{ group.rows.length }} KPI</span
                      >
                    </div>
                    <div class="divide-y divide-slate-100">
                      <label
                        v-for="row in group.rows"
                        :key="row.key"
                        class="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50/80"
                      >
                        <input
                          type="checkbox"
                          class="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          :checked="templateSelectedKeys.has(row.key)"
                          @change="toggleTemplateRowKey(row.key)"
                        />
                        <div class="min-w-0 flex-1">
                          <p class="text-sm font-bold text-slate-800">{{ row.label }}</p>
                          <p class="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {{ row.kindLabel }}
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>

          </div>

        <!-- Drawer Footer -->
        <div class="z-10 flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white p-5 shadow-sm">
          <button
            type="button"
            class="rounded-lg border border-slate-200 bg-white px-5 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-100"
            @click="close"
          >
            Cancel
          </button>
          <button
            v-if="!isEditingFromDiagnostics && createTab === 'template'"
            type="button"
            class="flex items-center gap-1.5 rounded-lg bg-blue-600 px-6 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
            :disabled="
              savingTemplateBatch ||
              templatePackagesLoading ||
              templateItemsLoading ||
              !templatePackageId.trim() ||
              templateSelectedKeys.size === 0
            "
            @click="confirmTemplateBatchCreate"
          >
            <i v-if="savingTemplateBatch" class="fas fa-spinner fa-spin text-sm" aria-hidden="true" />
            <i v-else class="fas fa-layer-group text-sm" aria-hidden="true" />
            {{ savingTemplateBatch ? 'Creating…' : 'Create selected KPIs' }}
          </button>
          <button
            v-else
            type="button"
            class="flex items-center gap-1.5 rounded-lg bg-blue-600 px-6 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
            :disabled="saving"
            @click="save"
          >
            <i v-if="saving" class="fas fa-spinner fa-spin text-sm" aria-hidden="true" />
            <i v-else class="fas fa-save text-sm" aria-hidden="true" />
            {{ saving ? 'Saving...' : isEditingFromDiagnostics ? 'Save changes' : 'Create KPI' }}
          </button>
        </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Drawer: backdrop + panel trượt từ phải */
.gm-kpi-drawer-enter-active,
.gm-kpi-drawer-leave-active {
  transition-duration: 0.28s;
}
.gm-kpi-drawer-enter-active .gm-kpi-drawer-backdrop,
.gm-kpi-drawer-leave-active .gm-kpi-drawer-backdrop {
  transition: opacity 0.28s ease;
}
.gm-kpi-drawer-enter-active .gm-kpi-drawer-panel,
.gm-kpi-drawer-leave-active .gm-kpi-drawer-panel {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.gm-kpi-drawer-enter-from .gm-kpi-drawer-backdrop,
.gm-kpi-drawer-leave-to .gm-kpi-drawer-backdrop {
  opacity: 0;
}
.gm-kpi-drawer-enter-to .gm-kpi-drawer-backdrop,
.gm-kpi-drawer-leave-from .gm-kpi-drawer-backdrop {
  opacity: 1;
}
.gm-kpi-drawer-enter-from .gm-kpi-drawer-panel,
.gm-kpi-drawer-leave-to .gm-kpi-drawer-panel {
  transform: translateX(100%);
}
.gm-kpi-drawer-enter-to .gm-kpi-drawer-panel,
.gm-kpi-drawer-leave-from .gm-kpi-drawer-panel {
  transform: translateX(0);
}

@media (prefers-reduced-motion: reduce) {
  .gm-kpi-drawer-enter-active,
  .gm-kpi-drawer-leave-active,
  .gm-kpi-drawer-enter-active .gm-kpi-drawer-backdrop,
  .gm-kpi-drawer-leave-active .gm-kpi-drawer-backdrop,
  .gm-kpi-drawer-enter-active .gm-kpi-drawer-panel,
  .gm-kpi-drawer-leave-active .gm-kpi-drawer-panel {
    transition-duration: 0.01ms !important;
  }
  .gm-kpi-drawer-enter-from .gm-kpi-drawer-panel,
  .gm-kpi-drawer-leave-to .gm-kpi-drawer-panel {
    transform: none;
  }
}

/* Trường bắt buộc — theo index.html */
.input-required {
  background-color: rgba(239, 246, 255, 0.6);
  border: 1px solid #bfdbfe;
}
.input-required:focus,
.input-required:focus-within {
  background-color: #ffffff;
  border-color: #3b82f6;
}
.input-required:disabled {
  cursor: not-allowed;
}

.input-optional {
  border: 1px solid #e2e8f0;
  background-color: #f8fafc;
}
.input-optional:hover {
  border-color: #cbd5e1;
  background-color: #ffffff;
}
.input-optional:focus,
.input-optional:focus-within {
  border-color: #3b82f6;
  background-color: #ffffff;
}

.gm-kpi-section-card {
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.gm-kpi-section-card:focus-within {
  border-color: #bfdbfe;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.12);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background-color: #e2e8f0;
}
</style>
