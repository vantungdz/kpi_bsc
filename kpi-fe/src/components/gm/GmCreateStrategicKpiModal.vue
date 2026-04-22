<script setup lang="ts">
import { ref, computed, watch, watchEffect, onUnmounted, nextTick } from 'vue'
import {
  collectYearsFromKpiActivityInSnapshots,
  gmLayoutCycleSnapshots,
  normalizeStrategicKpiKind,
  type GmHierarchyKpi,
} from '@/mocks/gm-kpi.mock'
import GmStrategicKpiTypeTag from '@/components/gm/GmStrategicKpiTypeTag.vue'

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
    /** Năm đang chọn ở header GM — dùng làm mặc định khi mở form (nếu nằm trong các lựa chọn hợp lệ). */
    cycleId: string
    /** Khi có — drawer mở ở chế độ sửa, điền form từ dòng diagnostics; không hiện block sao chép KPI. */
    editInitial?: GmHierarchyKpi | null
  }>(),
  {
    cycleId: '2026',
    editInitial: null,
  },
)

const isEditingFromDiagnostics = computed(() => props.editInitial != null)

const emit = defineEmits<{
  saved: [payload: Record<string, unknown> | Record<string, unknown>[]]
}>()

/** «Năm đánh giá»: năm hiện tại (theo máy) và **hai năm kế tiếp** (3 lựa chọn). */
const evaluationYearOptions = computed(() => {
  const y0 = new Date().getFullYear()
  return [0, 1, 2].map((d) => {
    const y = y0 + d
    return { id: String(y), label: String(y) }
  })
})

/** «Năm nguồn» sao chép nhanh: các năm có KPI với `activityStartDate` / `activityEndDate` trong mock snapshot. */
const copySourceYearOptions = computed(() => {
  const ids = collectYearsFromKpiActivityInSnapshots(gmLayoutCycleSnapshots)
  if (ids.length > 0) return ids.map((id) => ({ id, label: id }))
  return Object.keys(gmLayoutCycleSnapshots)
    .sort((a, b) => Number(b) - Number(a))
    .map((id) => ({ id, label: id }))
})

type StrategicKpiType = 'cascading' | 'individual' | 'promotion'

const BSC_OPTIONS = [
  { value: 'financial', label: '💰 Financial' },
  { value: 'customer', label: '👥 Customer' },
  { value: 'internal', label: '⚙️ Internal Process' },
  { value: 'learning', label: '🎓 Learning & Growth' },
] as const

const UNIT_OPTIONS = [
  { value: 'MM', label: 'MM' },
  { value: 'POINT', label: 'POINT' },
  { value: 'PRODUCT', label: 'PRODUCT' },
  { value: 'PROJECT', label: 'PROJECT' },
  { value: 'CERTIFICATION', label: 'CERTIFICATION' },
  { value: 'ARTICLE', label: 'ARTICLE' },
  { value: 'PERSON', label: 'PERSON' },
] as const

const PM_OPTIONS = [
  { val: 'Thai Van Liem', label: 'Thai Van Liem (SD1)' },
  { val: 'Nguyen Van A', label: 'Nguyen Van A (SD2)' },
  { val: 'Tran Thi B', label: 'Tran Thi B (QA)' },
  { val: 'Le Van C', label: 'Le Van C (PMO)' },
] as const

/** Direct / Ad-hoc — danh sách member + metadata để lọc (theo index.html). */
const MEMBER_OPTIONS: DirectMemberOption[] = [
  { val: 'E1', short: 'Tran Van Phuoc', label: 'Tran Van Phuoc (QA - R3)', dept: 'Quality Assurance', rank: 'R3', avatar: 'TP' },
  { val: 'E2', short: 'Le Thi D', label: 'Le Thi D (SD2 - R2)', dept: 'Software Dev 2', rank: 'R2', avatar: 'LD' },
  { val: 'E3', short: 'Nguyen Hoang E', label: 'Nguyen Hoang E (SD1 - R4)', dept: 'Software Dev 1', rank: 'R4', avatar: 'NE' },
  { val: 'E4', short: 'Vu Thi H', label: 'Vu Thi H (QA - R3)', dept: 'Quality Assurance', rank: 'R3', avatar: 'VH' },
  { val: 'E6', short: 'Ngo Quoc K', label: 'Ngo Quoc K (QA - R5)', dept: 'Quality Assurance', rank: 'R5', avatar: 'NK' },
  { val: 'E7', short: 'Pham Van M', label: 'Pham Van M (PMO - R4)', dept: 'PMO', rank: 'R4', avatar: 'PM' },
  { val: 'E8', short: 'Dao Quang P', label: 'Dao Quang P (SD1 - R2)', dept: 'Software Dev 1', rank: 'R2', avatar: 'DP' },
]

/** Ba lựa chọn trong dropdown; option 1–2 có radio phụ. */
interface FormulaDef {
  value: string
  label: string
  expression: string
}

/** Option 1: chọn tỉ lệ Actual/Plan hoặc Plan/Actual. */
const FORMULA_MEAN_RATIO = 'mean_by_ratio'
/** Option 2: chọn gộp AVG hoặc SUM. */
const FORMULA_MEAN_AGGREGATE = 'mean_by_aggregate'

const KPI_CALCULATION_FORMULAS: FormulaDef[] = [
  {
    value: FORMULA_MEAN_RATIO,
    label: 'Trung bình — theo tỉ lệ',
    expression: 'Chọn Actual/Plan hoặc Plan/Actual.',
  },
  {
    value: FORMULA_MEAN_AGGREGATE,
    label: 'Trung bình — gộp (AVG / SUM)',
    expression: 'Chọn AVG (trung bình) hoặc SUM (tổng).',
  },
  {
    value: 'manual_member_input',
    label: 'Tự nhập — theo số member nhập',
    expression: 'Dựa vào số mà member tự nhập để tính; không áp dụng công thức Plan/Actual cố định.',
  },
]

const DEFAULT_CALCULATION_METHOD = FORMULA_MEAN_RATIO

type MeanRatioKind = 'actual_plan' | 'plan_actual'
type MeanAggregateKind = 'average' | 'sum'

/** Mặc định khi lưu (form không còn chọn Chiều đánh giá). */
const DEFAULT_EVALUATION_DIRECTION = 'maximize' as const

const RANK_OPTIONS = [
  { val: 'R1', label: 'Fresher / Junior' },
  { val: 'R2', label: 'Associate' },
  { val: 'R3', label: 'Mid-Level' },
  { val: 'R4', label: 'Senior' },
  { val: 'R5', label: 'Principal / Lead' },
  { val: 'R6', label: 'Manager' },
  { val: 'R7', label: 'Senior Manager' },
  { val: 'R8', label: 'Director' },
  { val: 'R9', label: 'Vice President' },
  { val: 'R10', label: 'C-Level' },
] as const

const kpiType = ref<StrategicKpiType>('cascading')
const perspective = ref<string>('internal')
const kpiName = ref('')
const description = ref('')
const targetValue = ref<string>('')
const unit = ref<string>('MM')
const weightPct = ref<string>('')
/** Một trong ba option dropdown (tỉ lệ / gộp AVG·SUM / tự nhập). */
const calculationMethod = ref<string>(DEFAULT_CALCULATION_METHOD)

/** Option 1 — Actual/Plan hay Plan/Actual. */
const meanRatioKind = ref<MeanRatioKind>('actual_plan')
/** Option 2 — AVG hay SUM. */
const meanAggregateKind = ref<MeanAggregateKind>('average')

