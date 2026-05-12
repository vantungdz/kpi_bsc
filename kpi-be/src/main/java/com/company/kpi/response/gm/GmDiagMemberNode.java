package com.company.kpi.response.gm;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class GmDiagMemberNode {
    private String id;
    /** assignment id gốc để GM xử lý feedback / đổi trạng thái. */
    private String assignmentId;
    /** {@code kpi_assignments.parent_assignment_id} — null = assignment gốc (vd slice GM → PM). */
    private String parentAssignmentId;
    private String name;
    /** Cùng nhãn trọng số KPI như dòng KPI cha. */
    private String weight;
    /** {@code kpi_assignments.status_code} (ASM) của assignee. */
    private Integer statusCode;
    private String target;
    /** So target member/PM self voi tong target node con phu thuoc: {@code short} | {@code ok} | {@code excess}. */
    private String targetBalance;
    private String actual;
    private String status;
    /** Nhãn hiển thị cột trạng thái (tiếng Việt); null nếu chưa đủ dữ liệu điểm. */
    private String performanceLabel;
    private String blocker;
    private String rank;
    private String leader;
    /** {@code roles.code} của assignee (ưu tiên GM → PM → LEADER → MEMBER). */
    private String ownerRoleCode;
    /** {@code roles.name} của assignee — nhãn tag. */
    private String ownerRoleLabel;
    /** {@code roles.code} của supervisor (assignee); null nếu không có supervisor / không map được. */
    private String leaderRoleCode;
    /** {@code roles.name} của supervisor. */
    private String leaderRoleName;

    /** Mục tiêu năm (assignment hoặc catalog) — FE dùng cột Actual/% và tiến độ hoàn thành. */
    private BigDecimal submissionTarget;

    /** Giữa kỳ: {@code mid_self_score}; cuối kỳ: GM → PM → self score cuối. */
    private BigDecimal submissionActual;

    /** Raw evidences JSON text từ {@code kpi_assignments.evidences}. */
    private String evidences;

    /** Nội dung feedback active target về GM (nếu có). */
    private String feedbackNote;

    /** {@code user_kpi_summaries.evaluation_supervisor_comments} (theo assignee + chu kỳ). */
    private String evaluationSupervisorComments;

    /** {@code true} khi ASM 407 và feedback active cần GM xử lý (theo {@code roles.code}). */
    private boolean feedbackAwaitingGm;
}
