package com.company.kpi.response.gm;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * One issue bucket in the Process Timeline popover/drawer.
 * {@code id} matches {@code GmIssueTypeId} on the FE.
 */
@Data
public class GmTimelineIssueBucketDto {
    /** Legacy bucket id from old payload format (kept for backward compatibility). */
    private String id;
    /** Display title in the drawer (e.g. "KPIs Pending Approval"). */
    private String title;
    /** Tailwind classes for the bucket header icon. */
    private String iconClass;
    private List<GmTimelineIssueDetailDto> items = new ArrayList<>();
}
