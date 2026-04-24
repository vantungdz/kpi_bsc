/** Định dạng mục tiêu hiển thị từ form tạo KPI (preview / mock UI). */
export function formatStrategicCreateTargetDisplay(targetValue: string, unit: string): string {
  const t = String(targetValue ?? '').trim()
  if (!t) return '—'
  switch (unit) {
    case 'percent':
    case 'PERCENT':
      return /%$/.test(t) ? t : `${t}%`
    case 'currency':
      return t.startsWith('$') ? t : `$${t}`
    case 'hours':
      return /\b(h|hr|hrs|hours)\b/i.test(t) ? t : `${t}h`
    case 'days':
      return /\bday/i.test(t) ? t : `${t} days`
    case 'text':
      return t
    case 'MM':
    case 'POINT':
    case 'PRODUCT':
    case 'PROJECT':
    case 'CERTIFICATION':
    case 'ARTICLE':
    case 'PERSON':
      return `${t} ${unit}`.trim()
    default:
      return t
  }
}
