/**
 * Năm lịch < năm hiện tại → kỳ đã khóa, chỉ xem (read-only).
 */
export function isReadonlyKpiYear(year: number): boolean {
  return year < new Date().getFullYear()
}
