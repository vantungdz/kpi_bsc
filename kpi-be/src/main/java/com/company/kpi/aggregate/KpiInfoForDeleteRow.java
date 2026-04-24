package com.company.kpi.aggregate;

import lombok.Data;

import java.util.UUID;

/** Một dòng {@code kpis_information} + master  Edùng trước khi GM xóa KPI chiến lược. */
@Data
public class KpiInfoForDeleteRow {
    private UUID kpiInformationId;
    private UUID cycleId;
    private UUID masterKpiId;
    private Boolean isGlobal;
}

