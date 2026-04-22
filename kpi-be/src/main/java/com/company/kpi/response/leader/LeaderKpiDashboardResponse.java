package com.company.kpi.response.leader;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class LeaderKpiDashboardResponse {

    private Integer year;
    private String phase;
    private List<TeamMemberDto> teamMembers;
    private com.company.kpi.response.pm.KpiSheetResponse mySheet;

    @Data
    @Builder
    public static class TeamMemberDto {
        private String id;
        private String name;
        private String rank;
        private String sheetStatus;
        private BigDecimal score;
        private Integer pendingCount;
    }
}
