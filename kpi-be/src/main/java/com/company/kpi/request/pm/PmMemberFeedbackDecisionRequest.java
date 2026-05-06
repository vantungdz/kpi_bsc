package com.company.kpi.request.pm;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class PmMemberFeedbackDecisionRequest {

    @NotNull
    private Integer year;

    @NotNull
    private UUID assignmentId;

    /** true/false đều đóng feedback và trả KPI về 404; chỉ khác thông điệp nghiệp vụ. */
    @NotNull
    private Boolean approve;
}

