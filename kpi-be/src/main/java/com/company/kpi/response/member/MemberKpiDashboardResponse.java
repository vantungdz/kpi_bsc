package com.company.kpi.response.member;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Payload aligned with FE {@code MemberKpiDashboard}: sheet + submit hints.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MemberKpiDashboardResponse {

    private Integer year;
    /** target_setup | mid_year | year_end */
    private String phase;
    private String phaseLabel;
    private MemberKpiSheetPayload sheet;
    /** Assignment IDs chưa đủ điều kiện nộp */
    private List<String> pendingItems;
    private boolean canSubmit;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class MemberKpiSheetPayload {
        private String id;
        private String userId;
        private String userName;
        private String rank;
        private Integer year;
        private String phase;
        private List<MemberKpiItemPayload> items;
        private Double totalWeight;
        private Integer evidenceCount;
        private Integer evidenceTotalCount;
        /** draft | submitted | approved | rejected — đơn giản hóa theo trạng thái tổng */
        private String status;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class MemberKpiItemPayload {
        private String id;
        private String code;
        private String name;
        private String description;
        /**
         * Cột "Chỉ tiêu" trên lưới: ưu tiên mô tả chỉ tiêu (HTML/plain) từ kpis_information.target_description.
         */
        private String target;
        /** ka.target_value — mục tiêu giao cho cá nhân */
        private Double assignmentTargetValue;
        /** ki.target_value — chỉ tiêu chuẩn theo thư viện KPI năm */
        private Double kpiTemplateTargetValue;
        /** kpi_assignments.status_code */
        private Integer statusCode;
        /** Nhãn tiếng Việt cho status_code (ASM_STATUS) */
        private String assignmentStatusName;
        private Double weight;
        /** A | B | C | P | I — sheet grouping / form case */
        private String group;
        /** {@code kpi_categories.id} — nhóm hiển thị theo thư mục danh mục */
        private String categoryId;
        /** {@code kpi_categories.name} */
        private String categoryName;
        /** {@code kpi_master.calculation_rule_code} — 801–804 */
        private Integer calculationRuleCode;
        /** {@code kpi_master.calculation_type_code} — 701 (Actual/Plan) | 702 (Plan/Actual) */
        private Integer calculationTypeCode;
        /**
         * JSON thô từ {@code kpi_assignments.evidences} (trang chi tiết / map form).
         */
        private String evidencesJson;
        private String evaluationStatus;
        private String evidenceStatus;
        private String evidenceFormCase;
        private String evidenceNote;
        private String certificateOutcomeNote;
        private Double selfScore;
        private Double pmScore;
        private Double leaderScore;
        private String result;
        private String actual;
        private List<PlanActualRecord> planActualRecords;
        private List<WaTimeRecord> waTimeRecords;
        /** Member sheet: chỉnh minh chứng / drawer — nguồn sự thật luồng ASM + phase (FE chỉ bind). */
        private boolean canEditEvidence;
        private boolean canViewEvidence;
        private boolean canEditScore;
        private String evidenceTooltip;
        /** Nhãn ngắn trạng thái đánh giá (hiển thị); optional. */
        private String evaluationState;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PlanActualRecord {
        private String plan;
        private String actual;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WaTimeRecord {
        private String month;
        private String spent;
        private String standard;
    }
}
