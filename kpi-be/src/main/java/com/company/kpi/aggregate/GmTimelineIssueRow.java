package com.company.kpi.aggregate;

import lombok.Data;

import java.util.UUID;

/**
 * Row thô từ SQL query timeline — MyBatis map trực tiếp.
 * Service sẽ phân loại theo {@code statusCode} thành phase + issue type.
 */
@Data
public class GmTimelineIssueRow {

    /** {@code kpi_assignments.id} */
    private UUID assignmentId;

    /** {@code kpi_assignments.parent_assignment_id} — phân bổ cascade xuống cấp dưới. */
    private UUID parentAssignmentId;

    /** {@code kpi_assignments.user_id} */
    private UUID userId;

    /** {@code kpi_master.id} */
    private UUID masterKpiId;

    /** {@code kpi_master.type_code} */
    private Integer typeCode;

    /** {@code kpi_master.name} */
    private String kpiName;

    /** {@code users.full_name} của assignee (member). */
    private String memberName;

    /**
     * One {@code roles.code} for assignee (from {@code user_roles} + {@code roles}; priority: GM, PM, LEADER, MEMBER, then others).
     */
    private String roleCode;

    /**
     * {@code users.full_name} của trưởng phòng / section — từ {@code departments.manager_id}
     * (primary department). Khác với supervisor trực tiếp.
     */
    private String pmName;

    /**
     * {@code users.full_name} của cấp trên trực tiếp — {@code user_departments.supervisor_id}.
     */
    private String leaderName;

    /**
     * Dept name from COALESCE(assignment.department_id, primary user_departments.department_id),
     * aligned with departments.manager_id for section PM.
     */
    private String departmentName;

    /** {@code kpi_assignments.status_code} — dùng để map phase + issue type + bottleneck. */
    private Integer statusCode;

    /**
     * Null nếu {@code evidences} là NULL, {@code []} hoặc {@code {}} — đã xử lý trong SQL (CASE/WHEN).
     * Non-null → member đã đính kèm file evidence.
     */
    private String evidences;
}
