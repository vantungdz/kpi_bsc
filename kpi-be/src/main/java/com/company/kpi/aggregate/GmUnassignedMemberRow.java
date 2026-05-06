package com.company.kpi.aggregate;

import lombok.Data;

import java.util.UUID;

/**
 * Member (MEMBER role) with primary department but no individual KPI assignment in the cycle.
 */
@Data
public class GmUnassignedMemberRow {
    private UUID userId;
    private String fullName;
    /** One {@code roles.code} for the user (same priority as timeline assignments). */
    private String roleCode;
    private String departmentName;
    /** Trưởng phòng ({@code departments.manager_id}). */
    private String pmName;
    /** Cấp trên trực tiếp ({@code user_departments.supervisor_id}). */
    private String leaderName;
}
