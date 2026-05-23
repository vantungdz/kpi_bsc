package com.company.kpi.response.common;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class AssigneeTargetScaleUpdateResponse {
    private String assignmentId;
    private BigDecimal assignmentTargetValue;
    private String targetDescription;
}
