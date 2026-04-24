package com.company.kpi.response.gm;

import lombok.Data;

@Data
public class GmEvaluationHubConfirmResponse {

    /** Số dòng {@code kpi_assignments} đã chuyển 502→503 hoặc 602→603. */
    private int updatedCount;

    /** Số mã assignment yêu cầu nhưng không đủ điều kiện (sai chu kỳ / không còn 502|602). */
    private int skippedCount;
}
