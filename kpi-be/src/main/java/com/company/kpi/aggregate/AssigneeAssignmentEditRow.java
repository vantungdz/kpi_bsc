package com.company.kpi.aggregate;

import lombok.Data;

import java.util.UUID;

@Data
public class AssigneeAssignmentEditRow {
    private UUID assignmentId;
    private UUID cycleId;
    private UUID kpiInfoId;
    private UUID userId;
    private Integer statusCode;
    private Boolean allowAssigneeTargetScaleEdit;
}
