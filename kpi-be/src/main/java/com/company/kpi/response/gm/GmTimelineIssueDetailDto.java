package com.company.kpi.response.gm;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Một issue item — hiển thị trong drawer "View Issues" của Process Timeline.
 * Gồm tên KPI, tên các bên liên quan, bottleneck và lý do block.
 */
@Data
public class GmTimelineIssueDetailDto {
    /** {@code kpi_assignments.id} */
    private UUID assignmentId;
    /** {@code kpi_assignments.parent_assignment_id} */
    private UUID parentAssignmentId;
    /** Assignee user id — để FE/backend dedup tổng hợp; optional. */
    private UUID subjectUserId;
    /** {@code kpi_master.id} — gom drawer theo KPI. */
    private UUID masterKpiId;
    private String kpi;
    /** Trưởng phòng / section ({@code departments.manager_id}). */
    private String pm;
    /** Cấp trên trực tiếp ({@code user_departments.supervisor_id}); không nhầm với bước Leader trong luồng 4 cấp. */
    private String leader;
    /** Người bị ảnh hưởng trực tiếp (assignee KPI). */
    private String member;
    /** {@code roles.code} for assignee (drawer badge). */
    private String roleCode;
    /** Phòng ban (primary) khi có; hỗ trợ đếm affectedDepartments. */
    private String departmentName;
    /** "Member" | "PM" | "GM" | "Leader" — vai trò đang block workflow. */
    private String bottleneck;
    /** Mô tả ngắn vì sao bị block. */
    private String reason;
    /**
     * Assignment con (cùng slice phòng) gắn qua {@code parent_assignment_id} → parent trong danh sách này.
     * Chỉ dùng cho drawer; danh sách phẳng {@link GmTimelineIssueGroupDto#getEmployees()} vẫn đủ hàng.
     */
    private List<GmTimelineIssueDetailDto> cascadeChildren = new ArrayList<>();
}
