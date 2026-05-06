package com.company.kpi.aggregate;

import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class KpiAssignmentUserTargetRow {
    private UUID id;
    private UUID userId;
    private BigDecimal targetValue;
    private Integer statusCode;
}

