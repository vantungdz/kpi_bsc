package com.company.kpi.response.gm;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * GM view: one KPI definition line for a cycle ({@code kpis_information} + {@code kpi_master}).
 */
@Data
@Builder
public class GmKpiCatalogItemResponse {

    private UUID id;
    private UUID cycleId;
    private UUID masterKpiId;
    private String code;
    private String name;
    private UUID categoryId;
    private String categoryName;
    private Integer typeCode;
    /** Quy tắc tổng hợp điểm — {@code sys_status_codes} CALC_RULE (8xx). */
    private Integer calculationRuleCode;
    /** Chiều hướng tính toán — {@code sys_status_codes} CALC_TYPE (7xx); có thể null. */
    private Integer calculationTypeCode;
    /** Đơn vị chỉ tiêu — {@code sys_status_codes} KPI_UNIT (9xx). */
    private Integer unitCode;
    private Boolean isGlobal;
    private String targetDescription;
    private BigDecimal targetValue;
    private BigDecimal weight;
    /** KPI trọng điểm theo năm ({@code kpis_information.is_important}). */
    private Boolean isImportant;
}
