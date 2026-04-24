package com.company.kpi.response.gm;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

/** KPI giao theo phòng ban ({@code kpi_assignments.department_id} + {@code user_id} null) trong một chu kỳ năm. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GmDepartmentAssignedKpiResponse {

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
