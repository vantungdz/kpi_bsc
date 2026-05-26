package com.company.kpi.response.gm;

import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * One flattened row from {@code kpi_assignments} + org + KPI master (MyBatis result).
 * <p>{@code sectionManager*} = {@code departments.manager_id} của đơn vị primary của assignee;
 * {@code leaderName} = tên user {@code user_departments.supervisor_id} của assignee.
 * Khi {@code member_id = section_manager_id}, hierarchy gom nhóm trực tiếp (không lồng assignee dưới supervisor).
 */
@Data
public class GmDiagnosticsFlatRow {

    private UUID kpiInfoId;
    private UUID masterKpiId;
    private String kpiCode;
    private String kpiName;
    private UUID categoryId;
    private String categoryName;
    private Integer typeCode;
    private Integer calculationRuleCode;
    private Integer calculationTypeCode;
    /** {@code kpi_master.is_global} — {@code true}: KPI GM giao công ty; {@code false}: member đề xuất / mẫu. */
    private Boolean isGlobal;
    /** Một {@code roles.code} của user tạo KPI (GM, PM, LEADER, MEMBER). */
    private String creatorRoleCode;
    /** {@code kpi_master.unit_code} — KPI_UNIT (sys_status_codes). */
    private Integer unitCode;
    private BigDecimal kpiWeight;
    private BigDecimal catalogTargetValue;
    private String kpiTargetDescription;
    /** Cột `kpis_information.is_important` — KPI trọng điểm (hiển thị sao trên GM diagnostics). */
    private Boolean isImportant;

    private UUID sectionId;
    private String sectionName;

    private UUID sectionManagerId;
    private String sectionManagerName;
    /** Một {@code roles.code} của {@link #sectionManagerId} (GM → PM → LEADER → MEMBER). */
    private String sectionManagerRoleCode;
    /** {@code roles.name} tương ứng {@link #sectionManagerRoleCode}. */
    private String sectionManagerRoleName;

    private UUID memberId;
    private String memberName;
    /** Một {@code roles.code} của assignee {@link #memberId} (GM → PM → LEADER → MEMBER). */
    private String memberRoleCode;
    /** {@code roles.name} tương ứng {@link #memberRoleCode}. */
    private String memberRoleName;
    private String leaderName;
    /** {@code user_departments.supervisor_id} — để map role supervisor. */
    private UUID leaderId;
    /** Một {@code roles.code} của supervisor (assignee). */
    private String leaderRoleCode;
    /** {@code roles.name} tương ứng {@link #leaderRoleCode}. */
    private String leaderRoleName;
    private String memberRank;
    /** {@code ranks.code} của assignee, ví dụ R1/R2/R3. */
    private String memberRankCode;

    private UUID assignmentId;
    /** {@code kpi_assignments.parent_assignment_id} — null = assignment gốc (vd GM giao slice cho PM/đơn vị). */
    private UUID parentAssignmentId;
    private Integer statusCode;
    private BigDecimal midSelfScore;
    private BigDecimal endSelfScore;
    private BigDecimal endPmScore;
    private BigDecimal endGmScore;
    /** Target GM giao trực tiếp cho department/PM slice gốc. */
    private BigDecimal sectionAssignedTargetValue;
    private BigDecimal memberTargetValue;
    private String evidences;
    private String feedbackNote;
    /** {@code user_kpi_summaries.evaluation_supervisor_comments} — nhận xét supervisor (PM) theo user + chu kỳ. */
    private String evaluationSupervisorComments;
    /**
     * {@code roles.code} của feedback active trên assignment (bất kỳ target PM/GM),
     * dùng để biết 407 có cần GM xử lý hay không.
     */
    private String activeFeedbackTargetRoleCode;

    /** {@code kpi_assignments.promotion_cycle_id} — chỉ khi {@link #typeCode} = 103. */
    private UUID promotionCycleId;
}
