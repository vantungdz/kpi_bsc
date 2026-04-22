package com.company.kpi.response.pm;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class PmKpiDashboardResponse {

    private Integer year;
    private String phase;
    private List<TeamMemberDto> teamMembers;
    private KpiSheetResponse mySheet;

    @Data
    @Builder
    public static class TeamMemberDto {
        private String id;
        private String name;
        private String rank;
        private String sheetStatus;
        private BigDecimal selfScore;
        private BigDecimal pmScore;
        private Boolean awaitingPmReview;
    }
}
