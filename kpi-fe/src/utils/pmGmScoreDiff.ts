import { formatScoreDisplay, formatScoreDisplayOrDash } from '@/utils/formatScoreDisplay'

/**
 * Nền ô Final Score khi GM sửa điểm — tím nhạt, không trùng nền theo role tạo KPI
 * (GM amber, PM blue, Leader emerald, Member fuchsia).
 */
export const PM_GM_SCORE_CHANGED_TD_CLASS =
  'bg-violet-100 ring-1 ring-inset ring-violet-300/70'

/** GM đã chấm và khác điểm PM (cuối kỳ). */
export function gmScoreChangedFromFields(
  endPmScore?: number | string | null,
  endGmScore?: number | string | null,
): boolean {
  if (endPmScore == null || endGmScore == null) return false
  const pm = Number(endPmScore)
  const gm = Number(endGmScore)
  if (!Number.isFinite(pm) || !Number.isFinite(gm)) return false
  return pm !== gm
}

/** Tooltip khi hover điểm supervisor sau khi GM sửa. */
export function gmScoreChangeTooltip(
  endPmScore?: number | string | null,
  endGmScore?: number | string | null,
  displayScore?: number | string | null,
): string {
  if (!gmScoreChangedFromFields(endPmScore, endGmScore)) {
    return formatScoreDisplayOrDash(displayScore)
  }
  return `GM adjusted: ${formatScoreDisplay(Number(endPmScore))} → ${formatScoreDisplay(Number(endGmScore))}`
}
