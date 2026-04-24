package com.company.kpi.response.gm;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * One KPI row for GM Strategic diagnostics — shape aligned with FE {@code GmHierarchyKpi}.
 */
@Data
@Builder
public class GmDiagKpiNode {
    private String id;
    private String name;
    private String weight;
    private String target;
    private String actual;
    private String status;
    private String blockerSummary;
    /** {@code cascading} | {@code individual} | {@code promotion} */
    private String kpiType;
    /** {@code kpi_master.unit_code} — đồng bộ form Unit (FE). */
    private Integer unitCode;
    /** {@code kpi_master.category_id} — FE dùng thay cho BSC khi gắn KPI với thư viện. */
    private String categoryId;
    /** {@code kpi_categories.name} */
    private String categoryName;
    private String lifecycleStatus;
    private Boolean isImportant;
    private List<GmDiagPmNode> pmOwners;
    private String investigateDeptId;
    private String investigateKpiName;
}
