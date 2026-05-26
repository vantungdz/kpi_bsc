/** GET /kpi/gm/promotion-cycles?year= */
export interface GmPromotionCycleOption {
  id: string
  userId?: string | null
  name: string
  startDate: string
  endDate: string
  durationMonths?: number | null
  statusCode?: number | null
}
