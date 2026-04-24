/**
 * Kiểu dữ liệu + helper cho thư viện template KPI.
 * Danh sách gói/mục lấy từ API (`kpi_templates`, `kpi_template_items`), xem `mapGmKpiTemplatesToSuites.ts`.
 */
import { kpiFormUnitToUnitCode } from '@/utils/kpiUnitCodes'

export type SuiteColor = 'blue' | 'indigo' | 'amber' | 'emerald'

export interface TemplateKpiDef {
  /** Mã hiển thị (vd. A.1a) — tùy chọn. */
  displayCode?: string
  name: string
  weight: number
  target: string
  draftPayload?: Record<string, unknown>
  /** Đồng bộ API `kpi_template_items` / `kpi_master` — có khi tải từ BE hoặc sau khi tạo item. */
  templateItemId?: string
  masterKpiId?: string
}

export interface KpiTemplateSuite {
  id: string
  name: string
  code: string
  description: string
  color: SuiteColor
  kpis: TemplateKpiDef[]
}

export type BscPerspective = 'financial' | 'customer' | 'internal' | 'learning'

export function mockTargetValueFromDisplay(target: string): string {
  const m = /(\d+(?:\.\d+)?)/.exec(String(target ?? '').replace(/\u00a0/g, ' '))
  return m ? m[1]! : '90'
}

export function mockKpiDraftPayload(args: {
  name: string
  weight: number
  targetDisplay: string
  perspective: BscPerspective
  unit?: string
}): Record<string, unknown> {
  const y = String(new Date().getFullYear())
  const unit = args.unit ?? 'POINT'
  return {
    kpiType: 'cascading',
    perspective: args.perspective,
    kpiName: args.name,
    targetDescription: '',
    targetValue: Number.parseFloat(mockTargetValueFromDisplay(args.targetDisplay)),
    unit,
    unitCode: kpiFormUnitToUnitCode(unit),
    weightPct: String(args.weight),
    cycleId: y,
    calculationMethod: 'mean_actual_plan',
    isImportant: false,
    assignPMs: [] as string[],
    pmTargets: {} as Record<string, string>,
  }
}