/** KPI quan trọng (checkbox gọn trong form). */
const isImportantKpi = ref(false)

/** Năm đánh giá trong form — có thể khác header; mở drawer reset theo `cycleId`. */
const formCycleId = ref(String(props.cycleId))

/** Start/end theo năm đánh giá đang chọn trong form. */
const cycleDateBounds = computed(() => {
  const m = /^(\d{4})$/.exec(String(formCycleId.value).trim())
  const year = m?.[1] ?? '2025'
  return { start: `${year}-01-01`, end: `${year}-12-31` }
})

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

/** Tránh watch(kpiType) xóa assignment khi đang áp template “Sao chép KPI”. */
const isApplyingCopyTemplate = ref(false)
/** Tránh watch(kpiType) xóa PM khi hydrate form sửa. */
const isHydratingFromEdit = ref(false)

/** Dropdown sao chép — năm nguồn + KPI (theo năm). */
const copySourceYear = ref(String(props.cycleId))
const copyFromId = ref('')
const copyKpiPickerOpen = ref(false)
const copyKpiFilterQuery = ref('')
const copyKpiPickerSurfaceRef = ref<HTMLElement | null>(null)
const copyKpiPickerSearchRef = ref<HTMLInputElement | null>(null)

const COPY_KPI_ENTRY_IDS = ['kpi_1', 'kpi_2', 'kpi_ind', 'kpi_dir'] as const

interface CopyKpiTemplate {
  kpiType: StrategicKpiType
  perspective: string
  kpiName: string
  description: string
  /** Chỉ dùng khi `kpiType === 'cascading'`. */
  targetValue?: string
  unit: string
  weightPct: string
  calculationMethod: string
  isImportant?: boolean
  selectedPMs?: string[]
  pmTargets?: Record<string, string>
  selectedRanks?: string[]
  selectedMembers?: string[]
}

const COPY_KPI_TEMPLATES: Record<string, CopyKpiTemplate> = {
  kpi_1: {
    kpiType: 'cascading',
    perspective: 'internal',
    kpiName: 'A.1a · Individual Efficiency',
    description: 'KPI hiệu suất cá nhân; kế thừa mục tiêu từ Khối vận hành.',
    targetValue: '95',
    unit: 'MM',
    weightPct: '30',
    calculationMethod: 'mean_plan_actual',
    isImportant: false,
    selectedPMs: ['Thai Van Liem', 'Tran Thi B'],
    pmTargets: { 'Thai Van Liem': '95', 'Tran Thi B': '90' },
  },
  kpi_2: {
    kpiType: 'cascading',
    perspective: 'internal',
    kpiName: 'A.3a · Individual Quality',
    description: 'Chỉ số chất lượng công việc cá nhân (IQ).',
    targetValue: '98',
    unit: 'POINT',
    weightPct: '30',
    calculationMethod: 'mean_plan_actual_pct',
    isImportant: true,
    selectedPMs: ['Thai Van Liem'],
    pmTargets: { 'Thai Van Liem': '98' },
  },
  kpi_ind: {
    kpiType: 'individual',
    perspective: 'learning',
    kpiName: 'B.2 · Training / Certifications',
    description: 'Hoàn thành chứng chỉ / giờ đào tạo theo rank.',
    unit: 'CERTIFICATION',
    weightPct: '10',
    calculationMethod: 'mean_plan_actual_pct',
    isImportant: false,
    selectedRanks: ['R2', 'R3', 'R4'],
  },
  kpi_dir: {
    kpiType: 'promotion',
    perspective: 'customer',
    kpiName: 'C.1 · Customer touchpoint owner',
    description: 'Giao đích danh xử lý phản hồi khách hàng.',
    unit: 'PERSON',
    weightPct: '15',
    calculationMethod: 'manual_member_input',
    isImportant: false,
    selectedMembers: ['E2', 'E3'],
  },
}

/** Tab tạo KPI (chỉ khi tạo mới). Tab 1 = form hiện tại; tab 2 = tạo hàng loạt từ template. */
type CreateKpiFlowTab = 'custom' | 'template'
const createKpiTab = ref<CreateKpiFlowTab>('custom')

interface KpiTemplatePack {
  id: string
  label: string
  entryIds: string[]
}

const KPI_TEMPLATE_PACKS: KpiTemplatePack[] = [
  { id: 'tpl_ops', label: 'Gói KPI vận hành & chất lượng', entryIds: ['kpi_1', 'kpi_2'] },
  { id: 'tpl_hr', label: 'Gói KPI nhân sự & promotion', entryIds: ['kpi_ind', 'kpi_dir'] },
]

const selectedTemplatePackId = ref('')
const templateKpiSelection = ref<Record<string, boolean>>({})
const bulkFormError = ref('')

const templateKpiRows = computed(() => {
  const pack = KPI_TEMPLATE_PACKS.find((p) => p.id === selectedTemplatePackId.value)
  if (!pack) return []
  return pack.entryIds.map((id) => {
    const t = COPY_KPI_TEMPLATES[id]
    return { id, name: t.kpiName, kind: t.kpiType, perspective: t.perspective }
  })
})

const BSC_VALUE_ORDER = BSC_OPTIONS.map((o) => o.value)
const bscLabelByValue = Object.fromEntries(BSC_OPTIONS.map((o) => [o.value, o.label])) as Record<
  (typeof BSC_OPTIONS)[number]['value'],
  string
>

/** Danh sách tab template: nhóm theo khía cạnh BSC (thứ tự Financial → …), không collapse. */
const templateKpiGroupedByBsc = computed(() => {
  const rows = templateKpiRows.value
  const allowed = new Set<string>(BSC_VALUE_ORDER)
  const buckets = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = allowed.has(row.perspective) ? row.perspective : 'internal'
    const cur = buckets.get(key) ?? []
    cur.push(row)
    buckets.set(key, cur)
  }
  return BSC_VALUE_ORDER.filter((v) => (buckets.get(v) ?? []).length > 0).map((perspective) => ({
    perspective,
    label: bscLabelByValue[perspective as keyof typeof bscLabelByValue] ?? perspective,
    rows: buckets.get(perspective) ?? [],
  }))
})

watch(selectedTemplatePackId, (packId) => {
  bulkFormError.value = ''
  const pack = KPI_TEMPLATE_PACKS.find((p) => p.id === packId)
  const next: Record<string, boolean> = {}
  if (pack) {
    for (const eid of pack.entryIds) next[eid] = true
  }
  templateKpiSelection.value = next
})

function toggleTemplateKpiRow(id: string, checked: boolean) {
  templateKpiSelection.value = { ...templateKpiSelection.value, [id]: checked }
}

function onToggleTemplateRow(id: string, ev: Event) {
  const el = ev.target as HTMLInputElement | null
  toggleTemplateKpiRow(id, !!el?.checked)
}

function onTemplateSelectAllChange(ev: Event) {
  const el = ev.target as HTMLInputElement | null
  const checked = !!el?.checked
  const next = { ...templateKpiSelection.value }
  for (const row of templateKpiRows.value) next[row.id] = checked
  templateKpiSelection.value = next
}

const templateAllRowsChecked = computed(
  () =>
    templateKpiRows.value.length > 0 &&
    templateKpiRows.value.every((r) => templateKpiSelection.value[r.id]),
)

