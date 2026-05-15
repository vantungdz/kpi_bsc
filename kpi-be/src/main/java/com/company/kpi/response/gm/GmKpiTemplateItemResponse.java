package com.company.kpi.response.gm;

import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Một dòng {@code kpi_template_items} kèm snapshot {@code kpi_master} + tên nhóm KPI.
 * Dùng form «Tạo từ template» và thư viện mẫu.
 */
@Data
public class GmKpiTemplateItemResponse {
    private UUID templateItemId;
    private UUID templateId;
    private UUID masterKpiId;
    private String masterCode;
    private String masterName;
    private UUID categoryId;
    private String categoryName;
    private Integer typeCode;
    private Integer unitCode;
    private Integer calculationRuleCode;
    private Integer calculationTypeCode;
    private String targetDescription;
    private BigDecimal defaultTargetValue;
    private BigDecimal defaultWeight;
}
