package com.company.kpi.aggregate;

import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class AssigneeAssignmentEditRow {
    private UUID assignmentId;
    private UUID cycleId;
    private UUID kpiInfoId;
    private UUID userId;
    private Integer statusCode;
    private Boolean allowAssigneeTargetScaleEdit;
    private BigDecimal targetValue;
    /** JSON text của {@code scoring_scale} hiện tại. */
    private String scoringScale;
    private BigDecimal assigneeEditBaselineTarget;
}
