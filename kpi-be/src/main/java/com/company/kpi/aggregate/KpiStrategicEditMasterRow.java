package com.company.kpi.aggregate;

import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class KpiStrategicEditMasterRow {
    private UUID kpiInformationId;
    private UUID cycleId;
    private UUID masterKpiId;
    private Integer typeCode;
    private UUID categoryId;
    private String kpiName;
    private String targetDescription;
    private BigDecimal targetValue;
    private BigDecimal weight;
    private Boolean isImportant;
    private Boolean allowAssigneeTargetScaleEdit;
    private Integer unitCode;
    private Integer calculationRuleCode;
    private Integer calculationTypeCode;
    private Boolean isGlobal;
    /** `roles.code` của user tạo `kpi_master` (GM / PM / LEADER / MEMBER). */
    private String creatorRoleCode;
}

