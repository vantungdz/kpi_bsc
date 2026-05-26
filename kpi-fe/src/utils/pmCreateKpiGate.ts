import { KPI_STATUS } from '@/config/constants'

export const PM_CREATE_KPI_ALLOWED_EVENT = 'pm-create-kpi-allowed'

export type PmCreateKpiAllowedDetail = {
  year: number
  allowed: boolean
}

/** KPI cha Personal cho phép PM tạo thêm KPI mới: chờ accept (404) hoặc GM từ chối (406). */
export function isPmCreateKpiAllowedParentStatus(statusCode: unknown): boolean {
  const sc = Number(statusCode)
  return (
    sc === KPI_STATUS.PENDING_ACCEPTANCE || sc === KPI_STATUS.REJECTED
  )
}

/**
 * PM được tạo KPI mới khi: chưa có KPI Personal hoặc mọi dòng KPI cha đều 404 hoặc 406.
 */
export function pmCanCreatePersonalKpi(
  rows: Array<{ statusCode?: unknown }>,
): boolean {
  if (!rows.length) return true
  return rows.every((item) => isPmCreateKpiAllowedParentStatus(item?.statusCode))
}

export function dispatchPmCreateKpiAllowed(year: number, allowed: boolean): void {
  window.dispatchEvent(
    new CustomEvent<PmCreateKpiAllowedDetail>(PM_CREATE_KPI_ALLOWED_EVENT, {
      detail: { year, allowed },
    }),
  )
}
