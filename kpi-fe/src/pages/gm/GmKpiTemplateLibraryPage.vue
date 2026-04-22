<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  inject,
  onBeforeMount,
  onUnmounted,
  nextTick,
  unref,
  type Ref,
  type ComputedRef,
} from 'vue'
import GmTemplateSuiteKpiFormDrawer from '@/components/gm/GmTemplateSuiteKpiFormDrawer.vue'
import GmStrategicKpiTypeTag from '@/components/gm/GmStrategicKpiTypeTag.vue'
import { normalizeStrategicKpiKind, type GmStrategicKpiKind } from '@/mocks/gm-kpi.mock'

/** Drawer gắn `body` + `left-64` để khớp sidebar GM — tránh `absolute` trong anchor bị cắt bởi `overflow-hidden` / stacking. */

type SuiteColor = 'blue' | 'indigo' | 'amber' | 'emerald'

interface TemplateKpiDef {
  name: string
  weight: number
  target: string
  /** Snapshot form KPI (khi thêm qua drawer riêng). */
  draftPayload?: Record<string, unknown>
}

interface KpiTemplateSuite {
  id: string
  name: string
  code: string
  description: string
  color: SuiteColor
  kpis: TemplateKpiDef[]
}

type BscPerspective = 'financial' | 'customer' | 'internal' | 'learning'

/** Lấy số đầu tiên từ chuỗi target hiển thị (mock) — dùng làm targetValue cascading. */
function mockTargetValueFromDisplay(target: string): string {
  const m = /(\d+(?:\.\d+)?)/.exec(String(target ?? '').replace(/\u00a0/g, ' '))
  return m ? m[1]! : '90'
}

/** Snapshot tối thiểu giống emit form template KPI — để nhóm BSC + mở sửa được. */
function mockKpiDraftPayload(args: {
  name: string
  weight: number
  targetDisplay: string
  perspective: BscPerspective
  unit?: string
  evaluationDirection?: 'maximize' | 'minimize'
}): Record<string, unknown> {
  const y = String(new Date().getFullYear())
  const evaluationDirection = args.evaluationDirection ?? 'maximize'
  return {
    kpiType: 'cascading',
    perspective: args.perspective,
    kpiName: args.name,
    description: '',
    targetValue: mockTargetValueFromDisplay(args.targetDisplay),
    unit: args.unit ?? 'POINT',
    weightPct: String(args.weight),
    cycleId: y,
    calculationMethod: 'mean_actual_plan',
    evaluationDirection,
    isImportant: false,
    assignPMs: [] as string[],
    pmTargets: {} as Record<string, string>,
    startDate: `${y}-01-01`,
    endDate: `${y}-12-31`,
  }
}

/** Dữ liệu mẫu — mỗi KPI có `draftPayload` (BSC + form) để nhóm đúng và nút Sửa hoạt động. */
const INITIAL_TEMPLATE_SUITES: KpiTemplateSuite[] = [
  {
    id: 'agile',
    name: 'Agile/Scrum Engineering',
    code: 'TPL-AGILE',
    description: 'Bộ tiêu chuẩn đánh giá hiệu suất team Dev theo mô hình Agile.',
    color: 'blue',
    kpis: [
      {
        name: 'Sprint Velocity',
        weight: 40,
        target: '100%',
        draftPayload: mockKpiDraftPayload({
          name: 'Sprint Velocity',
          weight: 40,
          targetDisplay: '100%',
          perspective: 'internal',
        }),
      },
      {
        name: 'Defect Escape Rate',
        weight: 30,
        target: '< 5%',
        draftPayload: mockKpiDraftPayload({
          name: 'Defect Escape Rate',
          weight: 30,
          targetDisplay: '< 5%',
          perspective: 'internal',
          evaluationDirection: 'minimize',
        }),
      },
      {
        name: 'Code Coverage',
        weight: 30,
        target: '> 80%',
        draftPayload: mockKpiDraftPayload({
          name: 'Code Coverage',
          weight: 30,
          targetDisplay: '> 80%',
          perspective: 'learning',
        }),
      },
    ],
  },
  {
    id: 'bsc_tech',
    name: 'BSC for Tech Dept',
    code: 'TPL-TECH',
    description: 'Đánh giá toàn diện mảng Tech theo 4 khía cạnh Balanced Scorecard.',
    color: 'indigo',
    kpis: [
      {
        name: 'Tỷ lệ hoàn thành dự án',
        weight: 30,
        target: '> 95%',
        draftPayload: mockKpiDraftPayload({
          name: 'Tỷ lệ hoàn thành dự án',
          weight: 30,
          targetDisplay: '> 95%',
          perspective: 'internal',
        }),
      },
      {
        name: 'Chỉ số Chất lượng (Quality Index)',
        weight: 30,
        target: '98%',
        draftPayload: mockKpiDraftPayload({
          name: 'Chỉ số Chất lượng (Quality Index)',
          weight: 30,
          targetDisplay: '98%',
          perspective: 'customer',
        }),
      },
      {
        name: 'Training Hours',
        weight: 20,
        target: '40h/member',
        draftPayload: mockKpiDraftPayload({
          name: 'Training Hours',
          weight: 20,
          targetDisplay: '40',
          perspective: 'learning',
          unit: 'MM',
        }),
      },
      {
        name: 'Cost Optimization',
        weight: 20,
        target: '10%',
        draftPayload: mockKpiDraftPayload({
          name: 'Cost Optimization',
          weight: 20,
          targetDisplay: '10%',
          perspective: 'financial',
        }),
      },
    ],
  },
  {
    id: 'qa',
    name: 'Quality Assurance Standard',
    code: 'TPL-QA',
    description: 'Bộ chỉ số đo lường chất lượng sản phẩm (QA/QC).',
    color: 'emerald',
    kpis: [
      {
        name: 'Test Automation Coverage',
        weight: 50,
        target: '> 90%',
        draftPayload: mockKpiDraftPayload({
          name: 'Test Automation Coverage',
          weight: 50,
          targetDisplay: '> 90%',
          perspective: 'internal',
        }),
      },
      {
        name: 'UAT Bug Count',
        weight: 50,
        target: '< 3',
        draftPayload: mockKpiDraftPayload({
          name: 'UAT Bug Count',
          weight: 50,
          targetDisplay: '< 3',
          perspective: 'customer',
          evaluationDirection: 'minimize',
        }),
      },
    ],
  },
  {
    id: 'sale',
    name: 'Sales Performance',
    code: 'TPL-SALE',
    description: 'Dành cho các team kinh doanh thị trường.',
    color: 'amber',
    kpis: [
      {
        name: 'Doanh thu thuần (Net Revenue)',
        weight: 50,
        target: '100%',
        draftPayload: mockKpiDraftPayload({
          name: 'Doanh thu thuần (Net Revenue)',
          weight: 50,
          targetDisplay: '100%',
          perspective: 'financial',
        }),
      },
      {
        name: 'Tỷ lệ chốt deal (Win rate)',
        weight: 30,
        target: '> 25%',
        draftPayload: mockKpiDraftPayload({
          name: 'Tỷ lệ chốt deal (Win rate)',
          weight: 30,
          targetDisplay: '> 25%',
          perspective: 'customer',
        }),
      },
      {
        name: 'Khách hàng mới',
        weight: 20,
        target: '20 Khách',
        draftPayload: mockKpiDraftPayload({
          name: 'Khách hàng mới',
          weight: 20,
          targetDisplay: '20 Khách',
          perspective: 'customer',
        }),
      },
    ],
  },
]

