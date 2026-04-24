export interface KpiCycleResponse {
    id: string
    year: number
    name: string
    goalSettingDeadline: string | null
    midYearDeadline: string | null
    endYearDeadline: string | null
    activePhase: string | null
}