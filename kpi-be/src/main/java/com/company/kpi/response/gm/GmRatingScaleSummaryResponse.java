package com.company.kpi.response.gm;

import lombok.Data;

@Data
public class GmRatingScaleSummaryResponse {
    /** Chu kỳ KPI (kpi_cycles.id). */
    private String cycleId;
    private Integer year;
    /** Tên chu kỳ từ kpi_cycles. */
    private String name;
    private Integer statusCode;
    /** true khi status_code = 201 (OPEN). */
    private Boolean editable;
    /** Số mức điểm đã cấu hình (>0 = đã có khung). */
    private Integer levelCount;
}
