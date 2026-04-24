package com.company.kpi.response.gm;

import lombok.Data;

import java.util.UUID;

/** Một dòng `kpi_categories` cho dropdown GM (tạo KPI chiến lược). */
@Data
public class GmKpiCategoryResponse {
    private UUID id;
    private String name;
}
