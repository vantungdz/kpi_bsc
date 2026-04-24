import type { GmWorkspaceCycleSnapshot } from '@/types/gm-workspace'

function calendarYearFromIsoBoundary(iso: string | undefined): number | null {
  if (iso == null || !String(iso).trim()) return null
  const m = /^(\d{4})/.exec(String(iso).trim())
  if (!m) return null
  const y = Number(m[1])
  return Number.isFinite(y) ? y : null
}

/**
 * @deprecated Dùng {@link collectCycleYearsWithStrategicKpisInSnapshots} cho dropdown «Năm nguồn».
 */
export function collectYearsFromKpiActivityInSnapshots(
  snapshots: Record<string, GmWorkspaceCycleSnapshot>,
): string[] {
  const years = new Set<number>()
  const addSpan = (start?: string, end?: string) => {
    const ys = calendarYearFromIsoBoundary(start)
    const ye = calendarYearFromIsoBoundary(end)
    if (ys != null && ye != null) {
      const a = Math.min(ys, ye)
      const b = Math.max(ys, ye)
      for (let y = a; y <= b; y++) years.add(y)
    } else if (ys != null) years.add(ys)
    else if (ye != null) years.add(ye)
  }
  for (const snap of Object.values(snapshots)) {
    for (const k of snap.hierarchyKpis) addSpan(k.activityStartDate, k.activityEndDate)
    for (const dept of snap.departments) {
      for (const k of dept.kpis) addSpan(k.activityStartDate, k.activityEndDate)
    }
  }
  return [...years].sort((a, b) => b - a).map(String)
}

function snapshotHasStrategicKpis(snap: GmWorkspaceCycleSnapshot): boolean {
  if (snap.hierarchyKpis?.length) return true
  return !!snap.departments?.some((d) => (d.kpis?.length ?? 0) > 0)
}

export function collectCycleYearsWithStrategicKpisInSnapshots(
  snapshots: Record<string, GmWorkspaceCycleSnapshot>,
): string[] {
  const out: string[] = []
  for (const [yearKey, snap] of Object.entries(snapshots)) {
    if (!/^\d{4}$/.test(yearKey)) continue
    const n = Number.parseInt(yearKey, 10)
    if (!Number.isFinite(n)) continue
    if (!snapshotHasStrategicKpis(snap)) continue
    out.push(yearKey)
  }
  return out.sort((a, b) => Number(b) - Number(a))
}