/** Một phần (không phải không / không phải hết) — checkbox «Chọn tất cả» dạng indeterminate. */
const templateSelectAllIndeterminate = computed(() => {
  const rows = templateKpiRows.value
  if (rows.length === 0) return false
  const n = rows.filter((r) => templateKpiSelection.value[r.id]).length
  return n > 0 && n < rows.length
})

const templateSelectAllCheckboxRef = ref<HTMLInputElement | null>(null)

/** Có ít nhất một KPI được tick trong gói template hiện tại. */
const templateHasAtLeastOneSelected = computed(() =>
  templateKpiRows.value.some((r) => !!templateKpiSelection.value[r.id]),
)

/** Đủ điều kiện bấm «Tạo các KPI đã chọn» (tab template). */
const canBulkCreateFromTemplate = computed(
  () =>
    !!selectedTemplatePackId.value &&
    templateKpiRows.value.length > 0 &&
    templateHasAtLeastOneSelected.value,
)

/** Tooltip khi nút tạo từ template bị tắt. */
const templateBulkCreateDisabledTitle = computed(() => {
  if (saving.value) return ''
  if (!selectedTemplatePackId.value) return 'Chọn gói template KPI.'
  if (templateKpiRows.value.length === 0) return 'Gói này không có KPI.'
  if (!templateHasAtLeastOneSelected.value) return 'Chọn ít nhất một KPI trong gói template.'
  return ''
})

watch(templateHasAtLeastOneSelected, (ok) => {
  if (ok && bulkFormError.value) bulkFormError.value = ''
})

watchEffect(() => {
  void templateSelectAllIndeterminate.value
  void templateAllRowsChecked.value
  void templateKpiRows.value.length
  void nextTick(() => {
    const el = templateSelectAllCheckboxRef.value
    if (!el) return
    el.indeterminate = templateSelectAllIndeterminate.value
  })
})

/** Danh sách KPI mẫu để sao chép — theo năm đã chọn ở dropdown 1. */
const copyKpiListForYear = computed(() => {
  const y = copySourceYear.value
  return COPY_KPI_ENTRY_IDS.map((id) => ({
    id,
    label: `${COPY_KPI_TEMPLATES[id].kpiName} (${y})`,
  }))
})

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
    const t = COPY_KPI_TEMPLATES[o.id as keyof typeof COPY_KPI_TEMPLATES]
    const name = t?.kpiName ?? ''
    const hay = `${o.label} ${name}`.toLowerCase()
    return hay.includes(q)
  })
})

