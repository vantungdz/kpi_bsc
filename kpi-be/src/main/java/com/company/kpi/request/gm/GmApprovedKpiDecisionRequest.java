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

    /** {@code true} → 404 (chờ member accept), {@code false} → 406 (từ chối). Chỉ áp dụng khi assignment đang 403. */
    @NotNull
    private Boolean approve;
}
