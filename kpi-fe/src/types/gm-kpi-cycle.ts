/** Một dòng `kpi_cycles` (đã có `kpis_information`) từ `GET /kpi/gm/kpi-cycles-with-kpis`. */
export interface GmKpiCycleOption {
  id: string
  year: number
  name: string
  statusCode?: number
}
