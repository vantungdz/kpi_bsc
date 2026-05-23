package com.company.kpi.request.common;

import com.company.kpi.dto.kpi.KpiScoringRulesPayload;
import jakarta.validation.constraints.DecimalMin;
import lombok.Data;

import java.math.BigDecimal;

/** Assignee cập nhật target và thang điểm trên assignment khi KPI được bật cho phép. */
@Data
public class AssigneeTargetScaleUpdateRequest {

    @DecimalMin(value = "0", inclusive = false, message = "targetValue must be greater than 0")
    private BigDecimal targetValue;

    private KpiScoringRulesPayload targetDescription;
}
