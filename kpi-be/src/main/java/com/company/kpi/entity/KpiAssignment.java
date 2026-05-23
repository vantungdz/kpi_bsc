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
    /** Thang điểm theo assignment (JSON); ưu tiên hơn catalog khi hiển thị / chấm. */
    private String scoringScale;
    private String updatePayload; // Handled as JSON string for MyBatis compatibility
    private String updateReason;
    private BigDecimal midSelfScore;
    private BigDecimal endSelfScore;
    private BigDecimal endPmScore;
    private BigDecimal endGmScore;
    private String evidences; // Handled as JSON string
    private String pmComment; // PM's evaluation comment for this KPI
    private Integer statusCode;
}
