import type { KpiTemplateSuite, SuiteColor, TemplateKpiDef } from '@/mocks/gm-kpi-template-suites.seed'
import type { GmKpiTemplateItemRow, GmKpiTemplatePackageRow } from '@/types/gm-kpi-template'
import { persistedCalculationMethodFromTypeAndRule } from '@/utils/kpiCalculationCodes'
import { strategicKpiKindFromTypeCode } from '@/utils/strategicKpiTypeCodes'

const SUITE_COLORS: SuiteColor[] = ['blue', 'indigo', 'amber', 'emerald']

function kpiTypeStringFromTypeCode(typeCode: number): string {
  const k = strategicKpiKindFromTypeCode(typeCode)
  if (k === 'individual') return 'individual'
  if (k === 'promotion') return 'promotion'
  return 'cascading'
}

/** Gộp gói template + KPI con — dùng `GmKpiTemplateLibraryPage`. */
export function mapTemplateApiDataToSuites(
  packs: GmKpiTemplatePackageRow[],
  itemsByTemplateId: Map<string, GmKpiTemplateItemRow[]>,
): KpiTemplateSuite[] {
  return packs.map((p, i) => {
    const items = itemsByTemplateId.get(p.id) ?? []
    const kpis: TemplateKpiDef[] = items.map((it) => {
      const calculationMethod = persistedCalculationMethodFromTypeAndRule(
        it.calculationTypeCode ?? null,
        it.calculationRuleCode ?? 802,
      )
      const w = it.defaultWeight != null ? Number(it.defaultWeight) : 0
      const tvStr = it.defaultTargetValue != null ? String(it.defaultTargetValue) : ''
      const tvNum =
        it.defaultTargetValue != null && Number.isFinite(Number(it.defaultTargetValue))
          ? Number(it.defaultTargetValue)
          : null
      return {
        name: it.masterName,
        displayCode: it.masterCode?.trim() || undefined,
        weight: Number.isFinite(w) ? w : 0,
        target: tvStr,
        templateItemId: it.templateItemId,
        masterKpiId: it.masterKpiId,
        draftPayload: {
          typeCode: it.typeCode,
          perspective: it.categoryId,
          templateItemId: it.templateItemId,
          masterKpiId: it.masterKpiId,
          kpiName: it.masterName,
          targetDescription: it.targetDescription,
          targetValue: tvNum,
          unitCode: it.unitCode,
          weightPct: String(it.defaultWeight ?? ''),
          calculationMethod,
          kpiType: kpiTypeStringFromTypeCode(it.typeCode),
          assignPMs: [] as string[],
          pmTargets: {} as Record<string, string>,
          memberIds: [] as string[],
        },
      }
    })
    return {
      id: p.id,
      name: p.name,
      code: `TPL-${String(p.id).replace(/-/g, '').slice(0, 8)}`,
      description: p.description ?? '',
      color: SUITE_COLORS[i % SUITE_COLORS.length]!,
      kpis,
    }
  })
}
