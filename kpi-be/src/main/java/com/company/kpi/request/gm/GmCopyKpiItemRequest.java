package com.company.kpi.request.gm;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class GmCopyKpiItemRequest {

    @NotNull(message = "KPI Information ID is required")
    private UUID kpiInfoId;

    private BigDecimal targetValue; // Can be null if the target should just be copied from kpis_information or kept null
}
