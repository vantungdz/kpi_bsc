package com.company.kpi.response.gm;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GmDepartmentResponse {

    private UUID id;
    private String name;
    private UUID parentId;
    private UUID managerId;
    /** {@code users.full_name} của manager — có thể null. */
    private String managerFullName;
    /**
     * Một {@code roles.code} của manager (ưu tiên GM → PM → LEADER → MEMBER khi có nhiều role);
     * null nếu không có manager hoặc user chưa gán role.
     */
    private String managerRoleCode;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    /** Nhân viên gắn {@code user_departments} với phòng ban này. */
    @Builder.Default
    private List<GmDepartmentMemberResponse> members = new ArrayList<>();

    /** KPI team giao cho phòng ban ({@code kpi_assignments.department_id}) trong năm {@link #kpiYear}. */
    @Builder.Default
    private List<GmDepartmentAssignedKpiResponse> assignedKpis = new ArrayList<>();

    /** Năm dùng để lọc KPI (metadata; payload list). */
    private Integer kpiYear;
}
