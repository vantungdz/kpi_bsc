package com.company.kpi.response.gm;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class GmKpiDashboardResponse {

    private Integer year;
    private String currentPhase;
    private Integer phaseProgressPct;
    private List<CoreTargetDto> coreTargets;
    private List<SectionDto> sections;
    private SummaryDto summary;

    @Data
    @Builder
    public static class CoreTargetDto {
        private String id;
        private String code;
        private String name;
        private String target;
        private String overallValue;
        private Boolean overallMet;
        private String unit;
        private Integer progressPct;
        private List<BreakdownDto> breakdown;
    }

    @Data
    @Builder
    public static class BreakdownDto {
        private String sectionId;
        private String sectionName;
        private String value;
        private Boolean met;
        private Boolean warning;
    }

    @Data
    @Builder
    public static class SectionDto {
        private String id;
        private String name;
        private String managerId;
        private String managerName;
        private Integer memberCount;
        private Integer targetSetupPct;
        private Integer midYearPct;
        private Integer yearEndPct;
        private Integer pendingCount;
    }

    @Data
    @Builder
    public static class SummaryDto {
        private Integer totalMembers;
        private List<RankCountDto> byRank;
        private Integer yearEndCompleted;
        private Integer highPerformers;
        private Integer meetsTarget;
        private Integer underperforming;
        private Integer pendingEvaluation;
        private Integer missingEvidence;
        private Integer pendingApproval;
        private Integer overdue;
    }

    @Data
    @Builder
    public static class RankCountDto {
        private String label;
        private Integer count;
    }
}
