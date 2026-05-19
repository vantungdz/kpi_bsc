package com.company.kpi.request.gm;

import com.company.kpi.request.kpi.CreateStrategicKpiRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

/**
 * GM accepts feedback for a direct Individual/Promotion assignment by splitting
 * that assignee into a newly created KPI, then removing the old assignment.
 */
@Data
public class GmFeedbackSplitKpiRequest {

    @NotNull
    private UUID cycleId;

    @NotNull
    private UUID feedbackAssignmentId;

    @Valid
    @NotNull
    private CreateStrategicKpiRequest newKpi;
}