function templateCardTheme(c: SuiteColor) {
  const map: Record<SuiteColor, { box: string; text: string; border: string }> = {
    blue: { box: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
    indigo: { box: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100' },
    amber: { box: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
    emerald: { box: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
  }
  return map[c] ?? map.indigo
}

type GmKpiTemplateLibraryHost = { openCreate: () => void }
const gmKpiTemplateLibrary = inject<GmKpiTemplateLibraryHost | null>('gmKpiTemplateLibrary', null)

const gmEvaluationYear = inject<Ref<number> | ComputedRef<number> | null>('gmEvaluationYear', null)
const cycleIdForKpiDraft = computed(() =>
  gmEvaluationYear != null ? String(unref(gmEvaluationYear)) : String(new Date().getFullYear()),
)

const BSC_LABEL: Record<string, string> = {
  financial: 'Financial',
  customer: 'Customer',
  internal: 'Internal Process',
  learning: 'Learning & Growth',
}

function bscLabel(p: unknown): string {
  const k = String(p ?? '').trim()
  return BSC_LABEL[k] ?? (k || '—')
}

const BSC_PERSPECTIVE_ORDER = ['financial', 'customer', 'internal', 'learning'] as const

const BSC_SECTION_LABEL: Record<string, string> = {
  financial: '💰 Financial',
  customer: '👥 Customer',
  internal: '⚙️ Internal Process',
  learning: '🎓 Learning & Growth',
  _unassigned: 'Chưa gán BSC',
}

function perspectiveKeyFromDef(def: TemplateKpiDef): string {
  const raw = String(def.draftPayload?.perspective ?? '').trim()
  return (BSC_PERSPECTIVE_ORDER as readonly string[]).includes(raw) ? raw : '_unassigned'
}

interface BscDraftGroup {
  key: string
  label: string
  rows: TemplateKpiDraftRow[]
}

interface BscDetailItem {
  kpi: TemplateKpiDef
  index: number
}

interface BscDetailGroup {
  key: string
  label: string
  items: BscDetailItem[]
}

function groupDraftKpisByBsc(rows: TemplateKpiDraftRow[]): BscDraftGroup[] {
  const buckets = new Map<string, TemplateKpiDraftRow[]>()
  for (const k of BSC_PERSPECTIVE_ORDER) buckets.set(k, [])
  buckets.set('_unassigned', [])
  for (const row of rows) {
    const key = perspectiveKeyFromDef(row.def)
    ;(buckets.get(key) ?? buckets.get('_unassigned')!).push(row)
  }
  const out: BscDraftGroup[] = []
  for (const k of BSC_PERSPECTIVE_ORDER) {
    const r = buckets.get(k) ?? []
    if (r.length) out.push({ key: k, label: BSC_SECTION_LABEL[k]!, rows: r })
  }
  const u = buckets.get('_unassigned') ?? []
  if (u.length) out.push({ key: '_unassigned', label: BSC_SECTION_LABEL._unassigned, rows: u })
  return out
}

function groupDetailKpisByBsc(kpis: TemplateKpiDef[]): BscDetailGroup[] {
  const indexed: BscDetailItem[] = kpis.map((kpi, index) => ({ kpi, index }))
  const buckets = new Map<string, BscDetailItem[]>()
  for (const k of BSC_PERSPECTIVE_ORDER) buckets.set(k, [])
  buckets.set('_unassigned', [])
  for (const item of indexed) {
    const key = perspectiveKeyFromDef(item.kpi)
    ;(buckets.get(key) ?? buckets.get('_unassigned')!).push(item)
  }
  const out: BscDetailGroup[] = []
  for (const k of BSC_PERSPECTIVE_ORDER) {
    const items = buckets.get(k) ?? []
    if (items.length) out.push({ key: k, label: BSC_SECTION_LABEL[k]!, items })
  }
  const u = buckets.get('_unassigned') ?? []
  if (u.length) out.push({ key: '_unassigned', label: BSC_SECTION_LABEL._unassigned, items: u })
  return out
}

/** Nhãn công thức đã lưu trong `draftPayload.calculationMethod` (đồng bộ với form Strategic KPI). */
const CALC_METHOD_LABELS: Record<string, string> = {
  manual_member_input: 'Tự nhập — theo số member nhập',
  mean_actual_plan: 'Trung bình — theo tỉ lệ Actual/Plan',
  mean_plan_actual: 'Trung bình — theo tỉ lệ Plan/Actual',
  mean_plan_actual_pct: 'Trung bình — gộp AVG',
  mean_plan_actual_sum: 'Trung bình — gộp SUM',
}

function detailSuiteKpiType(kpi: TemplateKpiDef): GmStrategicKpiKind | null {
  const raw = kpi.draftPayload?.kpiType
  if (raw == null || String(raw).trim() === '') return null
  return normalizeStrategicKpiKind(raw)
}

/** Tag loại KPI sát tên (như bảng diagnostics) — dữ liệu mẫu cũ không có snapshot thì hiển thị Cascading. */
function detailSuiteKpiTypeForTag(kpi: TemplateKpiDef): GmStrategicKpiKind {
  return detailSuiteKpiType(kpi) ?? 'cascading'
}

function detailSuiteKpiWeightDisplay(kpi: TemplateKpiDef): string {
  if (Number.isFinite(kpi.weight) && kpi.weight > 0) return `${kpi.weight}%`
  const w = String(kpi.draftPayload?.weightPct ?? '')
    .trim()
    .replace(/%/g, '')
  const n = Number.parseFloat(w)
  if (Number.isFinite(n) && n > 0) return `${Math.round(n)}%`
  return '-'
}

function detailSuiteKpiTargetDisplay(kpi: TemplateKpiDef): string {
  const p = kpi.draftPayload
  if (!p) return '-'
  const ktype = String(p.kpiType ?? 'cascading')
  if (ktype === 'cascading') {
    const tv = String(p.targetValue ?? '').trim()
    const u = String(p.unit ?? '').trim()
    const joined = [tv, u].filter(Boolean).join(' ')
    return joined || '-'
  }
  /** Individual / Promotion: không có targetValue trong form → không hiển thị «Theo MM» (unit không phải mục tiêu). */
  const tv = String(p.targetValue ?? '').trim()
  if (!tv) return '-'
  const u = String(p.unit ?? '').trim()
  const joined = [tv, u].filter(Boolean).join(' ')
  return joined || tv
}

function detailSuiteKpiFormulaDisplay(kpi: TemplateKpiDef): string {
  const p = kpi.draftPayload
  if (!p) return '-'
  const cm = String(p.calculationMethod ?? '').trim()
  if (!cm) return '-'
  return CALC_METHOD_LABELS[cm] ?? cm
}

const templateSuites = ref<KpiTemplateSuite[]>(structuredClone(INITIAL_TEMPLATE_SUITES))
const templateSearch = ref('')

const filteredSuites = computed(() => {
  const q = templateSearch.value.trim().toLowerCase()
  if (!q) return templateSuites.value
  return templateSuites.value.filter((t) => {
    const hay = `${t.name} ${t.code} ${t.description}`.toLowerCase()
    return hay.includes(q)
  })
})

/** Chi tiết */
const detailOpen = ref(false)
const detailSuiteId = ref<string | null>(null)
const detailSuite = computed(() => {
  const id = detailSuiteId.value
  if (!id) return null
  return templateSuites.value.find((s) => s.id === id) ?? null
})

function openDetail(id: string) {
  if (createOpen.value) {
    resetCreateForm()
    createOpen.value = false
  }
  detailSuiteId.value = id
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
  detailSuiteId.value = null
}

/** Chỉ dùng cho tạo bộ mẫu mới (không còn «chỉnh sửa bộ» qua drawer lớn). */
const createOpen = ref(false)
const tplName = ref('')
const tplDesc = ref('')

interface TemplateKpiDraftRow {
  id: string
  def: TemplateKpiDef
}

function newDraftId(): string {
  return `d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const draftKpis = ref<TemplateKpiDraftRow[]>([])
const showKpiDraftDrawer = ref(false)
const kpiDraftInitialPayload = ref<Record<string, unknown> | null>(null)
const kpiDraftReplaceRowId = ref<string | null>(null)
/** Sửa KPI từ drawer chi tiết — cập nhật thẳng `templateSuites`, không mở drawer tạo bộ. */
const kpiDetailEditSuiteId = ref<string | null>(null)
const kpiDetailEditKpiIndex = ref<number | null>(null)
/** Thêm KPI mới từ drawer chi tiết — append vào `templateSuites`, không mở drawer tạo bộ. */
const kpiAppendSuiteId = ref<string | null>(null)

/** Modal chỉ sửa tên + mô tả bộ (từ chi tiết). */
const suiteMetaModalOpen = ref(false)
const suiteMetaSuiteId = ref<string | null>(null)
const suiteMetaName = ref('')
const suiteMetaDesc = ref('')

/** Modal xác nhận xóa bộ hoặc xóa KPI (thay cho `confirm()`). */
type DeleteConfirmPayload =
  | { kind: 'suite'; suiteId: string; suiteName: string }
  | { kind: 'kpi'; suiteId: string; kpiIndex: number; kpiName: string }

const deleteConfirmPayload = ref<DeleteConfirmPayload | null>(null)

watch(showKpiDraftDrawer, (v) => {
  if (!v) {
    kpiDraftInitialPayload.value = null
    kpiDraftReplaceRowId.value = null
    kpiDetailEditSuiteId.value = null
    kpiDetailEditKpiIndex.value = null
    kpiAppendSuiteId.value = null
  }
})

const groupedDraftKpis = computed(() => groupDraftKpisByBsc(draftKpis.value))
const groupedDetailKpis = computed(() =>
  detailSuite.value ? groupDetailKpisByBsc(detailSuite.value.kpis) : [],
)

function templateDefFromStrategicPayload(p: Record<string, unknown>): TemplateKpiDef {
  const name = String(p.kpiName ?? '').trim()
  const weight = Math.round(Number.parseFloat(String(p.weightPct ?? 0)) || 0)
  const kpiTypeNorm = normalizeStrategicKpiKind(p.kpiType)
  let target = '-'
  if (kpiTypeNorm === 'cascading') {
    const tv = String(p.targetValue ?? '').trim()
    const u = String(p.unit ?? '')
    const joined = [tv, u].filter(Boolean).join(' ')
    target = joined || '-'
  } else {
    const tv = String(p.targetValue ?? '').trim()
    if (tv) {
      const u = String(p.unit ?? '')
      target = [tv, u].filter(Boolean).join(' ') || tv
    } else {
      target = '-'
    }
  }
  const persRaw = String(p.perspective ?? '').trim()
  const allowedBsc = new Set(BSC_PERSPECTIVE_ORDER as unknown as string[])
  const perspectiveNorm = allowedBsc.has(persRaw) ? persRaw : 'internal'
  const cmRaw = String(p.calculationMethod ?? '').trim()
  const calculationMethodNorm = cmRaw || 'mean_actual_plan'

  const draftPayload: Record<string, unknown> = {
    ...p,
    perspective: perspectiveNorm,
    kpiType: kpiTypeNorm,
    calculationMethod: calculationMethodNorm,
  }

  return { name, weight, target, draftPayload }
}

function onTemplateKpiDraftAdded(payload: Record<string, unknown>) {
  const def = templateDefFromStrategicPayload(payload)
  const dSid = kpiDetailEditSuiteId.value
  const dIx = kpiDetailEditKpiIndex.value
  if (dSid != null && dIx != null) {
    const sIx = templateSuites.value.findIndex((s) => s.id === dSid)
    if (sIx >= 0) {
      const suite = templateSuites.value[sIx]!
      const nextKpis = [...suite.kpis]
      if (dIx >= 0 && dIx < nextKpis.length) {
        nextKpis[dIx] = def
        const nextSuites = [...templateSuites.value]
        nextSuites[sIx] = { ...suite, kpis: nextKpis }
        templateSuites.value = nextSuites
      }
    }
    return
  }
  const appendSid = kpiAppendSuiteId.value
  if (appendSid != null) {
    const sIx = templateSuites.value.findIndex((s) => s.id === appendSid)
    if (sIx >= 0) {
      const suite = templateSuites.value[sIx]!
      const nextKpis = [...suite.kpis, def]
      const nextSuites = [...templateSuites.value]
      nextSuites[sIx] = { ...suite, kpis: nextKpis }
      templateSuites.value = nextSuites
    }
    return
  }
  const replaceId = kpiDraftReplaceRowId.value
  if (replaceId) {
    draftKpis.value = draftKpis.value.map((r) => (r.id === replaceId ? { id: r.id, def } : r))
    return
  }
  draftKpis.value = [...draftKpis.value, { id: newDraftId(), def }]
}

function openAddKpiDraft() {
  kpiDraftReplaceRowId.value = null
  kpiDraftInitialPayload.value = null
  kpiDetailEditSuiteId.value = null
  kpiDetailEditKpiIndex.value = null
  kpiAppendSuiteId.value = null
  showKpiDraftDrawer.value = true
}

function openEditDraftKpi(row: TemplateKpiDraftRow) {
  if (!row.def.draftPayload) {
    return
  }
  kpiDetailEditSuiteId.value = null
  kpiDetailEditKpiIndex.value = null
  kpiAppendSuiteId.value = null
  kpiDraftReplaceRowId.value = row.id
  kpiDraftInitialPayload.value = { ...row.def.draftPayload }
  showKpiDraftDrawer.value = true
}

function removeDraftKpi(id: string) {
  draftKpis.value = draftKpis.value.filter((r) => r.id !== id)
}

function openDeleteKpiConfirm(index: number) {
  const id = detailSuiteId.value
  const s = detailSuite.value
  if (!id || !s) return
  const kpi = s.kpis[index]
  if (!kpi) return
  deleteConfirmPayload.value = { kind: 'kpi', suiteId: id, kpiIndex: index, kpiName: kpi.name }
}

function closeDeleteConfirmModal() {
  deleteConfirmPayload.value = null
}

function confirmDeleteExecute() {
  const d = deleteConfirmPayload.value
  if (!d) return
  if (d.kind === 'suite') {
    templateSuites.value = templateSuites.value.filter((t) => t.id !== d.suiteId)
    closeDetail()
  } else {
    const ix = templateSuites.value.findIndex((t) => t.id === d.suiteId)
    if (ix >= 0) {
      const suite = templateSuites.value[ix]!
      const nextKpis = suite.kpis.filter((_, i) => i !== d.kpiIndex)
      const nextSuites = [...templateSuites.value]
      nextSuites[ix] = { ...suite, kpis: nextKpis }
      templateSuites.value = nextSuites
    }
  }
  closeDeleteConfirmModal()
}

function editKpiFromDetailSuite(index: number) {
  const s = detailSuite.value
  const sid = detailSuiteId.value
  if (!s || !sid) return
  const kpi = s.kpis[index]
  if (!kpi?.draftPayload) {
    return
  }
  kpiDraftReplaceRowId.value = null
  kpiAppendSuiteId.value = null
  kpiDetailEditSuiteId.value = sid
  kpiDetailEditKpiIndex.value = index
  kpiDraftInitialPayload.value = { ...kpi.draftPayload }
  showKpiDraftDrawer.value = true
}

function openSuiteMetaModalFromDetail() {
  const s = detailSuite.value
  const id = detailSuiteId.value
  if (!s || !id) return
  suiteMetaNameError.value = ''
  suiteMetaSuiteId.value = id
  suiteMetaName.value = s.name
  suiteMetaDesc.value = s.description
  suiteMetaModalOpen.value = true
}

function closeSuiteMetaModal() {
  suiteMetaNameError.value = ''
  suiteMetaModalOpen.value = false
  suiteMetaSuiteId.value = null
}

function saveSuiteMetaFromModal() {
  const id = suiteMetaSuiteId.value
  if (!id) return
  const name = suiteMetaName.value.trim()
  if (!name) {
    suiteMetaNameError.value = 'Vui lòng nhập tên bộ mẫu (trường bắt buộc).'
    return
  }
  suiteMetaNameError.value = ''
  const ix = templateSuites.value.findIndex((t) => t.id === id)
  if (ix < 0) return
  const prev = templateSuites.value[ix]!
  const next = [...templateSuites.value]
  next[ix] = { ...prev, name, description: suiteMetaDesc.value.trim() }
  templateSuites.value = next
  closeSuiteMetaModal()
}

/** Thứ tự KPI trong draft (1-based), giống số thứ tự ở chi tiết. */
function draftRowOrderIndex(row: TemplateKpiDraftRow): number {
  const i = draftKpis.value.findIndex((r) => r.id === row.id)
  return i < 0 ? 0 : i + 1
}

const saving = ref(false)

/** Lỗi validate drawer «Tạo bộ KPI mẫu» (hiển thị trong UI, không dùng toast). */
const createFormValidationError = ref<string | null>(null)
/** Lỗi tên bắt buộc trong modal sửa meta bộ. */
const suiteMetaNameError = ref('')

watch(tplName, () => {
  createFormValidationError.value = null
})
watch(
  draftKpis,
  () => {
    createFormValidationError.value = null
  },
  { deep: true },
)

watch(suiteMetaName, () => {
  if (suiteMetaName.value.trim()) suiteMetaNameError.value = ''
})

function resetCreateForm() {
  createFormValidationError.value = null
  tplName.value = ''
  tplDesc.value = ''
  draftKpis.value = []
  showKpiDraftDrawer.value = false
  kpiDraftInitialPayload.value = null
  kpiDraftReplaceRowId.value = null
  kpiDetailEditSuiteId.value = null
  kpiDetailEditKpiIndex.value = null
  kpiAppendSuiteId.value = null
}

function openCreateDrawer() {
  closeDetail()
  resetCreateForm()
  createOpen.value = true
}

/** Thêm KPI vào bộ đang xem chi tiết — chỉ mở drawer form KPI. */
function openAppendKpiFromDetail() {
  const sid = detailSuiteId.value
  if (!sid) return
  kpiDraftReplaceRowId.value = null
  kpiDraftInitialPayload.value = null
  kpiDetailEditSuiteId.value = null
  kpiDetailEditKpiIndex.value = null
  kpiAppendSuiteId.value = sid
  showKpiDraftDrawer.value = true
}

function openDeleteSuiteConfirm() {
  const s = detailSuite.value
  const id = detailSuiteId.value
  if (!s || !id) return
  deleteConfirmPayload.value = { kind: 'suite', suiteId: id, suiteName: s.name }
}

function closeCreateDrawer() {
  createFormValidationError.value = null
  createOpen.value = false
  showKpiDraftDrawer.value = false
  kpiDetailEditSuiteId.value = null
  kpiDetailEditKpiIndex.value = null
  kpiAppendSuiteId.value = null
}

function codeForTemplateSave(): string {
  return `TPL-${Date.now()}`
}

function validateCreate(): string | null {
  if (!tplName.value.trim()) return 'Vui lòng nhập tên bộ template (trường bắt buộc).'
  for (const r of draftKpis.value) {
    if (!r.def.name.trim()) return 'Mỗi KPI phải có tên (trường bắt buộc) — kiểm tra danh sách bên dưới.'
  }
  return null
}

async function saveTemplateSuite() {
  const err = validateCreate()
  if (err) {
    createFormValidationError.value = err
    return
  }
  createFormValidationError.value = null
  saving.value = true
  await new Promise((r) => setTimeout(r, 400))
  saving.value = false

  const kpis: TemplateKpiDef[] = draftKpis.value
    .filter((r) => r.def.name.trim())
    .map((r) => ({
      name: r.def.name.trim(),
      target: r.def.target.trim() || '-',
      weight: Math.max(0, r.def.weight),
      ...(r.def.draftPayload ? { draftPayload: r.def.draftPayload } : {}),
    }))

  const code = codeForTemplateSave()
  const name = tplName.value.trim()
  const description = tplDesc.value.trim()

  const id = `tpl-${Date.now()}`
  const colors: SuiteColor[] = ['blue', 'indigo', 'amber', 'emerald']
  const color = colors[templateSuites.value.length % colors.length]!
  templateSuites.value = [
    ...templateSuites.value,
    { id, name, code, description, color, kpis },
  ]
  closeCreateDrawer()
}

onBeforeMount(() => {
  if (gmKpiTemplateLibrary) {
    gmKpiTemplateLibrary.openCreate = openCreateDrawer
  }
})

onUnmounted(() => {
  if (gmKpiTemplateLibrary) {
    gmKpiTemplateLibrary.openCreate = () => {}
  }
})
</script>

<template>
  <div class="w-full bg-slate-50/50 pb-16">
    <div class="mx-auto w-full max-w-none space-y-6 px-4 py-4 sm:px-6 lg:px-8">
      <!-- Search — gọn, không kéo full chiều ngang -->
      <div class="relative w-full max-w-xs sm:max-w-sm md:max-w-md">
        <i
          class="fas fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400"
          aria-hidden="true"
        />
        <input
          v-model="templateSearch"
          type="search"
          placeholder="Tìm kiếm bộ template..."
          class="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
        />
      </div>

      <!-- Grid thẻ -->
      <div
        v-if="filteredSuites.length > 0"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      >
        <article
          v-for="tpl in filteredSuites"
          :key="tpl.id"
          class="group flex cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-purple-300 hover:shadow-lg"
          role="button"
          tabindex="0"
          @click="openDetail(tpl.id)"
          @keydown.enter.prevent="openDetail(tpl.id)"
        >
          <div class="mb-3 flex min-w-0 items-center gap-3">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white shadow-sm transition-transform group-hover:scale-110"
              :class="[templateCardTheme(tpl.color).box, templateCardTheme(tpl.color).text, templateCardTheme(tpl.color).border]"
            >
              <i class="fas fa-table-columns text-lg" aria-hidden="true" />
            </div>
            <h3
              class="min-w-0 flex-1 text-sm font-bold leading-snug text-slate-800 transition-colors group-hover:text-purple-600"
            >
              {{ tpl.name }}
            </h3>
          </div>
          <div class="mb-4 min-h-0 flex-1">
            <p class="line-clamp-2 text-[11px] font-medium leading-relaxed text-slate-500">
              {{ tpl.description }}
            </p>
          </div>
          <div class="flex items-center justify-between border-t border-slate-100 pt-4">
            <span
              class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700"
            >
              <i class="fas fa-bullseye text-purple-500" aria-hidden="true" />
              {{ tpl.kpis.length }} KPIs
            </span>
            <span
              class="flex items-center gap-1 text-xs font-bold text-purple-600 transition-colors group-hover:text-purple-800"
            >
              Chi tiết
              <i class="fas fa-arrow-right text-[10px] transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </article>
      </div>

      <div
        v-else
        class="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-sm"
      >
        <i class="fas fa-magnifying-glass mb-3 text-3xl text-slate-300" aria-hidden="true" />
        <p class="text-sm font-bold text-slate-600">Không có bộ template khớp tìm kiếm</p>
        <p class="mt-1 text-xs text-slate-400">Thử đổi từ khóa theo tên, mã hoặc mô tả.</p>
      </div>
    </div>

    <!-- Drawer chi tiết — body + offset sidebar (w-64) -->
    <Teleport to="body">
      <Transition name="gm-tpl-drawer">
        <div
          v-if="detailOpen && detailSuite"
          class="fixed inset-0 z-[150] sm:left-64"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gm-tpl-detail-title"
        >
          <div
            class="gm-tpl-drawer-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
            @click="closeDetail"
          />
          <div
            class="gm-tpl-drawer-panel absolute bottom-0 right-0 top-0 flex w-full max-w-full flex-col border-l border-slate-200 bg-slate-50 shadow-2xl md:max-w-[700px] lg:max-w-[850px]"
          >
            <div
              class="z-10 flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <h2
                id="gm-tpl-detail-title"
                class="flex items-center gap-2 text-sm font-bold text-slate-800"
              >
                <i class="fas fa-table-columns text-purple-500" aria-hidden="true" />
                Chi tiết Bộ KPI Mẫu
              </h2>
              <button
                type="button"
                class="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Đóng"
                @click="closeDetail"
              >
                <i class="fas fa-times text-sm" aria-hidden="true" />
              </button>
            </div>

            <div
              class="relative shrink-0 overflow-hidden bg-[#1e293b] p-6 shadow-md"
            >
              <div class="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
              <div class="relative z-10 flex items-start gap-4">
                <div
                  class="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-purple-400/30 bg-purple-500/20 text-purple-300 shadow-inner"
                >
                  <i class="fas fa-table-columns text-xl" aria-hidden="true" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between gap-2">
                    <h3 class="min-w-0 flex-1 pr-2 text-xl font-bold leading-tight text-white">
                      {{ detailSuite.name }}
                    </h3>
                    <div class="flex shrink-0 gap-1">
                      <button
                        type="button"
                        class="rounded border border-white/20 bg-white/10 p-1.5 text-white transition-colors hover:bg-white/20"
                        title="Sửa tên và mô tả bộ mẫu"
                        @click.stop="openSuiteMetaModalFromDetail()"
                      >
                        <i class="fas fa-pen text-[11px]" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        class="rounded border border-white/20 bg-white/10 p-1.5 text-white transition-colors hover:bg-rose-500/20 hover:text-rose-200"
                        title="Xóa bộ mẫu"
                        @click.stop="openDeleteSuiteConfirm()"
                      >
                        <i class="fas fa-trash-can text-[11px]" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <p class="mt-3 border-t border-slate-600/50 pt-3 text-xs font-medium italic leading-relaxed text-slate-300">
                    {{ detailSuite.description || '—' }}
                  </p>
                </div>
              </div>
            </div>

            <div class="custom-scrollbar flex-1 space-y-4 overflow-y-auto bg-slate-50/50 p-5">
              <div
                class="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-end sm:justify-between"
              >
                <h4 class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                  <i class="fas fa-list-check text-purple-500" aria-hidden="true" />
                  Các chỉ số thành phần ({{ detailSuite.kpis.length }})
                </h4>
                <div class="flex flex-wrap items-center justify-end gap-2 sm:shrink-0">
                  <button
                    type="button"
                    class="inline-flex shrink-0 items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 transition-colors hover:bg-purple-100"
                    @click="openAppendKpiFromDetail"
                  >
                    <i class="fas fa-plus text-xs" aria-hidden="true" />
                    Thêm KPI
                  </button>
                </div>
              </div>
              <div class="space-y-5">
                <div v-for="g in groupedDetailKpis" :key="`${detailSuite.id}-${g.key}`" class="space-y-2">
                  <div
                    class="rounded-md border border-slate-200/90 bg-gradient-to-r from-slate-50 via-white to-slate-50/80 px-3 py-2"
                  >
                    <span class="text-[10px] font-bold uppercase tracking-wide text-slate-600">{{ g.label }}</span>
                  </div>
                  <div class="space-y-3">
                    <div
                      v-for="item in g.items"
                      :key="`${detailSuite.id}-${item.index}`"
                      class="group relative flex items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 pr-24 shadow-sm transition-all hover:border-purple-200 hover:shadow-md"
                    >
                      <div
                        class="absolute bottom-0 left-0 top-0 w-1 bg-purple-400 opacity-0 transition-opacity group-hover:opacity-100"
                      />
                      <div class="absolute right-2 top-2 z-10 flex gap-1">
                        <button
                          type="button"
                          class="rounded border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm transition-colors hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-200 disabled:hover:text-slate-500"
                          title="Sửa KPI (cần snapshot form)"
                          :disabled="!item.kpi.draftPayload"
                          @click.stop="editKpiFromDetailSuite(item.index)"
                        >
                          <i class="fas fa-pen text-[10px]" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          class="rounded border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                          title="Xóa KPI"
                          @click.stop="openDeleteKpiConfirm(item.index)"
                        >
                          <i class="fas fa-trash-can text-[10px]" aria-hidden="true" />
                        </button>
                      </div>
                      <div
                        class="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-100 text-xs font-bold text-slate-500"
                      >
                        {{ item.index + 1 }}
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 pr-2">
                          <i
                            v-if="item.kpi.draftPayload?.isImportant === true"
                            class="fas fa-star shrink-0 text-[11px] text-amber-500"
                            title="KPI quan trọng"
                            aria-hidden="true"
                          />
                          <span class="text-sm font-bold leading-snug text-slate-800">{{ item.kpi.name }}</span>
                          <GmStrategicKpiTypeTag
                            :type="detailSuiteKpiTypeForTag(item.kpi)"
                            size="md"
                            class="shrink-0"
                          />
                        </div>
                        <div
                          class="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-3"
                        >
                          <div class="min-w-0">
                            <p class="mb-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                              Trọng số
                            </p>
                            <p class="text-sm font-bold text-slate-800">
                              {{ detailSuiteKpiWeightDisplay(item.kpi) }}
                            </p>
                          </div>
                          <div class="min-w-0">
                            <p class="mb-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                              Target
                            </p>
                            <p class="break-words text-sm font-semibold text-slate-800">
                              {{ detailSuiteKpiTargetDisplay(item.kpi) }}
                            </p>
                          </div>
                          <div class="min-w-0">
                            <p class="mb-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                              Công thức tính
                            </p>
                            <p class="break-words text-sm font-semibold leading-snug text-slate-800">
                              {{ detailSuiteKpiFormulaDisplay(item.kpi) }}
                            </p>
                          </div>
                        </div>
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

    <!-- Drawer tạo / sửa -->
    <Teleport to="body">
      <Transition name="gm-tpl-drawer">
        <div
          v-if="createOpen"
          class="fixed inset-0 z-[150] sm:left-64"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gm-create-tpl-title"
        >
          <div
            class="gm-tpl-drawer-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
            @click="closeCreateDrawer"
          />
          <div
            class="gm-tpl-drawer-panel absolute bottom-0 right-0 top-0 flex w-full max-w-full flex-col border-l border-slate-200 bg-slate-50 shadow-2xl md:max-w-[700px] lg:max-w-[850px]"
          >
            <div
              class="z-10 flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white p-5 shadow-sm"
            >
              <div class="flex min-w-0 items-start gap-3">
                <div
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 shadow-sm"
                >
                  <i class="fas fa-table-columns text-lg" aria-hidden="true" />
                </div>
                <div class="min-w-0 pt-0.5">
                  <h2 id="gm-create-tpl-title" class="text-xl font-bold leading-tight text-slate-800">
                    Tạo bộ KPI mẫu
                  </h2>
                  <p class="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Tạo bộ KPI mẫu cho thư viện doanh nghiệp
                  </p>
                </div>
              </div>
              <button
                type="button"
                class="shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Đóng"
                @click="closeCreateDrawer"
              >
                <i class="fas fa-times text-lg" aria-hidden="true" />
              </button>
            </div>

            <div class="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-6">
              <div
                v-if="createFormValidationError"
                class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold leading-snug text-rose-900 shadow-sm"
                role="alert"
              >
                <p class="flex items-start gap-2">
                  <i class="fas fa-circle-exclamation mt-0.5 shrink-0 text-rose-600" aria-hidden="true" />
                  <span>{{ createFormValidationError }}</span>
                </p>
              </div>

              <section class="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 class="border-b border-slate-100 pb-3 text-sm font-bold text-slate-800">
                  Thông tin Bộ Template
                </h3>
                <div>
                  <label
                    for="gm-tpl-name"
                    class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
                  >
                    Tên Bộ Template <span class="text-rose-500">*</span>
                  </label>
                  <input
                    id="gm-tpl-name"
                    v-model="tplName"
                    type="text"
                    placeholder="e.g. BSC for Tech Department"
                    class="w-full rounded-lg border px-3 py-2 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:ring-1"
                    :class="
                      createFormValidationError && !tplName.trim()
                        ? 'border-rose-400 bg-rose-50/50 ring-rose-200 focus:border-rose-500 focus:ring-rose-200'
                        : 'border-purple-200 bg-purple-50/50 focus:border-purple-500 focus:bg-white focus:ring-purple-500'
                    "
                  />
                </div>
                <div>
                  <label
                    for="gm-tpl-desc"
                    class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
                  >
                    Mô tả mục đích sử dụng
                  </label>
                  <textarea
                    id="gm-tpl-desc"
                    v-model="tplDesc"
                    rows="2"
                    placeholder="Ghi chú rõ bộ KPI này nên dùng cho phòng ban nào..."
                    class="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </section>

              <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div class="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 class="text-sm font-bold text-slate-800">Danh sách KPIs cấu thành</h3>
                    <p class="mt-1 text-[10px] text-slate-500">
                      Thêm các KPI vào bộ template.
                    </p>
                  </div>
                  <button
                    type="button"
                    class="inline-flex shrink-0 items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 transition-colors hover:bg-purple-100"
                    @click="openAddKpiDraft"
                  >
                    <i class="fas fa-plus text-xs" aria-hidden="true" />
                    Thêm KPI
                  </button>
                </div>

                <p
                  v-if="draftKpis.length === 0"
                  class="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-xs font-medium text-slate-500"
                >
                  Chưa có KPI. Bấm «Thêm KPI» để mở form đầy đủ (giống tạo Strategic KPI, không phân bổ).
                </p>

                <div v-else class="space-y-5">
                  <div v-for="g in groupedDraftKpis" :key="`draft-${g.key}`" class="space-y-2">
                    <div
                      class="rounded-md border border-slate-200/90 bg-gradient-to-r from-slate-50 via-white to-slate-50/80 px-3 py-2"
                    >
                      <span class="text-[10px] font-bold uppercase tracking-wide text-slate-600">{{ g.label }}</span>
                    </div>
                    <div class="space-y-3">
                      <div
                        v-for="row in g.rows"
                        :key="row.id"
                        class="group relative flex items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 pr-24 shadow-sm transition-all hover:border-purple-200 hover:shadow-md"
                      >
                        <div
                          class="absolute bottom-0 left-0 top-0 w-1 bg-purple-400 opacity-0 transition-opacity group-hover:opacity-100"
                        />
                        <div class="absolute right-2 top-2 z-10 flex gap-1">
                          <button
                            type="button"
                            class="rounded border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm transition-colors hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-200 disabled:hover:text-slate-500"
                            title="Sửa KPI (cần snapshot form)"
                            :disabled="!row.def.draftPayload"
                            @click="openEditDraftKpi(row)"
                          >
                            <i class="fas fa-pen text-[10px]" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            class="rounded border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                            title="Xóa KPI"
                            @click="removeDraftKpi(row.id)"
                          >
                            <i class="fas fa-trash-can text-[10px]" aria-hidden="true" />
                          </button>
                        </div>
                        <div
                          class="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-100 text-xs font-bold text-slate-500"
                        >
                          {{ draftRowOrderIndex(row) }}
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 pr-2">
                            <i
                              v-if="row.def.draftPayload?.isImportant === true"
                              class="fas fa-star shrink-0 text-[11px] text-amber-500"
                              title="KPI quan trọng"
                              aria-hidden="true"
                            />
                            <span class="text-sm font-bold leading-snug text-slate-800">{{ row.def.name }}</span>
                            <GmStrategicKpiTypeTag
                              :type="detailSuiteKpiTypeForTag(row.def)"
                              size="md"
                              class="shrink-0"
                            />
                          </div>
                          <div
                            class="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-3"
                          >
                            <div class="min-w-0">
                              <p class="mb-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                                Trọng số
                              </p>
                              <p class="text-sm font-bold text-slate-800">
                                {{ detailSuiteKpiWeightDisplay(row.def) }}
                              </p>
                            </div>
                            <div class="min-w-0">
                              <p class="mb-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                                Target
                              </p>
                              <p class="break-words text-sm font-semibold text-slate-800">
                                {{ detailSuiteKpiTargetDisplay(row.def) }}
                              </p>
                            </div>
                            <div class="min-w-0">
                              <p class="mb-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                                Công thức tính
                              </p>
                              <p class="break-words text-sm font-semibold leading-snug text-slate-800">
                                {{ detailSuiteKpiFormulaDisplay(row.def) }}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div
              class="z-10 flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white p-5 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
            >
              <button
                type="button"
                class="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                :disabled="saving"
                @click="closeCreateDrawer"
              >
                Hủy
              </button>
              <button
                type="button"
                class="flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-purple-700 disabled:opacity-60"
                :disabled="saving"
                @click="saveTemplateSuite"
              >
                <i v-if="saving" class="fas fa-spinner fa-spin text-sm" aria-hidden="true" />
                <i v-else class="fas fa-save text-sm" aria-hidden="true" />
                {{ saving ? 'Đang lưu...' : 'Lưu Template Suite' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Drawer thêm KPI: Teleport vào `body` trong component; đặt ở đây để `v-model` hoạt động -->
    <GmTemplateSuiteKpiFormDrawer
      v-model="showKpiDraftDrawer"
      :cycle-id="cycleIdForKpiDraft"
      :initial-payload="kpiDraftInitialPayload"
      @added="onTemplateKpiDraftAdded"
    />

    <Teleport to="body">
      <Transition name="gm-tpl-meta-modal">
        <div
          v-if="suiteMetaModalOpen"
          class="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gm-tpl-meta-title"
        >
          <button
            type="button"
            class="absolute inset-0 cursor-default bg-slate-900/50 backdrop-blur-[2px]"
            aria-label="Đóng"
            @click="closeSuiteMetaModal"
          />
          <div
            class="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            @click.stop
          >
            <div class="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h2 id="gm-tpl-meta-title" class="text-base font-bold text-slate-800">Sửa thông tin bộ mẫu</h2>
              <p class="mt-1 text-xs text-slate-500">Chỉnh sửa tên và mô tả hiển thị của bộ KPI mẫu.</p>
            </div>
            <div class="space-y-4 p-5">
              <div>
                <label for="gm-tpl-meta-name" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                  Tên bộ mẫu <span class="text-rose-500">*</span>
                </label>
                <input
                  id="gm-tpl-meta-name"
                  v-model="suiteMetaName"
                  type="text"
                  class="w-full rounded-lg border px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2"
                  :class="
                    suiteMetaNameError
                      ? 'border-rose-400 ring-2 ring-rose-100 focus:border-rose-500 focus:ring-rose-200'
                      : 'border-slate-200 focus:border-purple-400 focus:ring-purple-200'
                  "
                  placeholder="Nhập tên..."
                />
                <p v-if="suiteMetaNameError" class="mt-1.5 text-xs font-semibold text-rose-600">{{ suiteMetaNameError }}</p>
              </div>
              <div>
                <label for="gm-tpl-meta-desc" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                  Mô tả
                </label>
                <textarea
                  id="gm-tpl-meta-desc"
                  v-model="suiteMetaDesc"
                  rows="4"
                  class="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                  placeholder="Mô tả ngắn..."
                />
              </div>
            </div>
            <div class="flex justify-end gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-4">
              <button
                type="button"
                class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50"
                @click="closeSuiteMetaModal"
              >
                Hủy
              </button>
              <button
                type="button"
                class="rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-purple-700"
                @click="saveSuiteMetaFromModal"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="gm-tpl-meta-modal">
        <div
          v-if="deleteConfirmPayload"
          class="fixed inset-0 z-[210] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="deleteConfirmPayload.kind === 'suite' ? 'gm-tpl-del-suite-title' : 'gm-tpl-del-kpi-title'"
        >
          <button
            type="button"
            class="absolute inset-0 cursor-default bg-slate-900/50 backdrop-blur-[2px]"
            aria-label="Đóng"
            @click="closeDeleteConfirmModal"
          />
          <div
            class="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            @click.stop
          >
            <div class="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <template v-if="deleteConfirmPayload.kind === 'suite'">
                <h2 id="gm-tpl-del-suite-title" class="text-base font-bold text-slate-800">Xóa bộ KPI mẫu?</h2>
                <p class="mt-2 text-sm leading-relaxed text-slate-600">
                  Bạn sắp xóa bộ
                  <span class="font-bold text-slate-800">«{{ deleteConfirmPayload.suiteName }}»</span>.
                  Các KPI trong bộ sẽ bị gỡ. Thao tác này không thể hoàn tác.
                </p>
              </template>
              <template v-else>
                <h2 id="gm-tpl-del-kpi-title" class="text-base font-bold text-slate-800">Xóa KPI khỏi bộ mẫu?</h2>
                <p class="mt-2 text-sm leading-relaxed text-slate-600">
                  Xóa KPI
                  <span class="font-bold text-slate-800">«{{ deleteConfirmPayload.kpiName }}»</span>
                  khỏi bộ mẫu? Thao tác này không thể hoàn tác.
                </p>
              </template>
            </div>
            <div class="flex justify-end gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-4">
              <button
                type="button"
                class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50"
                @click="closeDeleteConfirmModal"
              >
                Hủy
              </button>
              <button
                type="button"
                class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-700"
                @click="confirmDeleteExecute"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.gm-tpl-drawer-enter-active,
.gm-tpl-drawer-leave-active {
  transition-duration: 0.28s;
}
.gm-tpl-drawer-enter-active .gm-tpl-drawer-backdrop,
.gm-tpl-drawer-leave-active .gm-tpl-drawer-backdrop {
  transition: opacity 0.28s ease;
}
.gm-tpl-drawer-enter-active .gm-tpl-drawer-panel,
.gm-tpl-drawer-leave-active .gm-tpl-drawer-panel {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.gm-tpl-drawer-enter-from .gm-tpl-drawer-backdrop,
.gm-tpl-drawer-leave-to .gm-tpl-drawer-backdrop {
  opacity: 0;
}
.gm-tpl-drawer-enter-to .gm-tpl-drawer-backdrop,
.gm-tpl-drawer-leave-from .gm-tpl-drawer-backdrop {
  opacity: 1;
}
.gm-tpl-drawer-enter-from .gm-tpl-drawer-panel,
.gm-tpl-drawer-leave-to .gm-tpl-drawer-panel {
  transform: translateX(100%);
}
.gm-tpl-drawer-enter-to .gm-tpl-drawer-panel,
.gm-tpl-drawer-leave-from .gm-tpl-drawer-panel {
  transform: translateX(0);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #e2e8f0;
  border-radius: 4px;
}

.gm-tpl-meta-modal-enter-active,
.gm-tpl-meta-modal-leave-active {
  transition: opacity 0.18s ease;
}
.gm-tpl-meta-modal-enter-from,
.gm-tpl-meta-modal-leave-to {
  opacity: 0;
}
</style>
