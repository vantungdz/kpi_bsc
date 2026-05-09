package com.company.kpi.request.gm;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class GmCopyKpisRequest {

    @NotNull(message = "Cycle ID is required")
    private UUID cycleId;

    @NotEmpty(message = "KPI items list cannot be empty")
    @Valid
    private List<GmCopyKpiItemRequest> items;
}
