package com.company.kpi.request.gm;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class GmEvaluationHubUnlockRequest {

    @NotNull
    private UUID cycleId;

    @NotNull
    private UUID evaluationUserId;

    /** true = unlock KPI Promotion, false = unlock KPI Individual / Team. */
    private Boolean promotion;
}
