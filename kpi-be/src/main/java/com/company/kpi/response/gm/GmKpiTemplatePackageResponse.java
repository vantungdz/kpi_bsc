package com.company.kpi.response.gm;

import lombok.Data;

import java.util.UUID;

/** Một dòng {@code kpi_templates} — gói mẫu KPI (dropdown GM). */
@Data
public class GmKpiTemplatePackageResponse {
    private UUID id;
    private String name;
    private String description;
}
