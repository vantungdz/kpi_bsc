package com.company.kpi.response.pm;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class AssignedKpiDto {
    private Long assignmentId;
    private Long userId;
    private String userName;
    private Long kpiId;
    private String kpiName;
    private Double targetValue;
    private Double currentProgress;
    private String status;
}
