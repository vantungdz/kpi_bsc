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

    /** {@code true}/{@code false}: đóng feedback, assignment 407→404 (không bắt buộc lý do). */
    @NotNull
    private Boolean approve;
}

