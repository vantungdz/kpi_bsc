/** GET/PUT `/kpi/strategic-kpis/:id` — payload chỉnh sửa KPI chiến lược. */

export interface KpiScoringRulesPayload {
  rawInput?: string | null
  rules?: Array<Record<string, unknown>>
}

export interface GmStrategicKpiEditData {
  kpiInformationId: string
  cycleId: string
  masterKpiId: string
  typeCode: number
  perspective: string
  kpiName: string
  targetDescription: KpiScoringRulesPayload | null
  targetValue: number | string | null
  unitCode: number
  weightPct: number | string
  calculationMethod: string
  isImportant: boolean
  assignPMs?: string[] | null
  pmTargets?: Record<string, unknown> | null
  memberIds?: string[] | null
}
