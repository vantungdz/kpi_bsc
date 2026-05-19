package com.company.kpi.request.gm;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

/** GM nộp đánh giá KPI cá nhân (chính user GM): giữa kỳ 405→503, cuối kỳ 503→603. */
@Data
public class GmPersonalEvaluationSubmitRequest {

    @NotNull
    private UUID cycleId;

    private Boolean promotion = false;
}
