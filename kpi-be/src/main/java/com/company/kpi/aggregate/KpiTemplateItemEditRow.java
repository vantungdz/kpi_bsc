package com.company.kpi.aggregate;

import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

/** Dòng {@code kpi_template_items} + master đềEmerge PUT (không phải KPI kỳ). */
@Data
public class KpiTemplateItemEditRow {
    private UUID templateItemId;
    private UUID templateId;
    private UUID masterKpiId;
    private String kpiName;
    private UUID categoryId;
    private Integer typeCode;
    private Integer unitCode;
    private Integer calculationRuleCode;
    private Integer calculationTypeCode;
    private String defaultTargetDescription;
    private BigDecimal defaultTargetValue;
    private BigDecimal defaultWeight;
    private Boolean isImportant;
    private Boolean allowAssigneeTargetScaleEdit;
}

