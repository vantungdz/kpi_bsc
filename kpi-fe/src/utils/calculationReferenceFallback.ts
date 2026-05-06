import type { KpiCalculationReferenceData } from '@/types/kpi-calculation-reference'

/** Khi API lỗi — cùng logic RULE→TYPE với backend (không dùng bảng phụ). */
export function getFallbackCalculationReference(): KpiCalculationReferenceData {
  return {
    calcRulesWithTypes: [
      {
        code: 802,
        value: 'AVERAGE',
        label: 'Lấy trung bình cộng điểm các KPI con',
        calcTypes: [
          { code: 701, value: 'ACTUAL_OVER_PLAN', label: 'Actual / Plan' },
          { code: 702, value: 'PLAN_OVER_ACTUAL', label: 'Plan / Actual' },
        ],
      },
      {
        code: 803,
        value: 'COMMENT',
        label: 'Nhập điểm thủ công dựa trên nhận xét đánh giá',
        calcTypes: [],
      },
      {
        code: 801,
        value: 'SUM',
        label: 'Cộng dồn điểm của các KPI con',
        calcTypes: [],
      },
    ],
  }
}
