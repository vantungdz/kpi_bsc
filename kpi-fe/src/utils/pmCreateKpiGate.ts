import { KPI_STATUS } from '@/config/constants'

export const PM_CREATE_KPI_ALLOWED_EVENT = 'pm-create-kpi-allowed'

export type PmCreateKpiAllowedDetail = {
  year: number
  allowed: boolean
}

/**
 * PM được tạo KPI mới khi: chưa có KPI Personal hoặc mọi dòng KPI cha (không tính member con) đều 404.
 */
export function pmCanCreatePersonalKpi(
  rows: Array<{ statusCode?: unknown }>,
): boolean {
  if (!rows.length) return true
  return rows.every(
    (item) => Number(item?.statusCode) === KPI_STATUS.PENDING_ACCEPTANCE,
  )
}

export function dispatchPmCreateKpiAllowed(year: number, allowed: boolean): void {
  window.dispatchEvent(
    new CustomEvent<PmCreateKpiAllowedDetail>(PM_CREATE_KPI_ALLOWED_EVENT, {
      detail: { year, allowed },
    }),
  )
}
