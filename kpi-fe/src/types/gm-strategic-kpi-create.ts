/**
 * POST /api/v1/kpi/strategic-kpis — tạo KPI chiến lược (đồng bộ payload form GM).
 */
export interface GmCreateStrategicKpiResponseData {
  kpiInformationId: string
  cycleId: string
  masterKpiId: string
  code: string | null
  name: string
  categoryId: string
  categoryName: string | null
  typeCode: number
  calculationRuleCode: number
  calculationTypeCode: number | null
  unitCode: number
  isGlobal: boolean
  targetDescription: string | null
  targetValue: number | null
  weight: number
  isImportant: boolean
  assignmentsCreated: number
}
