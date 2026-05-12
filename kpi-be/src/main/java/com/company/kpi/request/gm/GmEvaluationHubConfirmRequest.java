package com.company.kpi.request.gm;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class GmEvaluationHubConfirmRequest {

    @NotNull
    private UUID cycleId;

    /** User được GM chấm (assignee). */
    @NotNull
    private UUID evaluationUserId;

    /** Nhận xét tổng (602) — lưu portfolio hoặc promotion theo {@link #promotion}. */
    @Size(max = 8000)
    private String supervisorComment;

    /**
     * {@code true}: lưu vào {@code evaluation_supervisor_comments_promotion};
     * {@code false}/null: lưu vào {@code evaluation_supervisor_comments} (portfolio/BSC).
     */
    private Boolean promotion;

    @NotEmpty
    @Size(max = 500)
    @Valid
    private List<GmEvaluationHubConfirmLine> lines;
}
