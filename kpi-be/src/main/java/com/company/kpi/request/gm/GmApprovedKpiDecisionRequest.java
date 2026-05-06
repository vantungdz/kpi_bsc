package com.company.kpi.request.gm;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class GmApprovedKpiDecisionRequest {

    @NotNull
    private UUID cycleId;

    @NotNull
    private UUID assignmentId;

    /**
     * Quyết định của GM:
     * - Nếu assignment đang 403: {@code true} → 405, {@code false} → 406.
     * - Nếu assignment đang 407 (feedback từ PM): resolve feedback và đưa về 404.
     */
    @NotNull
    private Boolean approve;
}
