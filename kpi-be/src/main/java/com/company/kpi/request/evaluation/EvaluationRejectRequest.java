package com.company.kpi.request.evaluation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class EvaluationRejectRequest {

    @NotNull
    private UUID cycleId;

    /** Member được đánh giá trong drawer (GM gửi; PM set từ path). */
    private UUID evaluationUserId;

    /**
     * {@code true}: tab Promotion; {@code false}/null: portfolio (Individual + Team).
     */
    private Boolean promotion;

    /** Một KPI — bỏ qua khi {@link #rejectAll} = true. */
    private UUID assignmentId;

    /** Từ chối toàn bộ KPI rejectable trong drawer (501/502→504, 601/602→604). */
    private Boolean rejectAll;

    /** Lý do từ chối đánh giá — lưu {@code kpi_assignments.evaluation_reject_reason}. */
    @NotBlank(message = "Reject reason is required.")
    @Size(max = 2000)
    private String rejectReason;
}
