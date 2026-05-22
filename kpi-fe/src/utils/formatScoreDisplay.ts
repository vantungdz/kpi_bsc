/** Làm tròn điểm KPI đến 2 chữ số thập phân (không ép 1 chữ số như trước). */
export function roundScoreToHundredths(n: number): number {
  if (!Number.isFinite(n)) return n
  return Math.round(n * 100) / 100
}

/**
 * Hiển thị điểm: 1.235 → 1.24, 1.23 → 1.23, 1.2 → 1.2, 4 → 4.
 * Dùng chung GM Strategic Diagnostics & PM Final Score.
 */
export function formatScoreDisplay(n: number): string {
  const rounded = roundScoreToHundredths(n)
  if (!Number.isFinite(rounded)) return '-'
  if (rounded % 1 === 0) return String(rounded)
  return String(rounded.toFixed(2).replace(/\.?0+$/, ''))
}

export function formatScoreDisplayOrDash(raw: unknown): string {
  if (raw == null || raw === '') return '-'
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return '-'
  return formatScoreDisplay(n)
}
