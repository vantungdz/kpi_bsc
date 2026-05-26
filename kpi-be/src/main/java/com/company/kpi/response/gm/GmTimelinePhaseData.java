package com.company.kpi.response.gm;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * Issue data for one Process Timeline phase (setting / midYear / yearEnd).
 * Built by {@code GmProcessTimelineService} and returned to the FE.
 */
@Data
public class GmTimelinePhaseData {
    /** True when at least one operational issue group exists ({@code issueGroups} non-empty). */
    private boolean hasOpenIssues;
    /** Count of operational issue groups (each {@code issueGroups} element = 1 issue). */
    private int operationalIssueCount;
    /** Distinct people count ({@code subjectUserId} / name fallback) across all groups. */
    private int totalDistinctEmployeesAffected;
    /** e.g. «3 issues» — button label; employee count is not included. */
    private String pendingKpisLine;
    /** e.g. «3 issues — KPI Setting». */
    private String popoverTitle;
    private List<GmTimelineIssueGroupDto> issueGroups = new ArrayList<>();
}
