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

    /**
     * Khi {@code approve == false} và cập nhật 403→406: lý do bắt buộc, lưu {@code kpi_assignments.update_reason}.
     * Khi duyệt hoặc xử lý nhánh feedback (407) có thể bỏ qua.
     */
    private String rejectReason;
}
