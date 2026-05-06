package com.company.kpi.response.gm;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * Department slice under a KPI group (drawer: KPI → department → members).
 */
@Data
public class GmTimelineDepartmentGroupDto {
    /** Resolved section / department name; null if unassigned. */
    private String departmentName;
    private int affectedEmployees;
    private List<GmTimelineIssueDetailDto> employees = new ArrayList<>();
}
