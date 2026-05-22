import type { YearDropdownOption } from '@/types/kpi-dashboard-options'

/**
 * Dropdown năm cho Member / Leader dashboard:
 * - Luôn hiển thị năm hiện tại (nếu có trong danh sách chu kỳ).
 * - Năm quá khứ chỉ hiển thị khi user đã có KPI assignment trong năm đó.
 */
export function buildMemberLeaderYearDropdownOptions(
  cycleYears: number[],
  yearsWithAssignments: number[],
  currentYear: number,
  labelPrefix = 'Year',
): YearDropdownOption[] {
  const cycleSet = new Set(
    cycleYears.filter(y => Number.isFinite(y)),
  )
  const withKpi = new Set(
    yearsWithAssignments.filter(y => Number.isFinite(y)),
  )

  const visible = [...cycleSet].filter(
    year => year >= currentYear || withKpi.has(year),
  )

  return visible
    .sort((a, b) => b - a)
    .map(year => ({
      value: year,
      label: `${labelPrefix} ${year}`,
    }))
}
