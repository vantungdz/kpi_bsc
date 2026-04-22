package com.company.kpi.response.member;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MemberKpiDashboardResponse {

    private Integer year;
    private String phase;
    private String phaseLabel;
    private List<MemberKpiCategoryResponse> categories;
    private List<MemberKpiAssignmentResponse> assignments;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MemberKpiAssignmentResponse {
        private UUID assignmentId;
        private String objective;
        private String targetDescription;
        private Double weight;
        private String type;
        /** Mid-year: chỉ có self score */
        private Double midSelfScore;
        /** Final: self + PM + GM */
        private Double endSelfScore;
        private Double endPmScore;
        private String evidences;
        private UUID categoryId;
    }

    @Data
    @AllArgsConstructor
    public static class MemberKpiCategoryResponse {
        private UUID id;
        private String name;
    }
}
