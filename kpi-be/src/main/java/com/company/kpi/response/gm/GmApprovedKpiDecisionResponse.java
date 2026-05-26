package com.company.kpi.response.gm;

import lombok.Data;

@Data
public class GmApprovedKpiDecisionResponse {
    private int updatedCount;
    /** Số assignment khác trong drawer được chuyển 404 sau khi từ chối một KPI. */
    private int siblingsResetToPendingAcceptanceCount;
}
