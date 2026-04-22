package com.company.kpi.entity;

import com.company.kpi.entity.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@EqualsAndHashCode(callSuper = true)
public class KpiAssignment extends BaseEntity {
    private UUID cycleId;
    private UUID kpiInfoId;
    private UUID userId;
    private UUID departmentId;
    private UUID jobTitleId;
    private UUID parentAssignmentId;
    private BigDecimal targetValue;
    private BigDecimal midSelfScore;
    private BigDecimal midPmScore;
    private BigDecimal endSelfScore;
    private BigDecimal endPmScore;
    private String evidences;
    private String status;
}
