package com.company.kpi.request.gm;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class GmEvaluationHubConfirmLine {

    @NotNull
    private UUID assignmentId;

    /** Bắt buộc khi assignment đang ở ASM 602; 502 bỏ qua. */
    @DecimalMin(value = "1.0", inclusive = true)
    @DecimalMax(value = "5.0", inclusive = true)
    private BigDecimal endGmScore;
}
