package com.company.kpi.response.gm;

import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Một dòng {@code kpi_assignments} trong hub đánh giá GM — ASM 501/502/503/601/602/603.
 */
@Data
public class GmEvaluationHubAssignmentResponse {

    private UUID assignmentId;
    private Integer statusCode;
    private String assignmentStatusName;
    /** {@code sys_status_codes.description} — hiển thị cột Tiến độ. */
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
    /** Explicit calc rule for FE rendering (803 = comment/manual input). */
    private Integer calculationRuleCode;
    /** Optional calc type (701/702) for completeness. */
    private Integer calculationTypeCode;
    private String categoryName;
    private String kpiTypeName;
    private UUID userId;
    private String userFullName;
    private String userUsername;
    private String employmentStatus;
    private OffsetDateTime resignedAt;
    private String rankCode;
    private UUID assigneeSupervisorId;
    private String assigneeSupervisorFullName;
    private UUID sectionId;
    private String sectionName;
    private UUID sectionManagerId;
    private String sectionManagerFullName;
    private String memberRoleCode;
    private String memberRoleName;
    /** Member tự đánh giá (portfolio). */
    private String evaluationComments;
    /** Member tự đánh giá (promotion). */
    private String evaluationCommentsPromotion;
    /** Nhận xét PM tổng portfolio. */
    private String supervisorCommentPortfolio;
    /** Nhận xét PM tổng promotion. */
    private String supervisorCommentPromotion;
    private String inactiveReason;
    private Boolean excludedFromRollup;
}
