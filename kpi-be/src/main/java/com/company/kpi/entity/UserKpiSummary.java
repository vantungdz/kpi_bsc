package com.company.kpi.entity;

import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class UserKpiSummary {
    private UUID id;
    private UUID userId;
    private UUID cycleId;
    private BigDecimal finalScore;
    private String evaluationComments;
    private String evaluationSupervisorComments;
    /** Tự đánh giá member khi nộp scope Promotion (SubmitMemberSheetRequest.kpiType=PROMOTION). */
    private String evaluationCommentsPromotion;
    /** Nhận xét PM tổng tab Promotion (Team Review). */
    private String evaluationSupervisorCommentsPromotion;
    private UUID evaluatorId;
}