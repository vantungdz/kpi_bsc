package com.company.kpi.response.gm;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class GmDiagnosticsHierarchyResponse {

    private Integer year;
    private UUID cycleId;
    private String cycleName;
    private Integer cycleStatusCode;
    /** Thư viện KPI kỳ (cùng nội dung trước đây ở {@code GET /v1/kpi/gm/catalog}). */
    private List<GmKpiCatalogItemResponse> catalogItems;
    /** KPI roots — map to FE {@code GmHierarchyKpi[]}. */
    private List<GmDiagKpiNode> kpis;
}