watch(copySourceYear, () => {
  copyFromId.value = ''
  copyKpiPickerOpen.value = false
  copyKpiFilterQuery.value = ''
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
  const t = COPY_KPI_TEMPLATES[id as keyof typeof COPY_KPI_TEMPLATES]
  if (!t) return
  isApplyingCopyTemplate.value = true
  kpiType.value = t.kpiType
  perspective.value = t.perspective
  kpiName.value = t.kpiName
  description.value = t.description
  targetValue.value = t.kpiType === 'cascading' ? (t.targetValue ?? '') : ''
  unit.value = t.unit
  weightPct.value = t.weightPct
  hydrateCalculationFromPersisted(t.calculationMethod)
  isImportantKpi.value = t.isImportant ?? false
  selectedPMs.value = [...(t.selectedPMs ?? [])]
  pmTargets.value = { ...(t.pmTargets ?? {}) }
  selectedRanks.value = [...(t.selectedRanks ?? [])]
  selectedMembers.value = [...(t.selectedMembers ?? [])]
  selectedRankMembers.value = Object.fromEntries(
    (t.selectedRanks ?? []).map((rank) => [rank, membersByRank(rank).map((member) => member.val)]),
  )
  expandedRankSections.value = [...(t.selectedRanks ?? [])]
  memberAssignSearch.value = ''
  isApplyingCopyTemplate.value = false
}

const assignLabel = computed(() => {
  if (kpiType.value === 'promotion') return 'Assign To Individuals'
  if (kpiType.value === 'individual') return 'Assign To Ranks / Roles'
  return 'Assign To Project Managers'
})

const formulaOptions = computed((): FormulaDef[] => [...KPI_CALCULATION_FORMULAS])

/** Tooltip cho công thức đang chọn (select + icon). */
const selectedFormulaExpression = computed(() => {
  if (calculationMethod.value === 'manual_member_input') {
    return (
      formulaOptions.value.find((f) => f.value === 'manual_member_input')?.expression ??
      'Tự nhập theo số member.'
    )
  }
  if (calculationMethod.value === FORMULA_MEAN_RATIO) {
    return meanRatioKind.value === 'actual_plan'
      ? 'Theo tỉ lệ Actual / Plan.'
      : 'Theo tỉ lệ Plan / Actual.'
  }
  if (calculationMethod.value === FORMULA_MEAN_AGGREGATE) {
    return meanAggregateKind.value === 'sum'
      ? 'Gộp kiểu SUM (tổng).'
      : 'Gộp kiểu AVG (trung bình %).'
  }
  return 'Chọn công thức tính để xem biểu thức.'
})

function resolvePersistedCalculationMethod(): string {
  if (calculationMethod.value === 'manual_member_input') return 'manual_member_input'
  if (calculationMethod.value === FORMULA_MEAN_RATIO) {
    return meanRatioKind.value === 'actual_plan' ? 'mean_actual_plan' : 'mean_plan_actual'
  }
  if (calculationMethod.value === FORMULA_MEAN_AGGREGATE) {
    return meanAggregateKind.value === 'sum' ? 'mean_plan_actual_sum' : 'mean_plan_actual_pct'
  }
  return 'manual_member_input'
}

/** Áp `calculationMethod` đã lưu / mẫu sao chép → state form. */
function hydrateCalculationFromPersisted(cm: string) {
  if (cm === 'manual_member_input') {
    calculationMethod.value = 'manual_member_input'
    return
  }
  if (cm === 'mean_plan_actual_pct' || cm === 'mean_plan_actual_sum') {
    calculationMethod.value = FORMULA_MEAN_AGGREGATE
    meanAggregateKind.value = cm === 'mean_plan_actual_sum' ? 'sum' : 'average'
    return
  }
  calculationMethod.value = FORMULA_MEAN_RATIO
  meanRatioKind.value = cm === 'mean_actual_plan' ? 'actual_plan' : 'plan_actual'
}

const filteredMemberOptions = computed(() => {
  const q = memberAssignSearch.value.trim().toLowerCase()
  if (!q) return MEMBER_OPTIONS
  return MEMBER_OPTIONS.filter((m) => {
    const hay = `${m.short} ${m.dept} ${m.rank} ${m.val} ${m.label}`.toLowerCase()
    return hay.includes(q)
  })
})

function memberByVal(id: string) {
  return MEMBER_OPTIONS.find((m) => m.val === id)
}

function membersByRank(rank: string) {
  return MEMBER_OPTIONS.filter((m) => m.rank === rank)
}

function buildPayloadFromCopyTemplate(entryId: string, cycleIdForEval: string): Record<string, unknown> | null {
  const t = COPY_KPI_TEMPLATES[entryId as keyof typeof COPY_KPI_TEMPLATES]
  if (!t) return null
  const m = /^(\d{4})$/.exec(String(cycleIdForEval).trim())
  const year = m?.[1] ?? String(new Date().getFullYear())
  const start = `${year}-01-01`
  const end = `${year}-12-31`
  const base: Record<string, unknown> = {
    kpiType: t.kpiType,
    perspective: t.perspective,
    kpiName: t.kpiName,
    description: t.description,
    targetValue: t.kpiType === 'cascading' ? (t.targetValue ?? '') : '',
    unit: t.unit,
    weightPct: t.weightPct,
    startDate: start,
    endDate: end,
    cycleId: String(cycleIdForEval),
    calculationMethod: t.calculationMethod,
    evaluationDirection: DEFAULT_EVALUATION_DIRECTION,
    isImportant: t.isImportant ?? false,
  }
  if (t.kpiType === 'cascading') {
    base.assignPMs = [...(t.selectedPMs ?? [])]
    base.pmTargets = { ...(t.pmTargets ?? {}) }
  } else if (t.kpiType === 'individual') {
    const ranks = [...(t.selectedRanks ?? [])]
    const rankMemberIds = Object.fromEntries(
      ranks.map((rank) => [rank, membersByRank(rank).map((member) => member.val)]),
    )
    base.ranks = ranks
    base.rankMemberIds = rankMemberIds
    base.memberIds = Object.values(rankMemberIds).flat()
  } else {
    base.memberIds = [...(t.selectedMembers ?? [])]
  }
  return base
}

async function bulkCreateFromTemplate() {
  bulkFormError.value = ''
  if (!selectedTemplatePackId.value) {
    bulkFormError.value = 'Chọn một gói template KPI.'
    return
  }
  const ids = templateKpiRows.value.map((r) => r.id).filter((id) => templateKpiSelection.value[id])
  if (!ids.length) {
    bulkFormError.value = 'Vui lòng chọn ít nhất một KPI trong gói template để tạo.'
    await nextTick()
    return
  }
  const payloads = ids
    .map((id) => buildPayloadFromCopyTemplate(id, formCycleId.value))
    .filter((p): p is Record<string, unknown> => p != null)
  if (!payloads.length) return
  saving.value = true
  await new Promise((r) => setTimeout(r, 400))
  saving.value = false
  emit('saved', payloads)
  open.value = false
}

const individualRankCards = computed(() => {
  const query = individualRankMemberSearch.value.trim().toLowerCase()

  return selectedRanks.value
    .map((rank) => {
      const rankMeta = RANK_OPTIONS.find((item) => item.val === rank)
      const allMembers = membersByRank(rank)
      const members = !query
        ? allMembers
        : allMembers.filter((member) => {
            const haystack = `${member.short} ${member.dept} ${member.rank} ${member.label}`.toLowerCase()
            return haystack.includes(query)
          })
      const selectedIds = selectedRankMembers.value[rank] ?? allMembers.map((member) => member.val)
      return {
        rank,
        label: rankMeta?.label ?? rank,
        allMembers,
        members,
        selectedIds,
        selectedCount: selectedIds.length,
        totalCount: allMembers.length,
        isExpanded: expandedRankSections.value.includes(rank),
      }
    })
    .filter((rankCard) => rankCard.members.length > 0)
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

function typeCardClass(t: StrategicKpiType) {
  const base =
    'relative cursor-pointer rounded-lg border p-3 text-left transition-all hover:border-blue-300'
  const selected = kpiType.value === t
  if (!selected) return `${base} border-slate-200 bg-white`
  if (t === 'promotion') return `${base} border-purple-500 bg-purple-50`
  return `${base} border-blue-500 bg-blue-50`
}

function togglePm(val: string) {
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

function toggleRank(val: string) {
  const i = selectedRanks.value.indexOf(val)
  if (i === -1) {
    selectedRanks.value = [...selectedRanks.value, val]
    selectedRankMembers.value = {
      ...selectedRankMembers.value,
      [val]: membersByRank(val).map((member) => member.val),
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
  const i = selectedMembers.value.indexOf(val)
  if (i === -1) selectedMembers.value = [...selectedMembers.value, val]
  else selectedMembers.value = selectedMembers.value.filter((v) => v !== val)
}

function toggleRankMember(rank: string, memberId: string) {
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

function inferUnitFromTargetText(...parts: (string | undefined)[]): string {
  const hay = parts.filter(Boolean).join(' ').toUpperCase()
  if (/%|PHẦN TRĂM|PERCENT/i.test(hay)) return 'POINT'
  if (/\bMM\b|MAN[\s-]?MONTH/i.test(hay)) return 'MM'
  if (/ĐIỂM|POINT/i.test(hay)) return 'POINT'
  if (/DỰ ÁN|PROJECT/i.test(hay)) return 'PROJECT'
  if (/SẢN PHẨM|PRODUCT/i.test(hay)) return 'PRODUCT'
  return 'MM'
}

function hydrateFormFromHierarchyKpi(kpi: GmHierarchyKpi) {
  isHydratingFromEdit.value = true
  createKpiTab.value = 'custom'
  editSessionSnapshot.value = kpi
  clearFormErrors()
  copyFromId.value = ''
  copyKpiPickerOpen.value = false
  copyKpiFilterQuery.value = ''
  formCycleId.value = String(props.cycleId)
  kpiType.value = normalizeStrategicKpiKind(kpi.kpiType)
  perspective.value = kpi.bscPerspective ? String(kpi.bscPerspective) : 'internal'
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
    unit.value = inferUnitFromTargetText(fromPm, kpi.target)
    selectedPMs.value = kpi.pmOwners.map((p) => p.name)
    const nextPm: Record<string, string> = {}
    for (const p of kpi.pmOwners) {
      const n = extractLeadingNumberFromText(p.target)
      if (n) nextPm[p.name] = n
    }
    pmTargets.value = nextPm
  } else {
    targetValue.value = ''
    unit.value = inferUnitFromTargetText(kpi.target)
    selectedPMs.value = []
    pmTargets.value = {}
  }

  hydrateCalculationFromPersisted('mean_actual_plan')
  isImportantKpi.value = kpi.isImportant === true
  selectedRanks.value = []
  selectedMembers.value = []
  memberAssignSearch.value = ''
  void nextTick(() => {
    isHydratingFromEdit.value = false
  })
}

watch(kpiType, () => {
  if (isApplyingCopyTemplate.value || isHydratingFromEdit.value) return
  if (kpiType.value !== 'cascading') targetValue.value = ''
  assignDropdown.value = null
  selectedPMs.value = []
  pmTargets.value = {}
  selectedRanks.value = []
  selectedMembers.value = []
  selectedRankMembers.value = {}
  expandedRankSections.value = []
  individualRankMemberSearch.value = ''
  memberAssignSearch.value = ''
  const allowed = new Set(KPI_CALCULATION_FORMULAS.map((f) => f.value))
  if (!allowed.has(calculationMethod.value)) {
    calculationMethod.value = DEFAULT_CALCULATION_METHOD
    meanRatioKind.value = 'actual_plan'
    meanAggregateKind.value = 'average'
  }
})

watch(assignDropdown, (v) => {
  if (v !== 'member') memberAssignSearch.value = ''
  if (v) closeCopyKpiPicker()
})

function resetForm() {
  createKpiTab.value = 'custom'
  selectedTemplatePackId.value = ''
  templateKpiSelection.value = {}
  bulkFormError.value = ''
  copyFromId.value = ''
  const evalOpts = evaluationYearOptions.value
  const evalIds = new Set(evalOpts.map((c) => c.id))
  const header = String(props.cycleId)
  const resolvedEvalYear = evalIds.has(header) ? header : String(evalOpts[0]?.id ?? new Date().getFullYear())
  formCycleId.value = resolvedEvalYear

  const copyOpts = copySourceYearOptions.value
  const copyIds = new Set(copyOpts.map((c) => c.id))
  const resolvedCopyYear =
    copyOpts.length === 0
      ? resolvedEvalYear
      : copyIds.has(header)
        ? header
        : String(copyOpts[0]!.id)
  copySourceYear.value = resolvedCopyYear
  kpiType.value = 'cascading'
  perspective.value = 'internal'
  kpiName.value = ''
  description.value = ''
  targetValue.value = ''
  unit.value = 'MM'
  weightPct.value = ''
  calculationMethod.value = DEFAULT_CALCULATION_METHOD
  meanRatioKind.value = 'actual_plan'
  meanAggregateKind.value = 'average'
  isImportantKpi.value = false
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
  clearFormErrors()
}

watch(open, (v) => {
  if (v) {
    if (props.editInitial) hydrateFormFromHierarchyKpi(props.editInitial)
    else resetForm()
    window.addEventListener('click', onDocClick)
  } else {
    editSessionSnapshot.value = null
    window.removeEventListener('click', onDocClick)
    assignDropdown.value = null
    copyKpiPickerOpen.value = false
    copyKpiFilterQuery.value = ''
  }
})

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
    err.kpiName = 'Vui lòng nhập tên KPI.'
  }

  if (kpiType.value === 'cascading') {
    const tvRaw = targetValue.value
    const tvStr = String(tvRaw ?? '').trim()
    if (tvStr === '' || Number.isNaN(Number(tvRaw))) {
      err.targetValue = 'Nhập mục tiêu (số).'
    } else if (Number(tvRaw) < 0) {
      err.targetValue = 'Mục tiêu phải ≥ 0.'
    }
  }

  const wStr = String(weightPct.value).trim()
  const wNum = Number.parseFloat(wStr)
  if (!wStr) {
    err.weightPct = 'Nhập trọng số (%).'
  } else if (!Number.isFinite(wNum) || wNum <= 0 || wNum > 100) {
    err.weightPct = 'Trọng số phải từ 1 đến 100.'
  }

  if (!KPI_CALCULATION_FORMULAS.some((f) => f.value === calculationMethod.value)) {
    err.calculationMethod = 'Chọn phân loại cách tính (công thức).'
  }

  formErrors.value = err
  return Object.keys(err).length === 0
}

async function save() {
  if (!validateForm()) {
    await nextTick()
    errorBannerRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    return
  }

  saving.value = true
  const payload: Record<string, unknown> = {
    kpiType: kpiType.value,
    perspective: perspective.value,
    kpiName: kpiName.value,
    description: description.value,
    targetValue: kpiType.value === 'cascading' ? targetValue.value : '',
    unit: unit.value,
    weightPct: weightPct.value,
    startDate: cycleDateBounds.value.start,
    endDate: cycleDateBounds.value.end,
    cycleId: formCycleId.value,
    calculationMethod: resolvePersistedCalculationMethod(),
    evaluationDirection: DEFAULT_EVALUATION_DIRECTION,
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

  const editSnap = editSessionSnapshot.value
  if (editSnap) {
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
                {{ isEditingFromDiagnostics ? 'Sửa Strategic KPI' : 'Create Strategic KPI' }}
              </h2>
              <p class="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {{
                  isEditingFromDiagnostics
                    ? 'Chỉnh sửa thông tin KPI chiến lược'
                    : 'Define organization-level targets'
                }}
              </p>
            </div>
            <button
              type="button"
              class="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
              aria-label="Đóng"
              @click="close"
            >
              <i class="fas fa-times text-base" />
            </button>
          </div>

          <!-- Drawer Body -->
          <div class="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-6">
            <div
              v-if="Object.keys(formErrors).length > 0"
              id="gm-create-kpi-errors"
              ref="errorBannerRef"
              class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900 shadow-sm"
              role="alert"
            >
              <p class="mb-2 flex items-center gap-2 font-bold">
                <i class="fas fa-circle-exclamation text-rose-600" aria-hidden="true" />
                {{ isEditingFromDiagnostics ? 'Vui lòng sửa các lỗi sau trước khi lưu.' : 'Vui lòng sửa các lỗi sau trước khi tạo KPI.' }}
              </p>
              <ul class="list-inside list-disc space-y-0.5 text-[11px] font-semibold text-rose-800">
                <li v-for="(msg, key) in formErrors" :key="key">{{ msg }}</li>
              </ul>
            </div>

            <!-- Tab: Tạo mới KPI | Từ Template — chỉ khi tạo mới -->
            <div
              v-if="!isEditingFromDiagnostics"
              class="rounded-xl border border-slate-200/90 bg-slate-100/90 p-1.5 shadow-inner"
            >
              <div class="grid grid-cols-1 gap-1 sm:grid-cols-2">
                <button
                  type="button"
                  class="flex min-h-[36px] min-w-0 flex-row items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all sm:text-[11px] motion-reduce:transition-none"
                  :class="
                    createKpiTab === 'custom'
                      ? 'border border-slate-200/80 bg-white text-blue-600 shadow-sm'
                      : 'border border-transparent bg-transparent text-slate-600 hover:bg-white/70 hover:text-slate-800'
                  "
                  @click="createKpiTab = 'custom'"
                >
                  <i class="fas fa-pen shrink-0 text-sm" aria-hidden="true" />
                  <span class="min-w-0 flex-1 truncate leading-tight normal-case">Tạo mới KPI</span>
                </button>
                <button
                  type="button"
                  class="flex min-h-[36px] min-w-0 flex-row items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all sm:text-[11px] motion-reduce:transition-none"
                  :class="
                    createKpiTab === 'template'
                      ? 'border border-slate-200/80 bg-white text-blue-600 shadow-sm'
                      : 'border border-transparent bg-transparent text-slate-600 hover:bg-white/70 hover:text-slate-800'
                  "
                  @click="createKpiTab = 'template'"
                >
                  <i class="fas fa-th-large shrink-0 text-sm" aria-hidden="true" />
                  <span class="min-w-0 flex-1 truncate leading-tight normal-case">Từ Template</span>
                </button>
              </div>
            </div>

            <p
              v-if="!isEditingFromDiagnostics && createKpiTab === 'template' && bulkFormError"
              class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
              role="alert"
            >
              {{ bulkFormError }}
            </p>

            <div
              v-show="isEditingFromDiagnostics || createKpiTab === 'custom'"
              class="space-y-6"
            >
            <!-- Sao chép KPI — chỉ khi tạo mới -->
            <div
              v-if="!isEditingFromDiagnostics"
              class="rounded-lg border border-indigo-100 bg-indigo-50/90 p-4 shadow-sm ring-1 ring-indigo-100"
            >
              <div class="mb-3 flex items-center gap-2 text-indigo-900">
                <i class="fas fa-copy text-xs" aria-hidden="true" />
                <p class="text-[10px] font-bold uppercase tracking-wider">
                  Sao chép nhanh từ KPI đã có
                </p>
              </div>
              <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div class="w-full shrink-0 sm:w-36">
                  <label
                    for="gm-copy-source-year"
                    class="mb-1 block text-[9px] font-bold uppercase tracking-wider text-indigo-900/85"
                  >
                    Năm nguồn
                  </label>
                  <div class="relative">
                    <select
                      id="gm-copy-source-year"
                      v-model="copySourceYear"
                      class="w-full cursor-pointer appearance-none rounded-lg border border-indigo-200 bg-white py-2 pl-3 pr-9 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    >
                      <option v-for="c in copySourceYearOptions" :key="c.id" :value="c.id">
                        Năm {{ c.label }}
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
                  <div ref="copyKpiPickerSurfaceRef" class="relative">
                    <button
                      id="gm-copy-kpi-select"
                      type="button"
                      class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-white py-2 pl-3 pr-3 text-left text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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
                            : '-- Chọn KPI để tải thông tin & Assignment --'
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
                            placeholder="Gõ tên KPI để lọc…"
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
                            Không có KPI khớp “{{ copyKpiFilterQuery.trim() }}”.
                          </template>
                          <template v-else> Không có KPI trong danh sách. </template>
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
                Thông tin cơ bản &amp; phân loại
              </label>
              <div class="space-y-4">
                <div class="flex flex-col gap-3 sm:flex-row">
                  <div class="sm:w-1/3">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Perspective (BSC) <span class="text-rose-500">*</span>
                    </label>
                    <div class="relative">
                      <select
                        v-model="perspective"
                        class="input-required w-full cursor-pointer appearance-none rounded-md py-2 pl-3 pr-8 text-xs font-bold text-slate-800 outline-none transition-all"
                      >
                        <option v-for="o in BSC_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                      </select>
                      <i class="fas fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400" />
                    </div>
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
                    Loại hình KPI (cách thức giao) <span class="text-rose-500">*</span>
                  </label>
                  <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <button
                      type="button"
                      :class="typeCardClass('cascading')"
                      @click="kpiType = 'cascading'"
                    >
                      <span
                        class="absolute right-2.5 top-2.5 text-blue-600 transition-all"
                        :class="kpiType === 'cascading' ? 'opacity-100 scale-100' : 'scale-50 opacity-0'"
                      >
                        <i class="fas fa-check-circle text-base" />
                      </span>
                      <div class="mb-1.5 flex items-center gap-2">
                        <span class="rounded border border-slate-100 bg-slate-50 p-1">
                          <i class="fas fa-code-branch text-xs text-blue-600" />
                        </span>
                        <span class="text-xs font-bold text-slate-800">Cascading KPI</span>
                      </div>
                      <p class="text-[11px] font-medium leading-tight text-slate-500">
                        Giao cho PM phân rã tiếp.
                      </p>
                    </button>

                    <button
                      type="button"
                      :class="typeCardClass('individual')"
                      @click="kpiType = 'individual'"
                    >
                      <span
                        class="absolute right-2.5 top-2.5 text-blue-600 transition-all"
                        :class="kpiType === 'individual' ? 'opacity-100 scale-100' : 'scale-50 opacity-0'"
                      >
                        <i class="fas fa-check-circle text-base" />
                      </span>
                      <div class="mb-1.5 flex items-center gap-2">
                        <span class="rounded border border-slate-100 bg-slate-50 p-1">
                          <i class="fas fa-crosshairs text-xs text-slate-600" />
                        </span>
                        <span class="text-xs font-bold text-slate-800">Individual KPI</span>
                      </div>
                      <p class="text-[11px] font-medium leading-tight text-slate-500">
                        Giao hàng loạt cho Rank.
                      </p>
                    </button>

                    <button
                      type="button"
                      :class="typeCardClass('promotion')"
                      @click="kpiType = 'promotion'"
                    >
                      <span
                        class="absolute right-2.5 top-2.5 text-purple-600 transition-all"
                        :class="kpiType === 'promotion' ? 'opacity-100 scale-100' : 'scale-50 opacity-0'"
                      >
                        <i class="fas fa-check-circle text-base" />
                      </span>
                      <div class="mb-1.5 flex items-center gap-2">
                        <span class="rounded border border-slate-100 bg-slate-50 p-1 shadow-sm">
                          <i class="fas fa-user-plus text-xs text-purple-600" />
                        </span>
                        <span class="text-xs font-bold text-slate-800">Promotion KPI</span>
                      </div>
                      <p class="text-[11px] font-medium leading-tight text-slate-500">
                        Giao đích danh cá nhân.
                      </p>
                    </button>
                  </div>
                </div>

                <div class="flex items-center gap-2 rounded-md border border-slate-200/90 bg-slate-50/60 px-2.5 py-1.5">
                  <input
                    id="gm-kpi-important"
                    v-model="isImportantKpi"
                    type="checkbox"
                    class="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-amber-500 focus:ring-amber-400/50"
                  />
                  <label for="gm-kpi-important" class="cursor-pointer text-[11px] font-semibold text-slate-600">
                    KPI quan trọng
                  </label>
                </div>

                <div
                  class="grid grid-cols-1 gap-4"
                  :class="kpiType === 'cascading' ? 'sm:grid-cols-2 sm:gap-x-6' : ''"
                >
                  <div v-if="kpiType === 'cascading'" class="min-w-0">
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
                      Trọng số (Weight) <span class="text-rose-500">*</span>
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
                    <div class="relative">
                      <select
                        v-model="unit"
                        class="input-required min-h-[38px] w-full cursor-pointer appearance-none rounded-md py-2 pl-2.5 pr-7 text-xs font-bold text-slate-800 outline-none transition-all"
                      >
                        <option v-for="u in UNIT_OPTIONS" :key="u.value" :value="u.value">{{ u.label }}</option>
                      </select>
                      <i class="fas fa-chevron-down pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400" />
                    </div>
                  </div>
                  <div class="min-w-0">
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Năm đánh giá <span class="text-rose-500">*</span>
                    </label>
                    <div class="relative w-full">
                      <select
                        v-model="formCycleId"
                        class="input-required min-h-[38px] w-full cursor-pointer appearance-none rounded-md py-2 pl-2.5 pr-7 text-xs font-bold text-slate-800 outline-none transition-all"
                      >
                        <option v-for="c in evaluationYearOptions" :key="c.id" :value="c.id">
                          {{ c.label }}
                        </option>
                      </select>
                      <i class="fas fa-chevron-down pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400" />
                    </div>
                  </div>
                </div>

                <!-- Phân loại cách tính (= công thức KPI) -->
                <div>
                  <div class="mb-1.5 flex items-center gap-1.5">
                    <label class="block flex-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Phân loại cách tính <span class="text-rose-500">*</span>
                    </label>
                    <span
                      v-if="calculationMethod !== 'manual_member_input'"
                      class="inline-flex shrink-0 cursor-help text-slate-400 transition-colors hover:text-blue-600"
                      :title="selectedFormulaExpression"
                      tabindex="0"
                      role="note"
                      aria-label="Biểu thức công thức đang chọn"
                    >
                      <i class="fas fa-circle-question text-[12px]" aria-hidden="true" />
                    </span>
                  </div>
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
                    <div
                      class="relative min-w-0 w-full sm:min-w-[22rem] md:min-w-[26rem] lg:min-w-[28rem] sm:flex-[1.35]"
                    >
                      <select
                        v-model="calculationMethod"
                        class="input-required min-h-[38px] w-full appearance-none rounded-md py-2 pr-7 text-xs font-bold text-slate-800 outline-none transition-all"
                        :class="[
                          calculationMethod === 'manual_member_input' ? 'pl-2.5' : 'cursor-help pl-8',
                          formErrors.calculationMethod ? '!border-rose-400 !bg-rose-50/50' : '',
                        ]"
                        :title="
                          calculationMethod === 'manual_member_input' ? undefined : selectedFormulaExpression
                        "
                      >
                        <option
                          v-for="f in formulaOptions"
                          :key="f.value"
                          :value="f.value"
                          :title="f.expression"
                        >
                          {{ f.label }}
                        </option>
                      </select>
                      <i
                        v-if="calculationMethod !== 'manual_member_input'"
                        class="fas fa-calculator pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                        aria-hidden="true"
                      />
                      <i class="fas fa-chevron-down pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400" />
                    </div>
                    <div
                      v-if="calculationMethod === 'mean_by_ratio'"
                      class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-slate-200/90 bg-slate-50/70 px-2.5 py-2"
                    >
                      <span class="text-[9px] font-bold uppercase tracking-wide text-slate-400">Tỉ lệ</span>
                      <label
                        class="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-700"
                      >
                        <input
                          v-model="meanRatioKind"
                          type="radio"
                          name="gm-kpi-mean-ratio"
                          value="actual_plan"
                          class="h-3.5 w-3.5 border-slate-300 text-slate-700 focus:ring-slate-400/40"
                        />
                        Actual/Plan
                      </label>
                      <label
                        class="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-700"
                      >
                        <input
                          v-model="meanRatioKind"
                          type="radio"
                          name="gm-kpi-mean-ratio"
                          value="plan_actual"
                          class="h-3.5 w-3.5 border-slate-300 text-slate-700 focus:ring-slate-400/40"
                        />
                        Plan/Actual
                      </label>
                    </div>
                    <div
                      v-else-if="calculationMethod === 'mean_by_aggregate'"
                      class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-slate-200/90 bg-slate-50/70 px-2.5 py-2"
                    >
                      <span class="text-[9px] font-bold uppercase tracking-wide text-slate-400">Gộp</span>
                      <label
                        class="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-700"
                      >
                        <input
                          v-model="meanAggregateKind"
                          type="radio"
                          name="gm-kpi-mean-agg"
                          value="average"
                          class="h-3.5 w-3.5 border-slate-300 text-slate-700 focus:ring-slate-400/40"
                        />
                        AVG
                      </label>
                      <label
                        class="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-700"
                      >
                        <input
                          v-model="meanAggregateKind"
                          type="radio"
                          name="gm-kpi-mean-agg"
                          value="sum"
                          class="h-3.5 w-3.5 border-slate-300 text-slate-700 focus:ring-slate-400/40"
                        />
                        SUM
                      </label>
                    </div>
                  </div>
                  <p v-if="formErrors.calculationMethod" class="mt-1 text-[10px] font-semibold text-rose-600">
                    {{ formErrors.calculationMethod }}
                  </p>
                </div>

                <div>
                  <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Description
                    <span class="text-[9px] font-normal normal-case text-slate-400">(Optional)</span>
                  </label>
                  <textarea
                    v-model="description"
                    rows="2"
                    placeholder="Giải thích ngắn gọn về mục tiêu và cách đo lường..."
                    class="custom-scrollbar w-full resize-none rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>
              </div>
            </div>

          <!-- Phân bổ / Giao việc -->
          <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="mb-3 flex items-center justify-between gap-2">
              <label class="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-800">
                <span class="rounded-lg bg-slate-100 p-1.5 text-indigo-600">
                  <i class="fas fa-diagram-project text-sm" />
                </span>
                Phân bổ / Giao việc
              </label>
            </div>

            <div>
              <label class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {{ assignLabel }}
                <span class="text-[9px] font-semibold text-slate-400"> (Optional)</span>
              </label>

              <!-- Cascading: PM multi — ref chỉ bọc trigger + list; khối target nằm ngoài để click đóng list -->
              <div v-if="kpiType === 'cascading'" class="space-y-3">
                <div ref="assignPmSurfaceRef" class="relative">
                  <button
                    type="button"
                    class="input-optional relative flex min-h-[38px] w-full flex-wrap items-center gap-1.5 rounded-md py-1.5 pl-8 pr-7 text-left text-xs font-bold text-slate-700 transition-all"
                    @click.stop="toggleAssignPmDropdown"
                  >
                    <span v-if="selectedPMs.length === 0" class="w-full font-medium text-slate-400">
                      Chọn một hoặc nhiều Project Manager...
                    </span>
                    <span
                      v-for="pm in selectedPMs"
                      :key="pm"
                      class="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-blue-200 bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 shadow-sm"
                    >
                      {{ pm }}
                      <button
                        type="button"
                        class="rounded p-0.5 text-blue-600 transition hover:bg-blue-200/60"
                        aria-label="Bỏ chọn PM"
                        @click.stop="togglePm(pm)"
                      >
                        <i class="fas fa-times text-[9px]" />
                      </button>
                    </span>
                  </button>
                  <i class="fas fa-users pointer-events-none absolute left-2.5 top-2.5 text-[10px] text-slate-400" />
                  <i class="fas fa-chevron-down pointer-events-none absolute right-2.5 top-2.5 text-[10px] text-slate-400" />

                  <div
                    v-show="assignDropdown === 'pm'"
                    class="custom-scrollbar absolute left-0 z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl"
                    @click.stop
                  >
                    <label
                      v-for="pm in PM_OPTIONS"
                      :key="pm.val"
                      class="group flex cursor-pointer items-center border-b border-slate-100 px-4 py-2.5 transition-colors last:border-0 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        class="mr-3 h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        :checked="pmSelected(pm.val)"
                        @change="togglePm(pm.val)"
                      />
                      <span class="text-sm font-bold text-slate-700 group-hover:text-blue-600">{{ pm.label }}</span>
                    </label>
                  </div>
                </div>

                <div
                  v-if="selectedPMs.length > 0"
                  class="space-y-2 rounded-xl border border-blue-100 bg-blue-50/50 p-4 shadow-inner"
                >
                  <p class="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase text-blue-800">
                    <i class="fas fa-crosshairs text-[10px]" />
                    Set Specific Targets for PMs
                  </p>
                  <div
                    v-for="pm in selectedPMs"
                    :key="pm"
                    class="flex flex-col justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm sm:flex-row sm:items-center sm:gap-4"
                  >
                    <span class="flex items-center gap-1.5 truncate text-[11px] font-bold text-slate-700 sm:w-1/2">
                      <i class="fas fa-user text-[10px] text-slate-400" />
                      {{ PM_OPTIONS.find((p) => p.val === pm)?.label ?? pm }}
                    </span>
                    <div class="flex items-center gap-2 sm:w-1/2">
                      <input
                        v-model="pmTargets[pm]"
                        type="number"
                        placeholder="Target..."
                        class="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 outline-none transition-all focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                      />
                      <span class="shrink-0 text-[10px] font-bold text-slate-400">{{ unit }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Independent: rank chips + member override -->
              <div v-else-if="kpiType === 'individual'" class="space-y-4">
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                  <label
                    v-for="rk in RANK_OPTIONS"
                    :key="rk.val"
                    class="flex cursor-pointer items-center gap-2 rounded-lg border bg-white p-2 shadow-sm transition-colors hover:bg-blue-50/50"
                    :class="
                      selectedRanks.includes(rk.val)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200'
                    "
                  >
                    <input
                      type="checkbox"
                      class="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      :checked="isRankFullySelected(rk.val)"
                      :indeterminate="isRankPartiallySelected(rk.val)"
                      @change="toggleRank(rk.val)"
                    />
                    <div class="flex min-w-0 flex-col leading-none">
                      <span
                        class="text-xs font-bold"
                        :class="selectedRanks.includes(rk.val) ? 'text-blue-700' : 'text-slate-700'"
                      >{{ rk.val }}</span>
                      <span class="mt-1 block truncate text-[9px] text-slate-500" :title="rk.label">{{ rk.label }}</span>
                    </div>
                  </label>
                </div>

                <div v-if="selectedRanks.length > 0" class="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                  <div>
                    <p class="text-[10px] font-bold uppercase tracking-wider text-blue-700">Danh sách member theo rank</p>
                  </div>

                  <div class="relative">
                    <i
                      class="fas fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                    />
                    <input
                      v-model="individualRankMemberSearch"
                      type="text"
                      placeholder="Nhập tên member hoặc section để tìm kiếm..."
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
                            Đã chọn {{ rankCard.selectedCount }}/{{ rankCard.totalCount }} member
                          </p>
                        </div>
                        <i
                          class="fas fa-chevron-down text-xs text-slate-400 transition-transform duration-200"
                          :class="rankCard.isExpanded ? 'rotate-180' : ''"
                        />
                      </button>

                      <div v-if="rankCard.isExpanded" class="border-t border-slate-100 px-4 py-3">
                        <div v-if="rankCard.members.length === 0" class="text-xs font-medium text-slate-400">
                          Không tìm thấy member phù hợp với bộ lọc trong rank này.
                        </div>

                        <div v-else class="space-y-2">
                          <label
                            v-for="member in rankCard.members"
                            :key="member.val"
                            class="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 transition-colors hover:bg-slate-50"
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
                            <div class="min-w-0">
                              <p class="truncate text-xs font-bold text-slate-700">{{ member.short }}</p>
                              <p class="truncate text-[10px] text-slate-500">{{ member.dept }}</p>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    v-else
                    class="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-xs font-medium text-slate-500"
                  >
                    Không tìm thấy member phù hợp với từ khóa theo tên hoặc section.
                  </div>
                </div>
              </div>

              <!-- Direct: members — ref chỉ trigger + list -->
              <div v-else ref="assignMemberSurfaceRef" class="relative">
                <button
                  type="button"
                  class="input-optional relative flex min-h-[38px] w-full flex-wrap items-center gap-1.5 rounded-md py-1.5 pl-8 pr-7 text-left text-xs font-bold text-slate-700 transition-all"
                  @click.stop="assignDropdown = assignDropdown === 'member' ? null : 'member'"
                >
                  <span v-if="selectedMembers.length === 0" class="w-full font-medium text-slate-400">
                    Tìm và chọn nhiều thành viên...
                  </span>
                  <span
                    v-for="id in selectedMembers"
                    :key="id"
                    class="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-blue-200 bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 shadow-sm"
                  >
                    {{ memberByVal(id)?.short ?? id }}
                    <button
                      type="button"
                      class="rounded p-0.5 text-blue-600 transition hover:bg-blue-200/60"
                      aria-label="Bỏ chọn thành viên"
                      @click.stop="toggleMember(id)"
                    >
                      <i class="fas fa-times text-[9px]" />
                    </button>
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
                  <div class="custom-scrollbar flex-1 overflow-y-auto p-1">
                    <template v-if="filteredMemberOptions.length > 0">
                      <label
                        v-for="m in filteredMemberOptions"
                        :key="m.val"
                        class="group flex cursor-pointer items-center rounded-md border-b border-slate-50 px-3 py-2 transition-colors last:border-0 hover:bg-slate-50"
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
                        </div>
                      </label>
                    </template>
                    <p
                      v-else
                      class="px-3 py-4 text-center text-xs font-medium text-slate-500"
                    >
                      Không có thành viên khớp bộ lọc.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
            </div>

            <div
              v-show="!isEditingFromDiagnostics && createKpiTab === 'template'"
              class="space-y-4"
            >
              <div>
                <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Gói template KPI
                </label>
                <div class="relative">
                  <select
                    v-model="selectedTemplatePackId"
                    class="min-h-[38px] w-full cursor-pointer appearance-none rounded-md border border-slate-200 bg-white py-2 pl-2.5 pr-7 text-xs font-bold text-slate-800 outline-none transition-all"
                  >
                    <option value="">— Chọn template —</option>
                    <option v-for="p in KPI_TEMPLATE_PACKS" :key="p.id" :value="p.id">{{ p.label }}</option>
                  </select>
                  <i class="fas fa-chevron-down pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400" />
                </div>
              </div>

              <div
                v-if="selectedTemplatePackId && templateKpiRows.length > 0"
                class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div class="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
                  <input
                    ref="templateSelectAllCheckboxRef"
                    type="checkbox"
                    class="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-400/40"
                    :checked="templateAllRowsChecked"
                    @change="onTemplateSelectAllChange"
                  />
                  <span class="text-[10px] font-bold uppercase tracking-wide text-slate-600">Chọn tất cả</span>
                </div>
                <div class="custom-scrollbar max-h-[min(50vh,420px)] overflow-y-auto">
                  <div
                    v-for="(group, gi) in templateKpiGroupedByBsc"
                    :key="group.perspective"
                    :class="gi > 0 ? 'border-t border-slate-200' : ''"
                  >
                    <div
                      class="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-50/40 px-3 py-2"
                    >
                      <span class="text-[10px] font-bold uppercase tracking-wide text-slate-600">
                        {{ group.label }}
                      </span>
                    </div>
                    <ul class="divide-y divide-slate-100">
                      <li
                        v-for="row in group.rows"
                        :key="row.id"
                        class="flex items-center gap-3 px-3 py-2.5 text-xs hover:bg-slate-50/80"
                      >
                        <input
                          type="checkbox"
                          class="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-400/40"
                          :checked="!!templateKpiSelection[row.id]"
                          @change="onToggleTemplateRow(row.id, $event)"
                        />
                        <div class="flex min-w-0 flex-1 items-center gap-2">
                          <p class="min-w-0 flex-1 truncate font-semibold text-slate-800">
                            {{ row.name }}
                          </p>
                          <GmStrategicKpiTypeTag :type="row.kind" size="sm" class="shrink-0" />
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <p
                v-else-if="selectedTemplatePackId"
                class="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-900"
              >
                Gói template không có KPI.
              </p>
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
            v-if="isEditingFromDiagnostics || createKpiTab === 'custom'"
            type="button"
            class="flex items-center gap-1.5 rounded-lg bg-blue-600 px-6 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
            :disabled="saving"
            @click="save"
          >
            <i v-if="saving" class="fas fa-spinner fa-spin text-sm" />
            <i v-else class="fas fa-save text-sm" />
            {{ saving ? 'Saving...' : isEditingFromDiagnostics ? 'Lưu thay đổi' : 'Create KPI' }}
          </button>
          <button
            v-if="!isEditingFromDiagnostics && createKpiTab === 'template'"
            type="button"
            class="flex items-center gap-1.5 rounded-lg bg-blue-600 px-6 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="saving || !canBulkCreateFromTemplate"
            :title="templateBulkCreateDisabledTitle || undefined"
            @click="bulkCreateFromTemplate"
          >
            <i v-if="saving" class="fas fa-spinner fa-spin text-sm" />
            <i v-else class="fas fa-layer-group text-sm" />
            {{ saving ? 'Đang tạo...' : 'Tạo các KPI đã chọn' }}
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
