package com.company.kpi.request.pm;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class PmMemberKpiApprovalDecisionRequest {

    @NotNull
    private Integer year;

    @NotNull
    private UUID assignmentId;

    /** {@code true} → ASM 403 (chờ GM); {@code false} → ASM 406 (từ chối). */
    @NotNull
    private Boolean approve;
}
