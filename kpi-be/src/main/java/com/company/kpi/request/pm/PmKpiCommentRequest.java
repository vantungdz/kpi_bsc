package com.company.kpi.request.pm;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class PmKpiCommentRequest {
    @NotNull
    private Integer year;

    @NotNull
    private UUID assignmentId;

    private String pmComment;
}
