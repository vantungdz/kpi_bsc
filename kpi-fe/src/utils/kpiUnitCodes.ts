/**
 * Mã đơn vị KPI — đồng bộ `document/db/init-db.sql` (`sys_status_codes` category `KPI_UNIT`, 901–908)
 * và `kpi_master.unit_code` / payload tạo KPI.
 */
export const KPI_UNIT_CODE = {
  MM: 901,
  PERCENT: 902,
  POINT: 903,
  PRODUCT: 904,
  PROJECT: 905,
  CERTIFICATION: 906,
  ARTICLE: 907,
  PERSON: 908,
} as const

const FORM_UNIT_TO_CODE: Record<string, number> = {
  MM: KPI_UNIT_CODE.MM,
  PERCENT: KPI_UNIT_CODE.PERCENT,
  POINT: KPI_UNIT_CODE.POINT,
  PRODUCT: KPI_UNIT_CODE.PRODUCT,
  PROJECT: KPI_UNIT_CODE.PROJECT,
  CERTIFICATION: KPI_UNIT_CODE.CERTIFICATION,
  ARTICLE: KPI_UNIT_CODE.ARTICLE,
  PERSON: KPI_UNIT_CODE.PERSON,
}

const CODE_TO_FORM_UNIT: Record<number, string> = {
  [KPI_UNIT_CODE.MM]: 'MM',
  [KPI_UNIT_CODE.PERCENT]: 'PERCENT',
  [KPI_UNIT_CODE.POINT]: 'POINT',
  [KPI_UNIT_CODE.PRODUCT]: 'PRODUCT',
  [KPI_UNIT_CODE.PROJECT]: 'PROJECT',
  [KPI_UNIT_CODE.CERTIFICATION]: 'CERTIFICATION',
  [KPI_UNIT_CODE.ARTICLE]: 'ARTICLE',
  [KPI_UNIT_CODE.PERSON]: 'PERSON',
}

/** Giá trị form (select Unit) → `unit_code` gửi API / mock. */
export function kpiFormUnitToUnitCode(formUnit: string | undefined | null): number {
  const k = String(formUnit ?? 'MM').trim().toUpperCase()
  return FORM_UNIT_TO_CODE[k] ?? KPI_UNIT_CODE.MM
}

/** `unit_code` từ DB / payload → giá trị select Unit trên form. */
export function kpiUnitCodeToFormUnit(code: unknown): string {
  const n = typeof code === 'number' ? code : Number.parseInt(String(code ?? ''), 10)
  if (!Number.isFinite(n)) return 'MM'
  return CODE_TO_FORM_UNIT[n] ?? 'MM'
}

/** Ưu tiên `unitCode` trên payload, fallback `unit` (chuỗi form). */
export function kpiPayloadFormUnitKey(payload: Record<string, unknown>): string {
  if (payload.unitCode != null && payload.unitCode !== '') {
    return kpiUnitCodeToFormUnit(payload.unitCode)
  }
  return String(payload.unit ?? 'MM').trim() || 'MM'
}

/** Đồng bộ cột `name` trong `init-db.sql` (KPI_UNIT) — dùng cho mock khi gọi API đơn vị. */
export function fallbackKpiUnitSelectOptions(): { unitCode: number; value: string; label: string }[] {
  return [
    { unitCode: KPI_UNIT_CODE.MM, value: 'MM', label: 'MM' },
    { unitCode: KPI_UNIT_CODE.PERCENT, value: 'PERCENT', label: 'Percent' },
    { unitCode: KPI_UNIT_CODE.POINT, value: 'POINT', label: 'Point' },
    { unitCode: KPI_UNIT_CODE.PRODUCT, value: 'PRODUCT', label: 'Product' },
    { unitCode: KPI_UNIT_CODE.PROJECT, value: 'PROJECT', label: 'Project' },
    { unitCode: KPI_UNIT_CODE.CERTIFICATION, value: 'CERTIFICATION', label: 'Certification' },
    { unitCode: KPI_UNIT_CODE.ARTICLE, value: 'ARTICLE', label: 'Article' },
    { unitCode: KPI_UNIT_CODE.PERSON, value: 'PERSON', label: 'Person' },
  ]
}
