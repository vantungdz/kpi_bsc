import type { InjectionKey, Ref } from 'vue'

/** Sub-tab trong `GmKpiEvaluationPanel` — đồng bộ timeline/header GM layout. */
export type GmEvaluationTableEvalTab = 'cascade' | 'promotion'

export const gmEvaluationTableEvalTabKey: InjectionKey<Ref<GmEvaluationTableEvalTab>> = Symbol(
  'gmEvaluationTableEvalTab',
)

/** Sub-tab trong `GmGmPersonalKpiPanel` — KPI Personal vs KPI Promotion. */
export type GmPersonalTableTab = 'personal' | 'promotion'

export const gmPersonalTableTabKey: InjectionKey<Ref<GmPersonalTableTab>> = Symbol(
  'gmPersonalTableTab',
)
