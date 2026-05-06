package com.company.kpi.response.gm;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * Operational cluster inside a timeline issue group (by department / section head / supervisor).
 * Used for GM drawer: summary first, employee list only when expanded.
 */
@Data
public class GmTimelineBreakdownGroupDto {
    /** Stable key for UI state (dept / pm / supervisor bucket). */
    private String groupKey;
    /** Primary line for the cluster (department name, PM, or supervisor label). */
    private String groupLabel;
    private String departmentName;
    /** Section / department head — {@code departments.manager_id} (dominant in cluster). */
    private String pmName;
    /** Direct supervisor — {@code user_departments.supervisor_id} (dominant in cluster). */
    private String leaderName;
    private int affectedEmployees;
    private int affectedKpis;
    private List<GmTimelineIssueDetailDto> employees = new ArrayList<>();
}
