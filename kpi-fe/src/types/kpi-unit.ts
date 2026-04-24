/** Một dòng `GET /kpi/reference/kpi-units` — `label` = `name`, `value` = UPPER(name) (chuỗi form). */
export interface KpiUnitOption {
  unitCode: number
  value: string
  label: string
}
