package com.company.kpi.request.kpi;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class UpdateKpiStatusRequest {
    
    @NotNull
    private UUID cycleId;

    @NotNull
    private Integer statusCode;

    private boolean promotion;
}