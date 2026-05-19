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
    /** {@code kpis_information.target_description} — quy tắc chấm điểm (JSON DSL / rawInput). */
    private String targetDescription;
    /**
     * So khớp target KPI (catalog) với tổng target hiển thị trên các dòng khối (department),
     * không cộng lặp từng assignment con: {@code short} | {@code ok} | {@code excess}.
     */
    private String targetBalance;
    private String actual;
    private String status;
    private String blockerSummary;
    /** {@code cascading} | {@code individual} | {@code promotion} */
    private String kpiType;
    /** {@code kpi_master.is_global} — phân biệt KPI GM (công ty) vs member đề xuất. */
    private Boolean isGlobal;
    /** Code role của người tạo KPI. */
    private String creatorRoleCode;
    /** {@code kpi_master.unit_code} — đồng bộ form Unit (FE). */
    private Integer unitCode;
    /** {@code kpi_master.calculation_rule_code}. */
    private Integer calculationRuleCode;
    /** {@code kpi_master.calculation_type_code}. */
    private Integer calculationTypeCode;
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
