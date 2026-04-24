package com.company.kpi.aggregate;

import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class DeptTeamKpiJoinRow {

    private UUID departmentId;
    private UUID assignmentId;
    private UUID cycleId;
    private Integer cycleYear;
    private UUID kpiInfoId;
    private String kpiCode;
    private String kpiName;
    private Integer statusCode;
    private Integer typeCode;
    private BigDecimal targetValue;
    private BigDecimal weight;
}

