package com.company.kpi.response.kpi;

import com.company.kpi.dto.kpi.KpiScoringRulesPayload;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

/** Kết quả sau khi GM tạo KPI — đủ field để FE merge vào catalog / refetch diagnostics. */
@Data
@Builder
public class StrategicKpiResponse {

    private UUID kpiInformationId;
    private UUID cycleId;
    private UUID masterKpiId;
    private String code;
    private String name;
    private UUID categoryId;
    private String categoryName;
    private Integer typeCode;
    private Integer calculationRuleCode;
    private Integer calculationTypeCode;
    private Integer unitCode;
    private Boolean isGlobal;
    private KpiScoringRulesPayload targetDescription;
    private BigDecimal targetValue;
    private BigDecimal weight;
    private Boolean isImportant;
    private Boolean allowAssigneeTargetScaleEdit;

    /** Số bản ghi {@code kpi_assignments} đã tạo (member). */
    private int assignmentsCreated;
}
