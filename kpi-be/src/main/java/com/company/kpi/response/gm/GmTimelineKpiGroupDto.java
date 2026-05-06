package com.company.kpi.response.gm;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * KPI-first operational cluster for GM timeline drawer (KPI → departments → assignees).
 */
@Data
public class GmTimelineKpiGroupDto {
    /** {@code kpi_master.id} when known; null for legacy / unassigned rows. */
    private UUID masterKpiId;
    private String kpiName;
    private int affectedEmployees;
    private int affectedDepartments;
    /** Short operational line (same issue class → same tone as FE drawer). */
    private String blockerSummary;
    /** Unused at KPI scope — PM differs per department; do not aggregate here. */
    private String pmName;
    /** Unused at KPI scope — supervisor is per assignee, not one label per KPI. */
    private String leaderName;
    private List<GmTimelineDepartmentGroupDto> departments = new ArrayList<>();
}
