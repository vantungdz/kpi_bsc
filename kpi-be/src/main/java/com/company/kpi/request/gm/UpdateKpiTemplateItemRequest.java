package com.company.kpi.request.gm;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class UpdateKpiTemplateItemRequest {

    @Size(max = 255)
    private String kpiName;

    private UUID perspective;
    private Integer typeCode;
    private Integer unitCode;
    private String calculationMethod;
    private Integer cycleYear;
    private Object targetDescription;
    private BigDecimal defaultTargetValue;
    private BigDecimal defaultWeight;

    private Boolean isImportant;

    private Boolean allowAssigneeTargetScaleEdit;
}
