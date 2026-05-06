package com.company.kpi.response.gm;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * One operational / business issue on the GM Process Timeline (aggregated).
 * {@code employees} holds affected rows for the detail drawer only.
 */
@Data
public class GmTimelineIssueGroupDto {
    /** Stable key, e.g. {@code pending_pm_review}, {@code unassigned_members}. */
    private String id;
    private String title;
    /** {@code critical} | {@code warning} | {@code info} */
    private String severity;
    /** Bottleneck role for the group: PM, GM, Member, Organization, … */
    private String blockedRole;
    private int affectedEmployees;
    private int affectedKpis;
    private int affectedDepartments;
    /** Tailwind classes for drawer header icon chip. */
    private String iconClass;
    /**
     * Legacy department-first clusters; kept empty when {@link #kpiGroups} is populated.
     */
    private List<GmTimelineBreakdownGroupDto> breakdownGroups = new ArrayList<>();
    /**
     * KPI-first drawer hierarchy: KPI → department → assignees.
     */
    private List<GmTimelineKpiGroupDto> kpiGroups = new ArrayList<>();
    private List<GmTimelineIssueDetailDto> employees = new ArrayList<>();
}
