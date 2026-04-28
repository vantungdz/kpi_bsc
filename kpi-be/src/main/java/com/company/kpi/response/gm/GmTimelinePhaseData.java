package com.company.kpi.response.gm;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * Dữ liệu issues của 1 phase (setting / midYear / yearEnd) trong Process Timeline.
 * Được build bởi {@code GmProcessTimelineService} và truyền về FE.
 */
@Data
public class GmTimelinePhaseData {
    /** True nếu có ít nhất 1 item trong bất kỳ bucket nào. */
    private boolean hasOpenIssues;
    /** Vd: "5 KPI chưa hoàn thành" — đếm theo DISTINCT assignmentId. */
    private String pendingKpisLine;
    /** Vd: "3 issues — KPI Setting" — tiêu đề popover. */
    private String popoverTitle;
    private List<GmTimelineIssueBucketDto> issueDetails = new ArrayList<>();
}
