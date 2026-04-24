import type { GmBscPerspective } from '@/types/gm-workspace'

/** API GET /kpi/gm/kpi-templates — hàng `kpi_templates`. */
export interface GmKpiTemplatePackageRow {
  id: string
  name: string
  description: string | null
}

/** API GET /kpi/gm/kpi-templates/:id/items — `kpi_template_items` + `kpi_master`. */
export interface GmKpiTemplateItemRow {
  templateItemId: string
  templateId: string
  masterKpiId: string
  masterCode: string | null
  masterName: string
  /** Khi không có `categoryId` (giống diagnostics): nhóm BSC theo trường này nếu BE/mock gửi. */
  diagnosticsFallbackGroup?: GmBscPerspective
  categoryId: string
  categoryName: string | null
  typeCode: number
  unitCode: number
  calculationRuleCode: number
  calculationTypeCode: number | null
  defaultTargetValue: number | null
  defaultWeight: number | null
}

/** POST /kpi/gm/kpi-templates */
export interface GmCreateKpiTemplateBody {
  name: string
  description?: string | null
  jobFamilyId?: string | null
  rankId?: string | null
}

/** PUT /kpi/gm/kpi-templates/:templateId — null/omit = giữ nguyên (theo BE). */
export interface GmUpdateKpiTemplateBody {
  name?: string | null
  description?: string | null
  jobFamilyId?: string | null
  rankId?: string | null
}

/**
 * POST /kpi/gm/kpi-templates/:templateId/items — KPI trong gói mẫu (không phải strategic KPI kỳ).
 */
export interface GmCreateKpiTemplateItemBody {
  kpiName: string
  perspective: string
  typeCode: number
  unitCode: number
  calculationMethod: string
  defaultTargetValue?: number | null
  defaultWeight: number
}

/** PUT /kpi/gm/kpi-templates/:templateId/items/:itemId */
export interface GmUpdateKpiTemplateItemBody {
  kpiName?: string | null
  perspective?: string | null
  typeCode?: number | null
  unitCode?: number | null
  calculationMethod?: string | null
  defaultTargetValue?: number | null
  defaultWeight?: number | null
}
