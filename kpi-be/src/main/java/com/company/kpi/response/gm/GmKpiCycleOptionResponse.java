package com.company.kpi.response.gm;

import lombok.Data;

import java.util.UUID;

/**
 * Một chu kỳ KPI ({@code kpi_cycles}) có thư viện KPI theo năm ({@code kpis_information})
 * — dùng cho dropdown «Năm nguồn» sao chép nhanh.
 */
@Data
public class GmKpiCycleOptionResponse {
    private UUID id;
    private Integer year;
    private String name;
    private Integer statusCode;
}
