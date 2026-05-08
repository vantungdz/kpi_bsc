package com.company.kpi.request.member;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class SubmitMemberSheetRequest {

    @NotNull
    private Integer year;

    /**
     * Submit scope for member sheet:
     * - INDIVIDUAL: KPI type INDIVIDUAL + TEAM
     * - PROMOTION: KPI type PROMOTION
     */
    @Pattern(regexp = "INDIVIDUAL|PROMOTION")
    private String kpiType = "INDIVIDUAL";

    /** Comment của employee — lưu vào user_kpi_summaries.evaluation_comments khi submit thành công. */
    private String evaluationComments;
}
