package com.company.kpi.response.kpi;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Payload GET chỉnh sửa KPI chiến lược — đồng bộ form GM (tạo/sửa). */
@Data
@Builder
public class StrategicKpiEditResponse {

    private UUID kpiInformationId;
    private UUID cycleId;
    private UUID masterKpiId;
    private Integer typeCode;
    private UUID perspective;
    private String kpiName;
    private String targetDescription;
    private BigDecimal targetValue;
    private Integer unitCode;
    private BigDecimal weightPct;
    private String calculationMethod;
    private Boolean isImportant;

    private List<UUID> assignPMs;
    private Map<String, Object> pmTargets;
    private List<UUID> memberIds;
}
