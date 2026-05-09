package com.company.kpi.aggregate;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Một dòng insert vào {@code kpi_assignments} (partition theo
 * {@code cycle_id}).
 */
@Value
@Builder
public class KpiAssignmentInsertRow {
    UUID id;
    UUID cycleId;
    UUID kpiInfoId;
    UUID userId;
    UUID parentAssignmentId;
    UUID jobTitleId;
    BigDecimal targetValue;
    int statusCode;
    UUID createdBy;
}
