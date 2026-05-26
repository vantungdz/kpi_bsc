package com.company.kpi.request.gm;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Tạo KPI mẫu trong gói template — ghi {@code kpi_master} (is_global=false) + {@code kpi_template_items}.
 * Không tạo {@code kpis_information} / chu kỳ (khác Strategic KPI dashboard).
 */
@Data
public class CreateKpiTemplateItemRequest {

    @NotBlank
    @Size(max = 255)
    private String kpiName;

    @NotNull
    private UUID perspective;

    @NotNull
    private Integer typeCode;

    @NotNull
    private Integer unitCode;

    @NotBlank
    private String calculationMethod;

    private Integer cycleYear;

    private Object targetDescription;

    private BigDecimal defaultTargetValue;

    @NotNull
    private BigDecimal defaultWeight;

    private Boolean isImportant;

    private Boolean allowAssigneeTargetScaleEdit;
}
