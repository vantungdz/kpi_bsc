import type { InjectionKey, Ref } from 'vue'

/** PM header: show promotion cycle dropdown instead of kpi_cycles year. */
export const pmHeaderShowsPromotionCycleKey: InjectionKey<Ref<boolean>> = Symbol(
  'pmHeaderShowsPromotionCycle',
)

/** Selected `promotion_cycles.id` — owned by PmLayout header, read by PmDashboard. */
export const pmSelectedPromotionCycleIdKey: InjectionKey<Ref<string>> = Symbol(
  'pmSelectedPromotionCycleId',
)

/** Sub-tab trong `PmTeamMembersTab` — KPI Personal vs KPI Promotion (Team Review). */
export type PmTeamReviewScope = 'portfolio' | 'promotion'

export const pmTeamReviewScopeKey: InjectionKey<Ref<PmTeamReviewScope>> = Symbol(
  'pmTeamReviewScope',
)

/** Sub-tab trong `PmPersonalKpiTab` khi `portfolioScope=department`. */
export type PmDepartmentSubTab = 'individual' | 'promotion'

export const pmDepartmentSubTabKey: InjectionKey<Ref<PmDepartmentSubTab>> = Symbol(
  'pmDepartmentSubTab',
)
