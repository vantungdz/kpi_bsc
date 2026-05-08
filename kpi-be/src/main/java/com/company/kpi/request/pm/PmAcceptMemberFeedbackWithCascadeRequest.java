package com.company.kpi.request.pm;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

/**
 * PM chấp nhận feedback member (407→404) và lưu phân bổ cascade trong <strong>một</strong> transaction.
 */
@Data
public class PmAcceptMemberFeedbackWithCascadeRequest {

    @NotNull
    private Integer year;

    /** Assignment con của member đang ở trạng thái feedback (407). */
    @NotNull
    private UUID memberFeedbackAssignmentId;

    @NotNull
    private UUID kpiInformationId;

    @NotNull
    private UUID cycleId;

    private UUID parentAssignmentId;

    /** Key = UUID assignee (chuỗi) — khớp payload cascade từ FE. */
    @NotNull
    private Map<String, BigDecimal> memberTargets;
}
