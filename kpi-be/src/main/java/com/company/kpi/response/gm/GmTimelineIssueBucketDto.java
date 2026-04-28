package com.company.kpi.response.gm;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * Một nhóm (bucket) issue trong popover/drawer của Process Timeline.
 * {@code id} khớp với {@code GmIssueTypeId} trên FE.
 */
@Data
public class GmTimelineIssueBucketDto {
    /** "pending_approval" | "not_submitted" | "missing_evidence" */
    private String id;
    /** Tiêu đề hiển thị trong drawer (vd: "KPIs Pending Approval") */
    private String title;
    /** Tailwind class cho icon header của bucket. */
    private String iconClass;
    private List<GmTimelineIssueDetailDto> items = new ArrayList<>();
}
