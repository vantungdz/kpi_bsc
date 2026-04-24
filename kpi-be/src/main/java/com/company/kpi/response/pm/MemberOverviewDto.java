package com.company.kpi.response.pm;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class MemberOverviewDto {
    private Long id;
    private String name;
    private String role;
    private Double overallProgress;
    private Integer numberOfKpis;
    private String statusSummary;
}
