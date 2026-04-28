package com.company.kpi.response.leader;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class LeaderKpiInformationResponse {
    private Integer year;
    private LeaderKpiCycleInfo kpiCycle;
    private List<LeaderKpiCategoryGroup> categories;
    private LeaderKpiSummary kpiSummary;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LeaderKpiCycleInfo {
        private UUID id;
        private Integer year;
        private String name;
        private OffsetDateTime goalSettingStart;
        private OffsetDateTime goalSettingEnd;
        private OffsetDateTime midYearStart;
        private OffsetDateTime midYearEnd;
        private OffsetDateTime endYearStart;
        private OffsetDateTime endYearEnd;
        private String activePhase;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LeaderKpiSummary {
        private BigDecimal finalScore;
        private String evaluationComments;
        private String evaluationSupervisorComments;
    }

    @Data
    @AllArgsConstructor
    public static class LeaderKpiCategoryGroup {
        private UUID id;
        private String name;
        private List<LeaderKpiAssignmentResponse> assignments;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LeaderKpiAssignmentResponse {
        private UUID assignmentId;
        private String kpiName;
        private String kpiCode;
        private String targetDescription;
        private Double weight;
        private Integer statusCode;
        private String statusName;
        private String statusDesc;
        // Mid-year: chỉ có self score
        private Double midSelfScore;
        // Final: self + PM + GM
        private Double endSelfScore;
        private Double endPmScore;
        private String evidences;
    }
}
