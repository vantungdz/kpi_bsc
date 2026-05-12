package com.company.kpi.request.pm;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

/** PM lưu nhận xét tổng cho member (user_kpi_summaries.evaluation_supervisor_comments). */
@Data
public class PmSupervisorCommentRequest {

    @NotNull
    private Integer year;

    @NotNull
    private UUID memberId;

    private String pmComment;

    /**
     * {@code true}: lưu vào {@code evaluation_supervisor_comments_promotion};
     * {@code false}/null: cột {@code evaluation_supervisor_comments} (KPI Member / portfolio).
     */
    private Boolean promotion;
}
