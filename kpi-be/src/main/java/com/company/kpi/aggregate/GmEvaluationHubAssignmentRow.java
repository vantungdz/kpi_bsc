package com.company.kpi.aggregate;

import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

/** MyBatis row for {@code GmEvaluationHubMapper#listAssignmentsForEvaluationHub}. */
@Data
public class GmEvaluationHubAssignmentRow {

    private UUID assignmentId;
    private Integer statusCode;
    private String assignmentStatusName;
    /** {@code sys_status_codes.description} (ASM_STATUS). */
    private String assignmentStatusDescription;
    private BigDecimal midSelfScore;
    private BigDecimal endSelfScore;
    private BigDecimal endPmScore;
    private BigDecimal endGmScore;
    private String evidences;
    private String targetDescription;
    private BigDecimal weight;
    private String masterCode;
    private String masterName;
    private String categoryName;
    private String kpiTypeName;
    private UUID userId;
    private String userFullName;
    private String userUsername;
    private String rankCode;
    private UUID assigneeSupervisorId;
    private String assigneeSupervisorFullName;
    private UUID sectionId;
    private String sectionName;
    private UUID sectionManagerId;
    private String sectionManagerFullName;
    private String memberRoleCode;
    private String memberRoleName;
    /** Member — user_kpi_summaries.evaluation_comments (portfolio / BSC). */
    private String evaluationComments;
    /** Member — user_kpi_summaries.evaluation_comments_promotion. */
    private String evaluationCommentsPromotion;
    /** PM tổng portfolio — evaluation_supervisor_comments. */
    private String supervisorCommentPortfolio;
    /** PM tổng promotion — evaluation_supervisor_comments_promotion. */
    private String supervisorCommentPromotion;
}
