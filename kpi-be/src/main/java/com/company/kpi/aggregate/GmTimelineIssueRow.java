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

    /** {@code kpi_master.name} */
    private String kpiName;

    /** {@code users.full_name} của assignee (member). */
    private String memberName;

    /**
     * {@code users.full_name} của supervisor (PM) — từ {@code user_departments.supervisor_id}.
     * Có thể null nếu member chưa được gán phòng ban.
     */
    private String pmName;

    /** {@code kpi_assignments.status_code} — dùng để map phase + issue type + bottleneck. */
    private Integer statusCode;

    /**
     * Null nếu {@code evidences} là NULL, {@code []} hoặc {@code {}} — đã xử lý trong SQL (CASE/WHEN).
     * Non-null → member đã đính kèm file evidence.
     */
    private String evidences;
}
