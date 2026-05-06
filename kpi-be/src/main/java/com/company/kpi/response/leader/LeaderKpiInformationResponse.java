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
        /** Mục tiêu số (assignment hoặc catalog) — cột Target tab KPI cá nhân GM. */
        private BigDecimal targetValue;
        private Integer unitCode;
        private String unitName;
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
        private String feedbackComment;
        private String evaluationStatus;
        private String evaluationState;
        /** kpi_master.calculation_rule_code — 801 (none) | 802 (average/ratio) | 803 (comment/text) */
        private Integer calculationRuleCode;
        /** kpi_master.calculation_type_code — 701 (Actual/Plan×100%) | 702 (Plan/Actual×100%) */
        private Integer calculationTypeCode;
        /** kpi_master.type_code (101 INDIVIDUAL, 102 TEAM, 103 PROMOTION, …). */
        private Integer typeCode;
        /** sys_status_codes.name — loại KPI từ master. */
        private String typeName;
    }
}
