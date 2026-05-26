package com.company.kpi.response.gm;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * One issue row in the Process Timeline "View Issues" drawer:
 * KPI name, related parties, bottleneck, and block reason.
 */
@Data
public class GmTimelineIssueDetailDto {
    /** {@code kpi_assignments.id} */
    private UUID assignmentId;
    /** {@code kpi_assignments.parent_assignment_id} */
    private UUID parentAssignmentId;
    /** Assignee user id — for FE/backend dedup; optional. */
    private UUID subjectUserId;
    /** {@code kpi_master.id} — drawer grouping by KPI. */
    private UUID masterKpiId;
    private String kpi;
    /** Section head ({@code departments.manager_id}). */
    private String pm;
    /** Direct supervisor ({@code user_departments.supervisor_id}); distinct from Leader workflow step. */
    private String leader;
    /** Affected assignee. */
    private String member;
    /** {@code roles.code} for assignee (drawer badge). */
    private String roleCode;
    /** Primary department when available; supports affectedDepartments count. */
    private String departmentName;
    /** "Member" | "PM" | "GM" | "Leader" — role blocking the workflow. */
    private String bottleneck;
    /** Short description of why the item is blocked. */
    private String reason;
    /**
     * Child assignments (same department slice) linked via {@code parent_assignment_id}.
     * Drawer-only; flat {@link GmTimelineIssueGroupDto#getEmployees()} still lists all rows.
     */
    private List<GmTimelineIssueDetailDto> cascadeChildren = new ArrayList<>();
}
