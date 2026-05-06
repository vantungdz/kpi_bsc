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
    /** True nếu có ít nhất một nhóm vấn đề vận hành ({@code issueGroups} không rỗng). */
    private boolean hasOpenIssues;
    /** Số nhóm vấn đề vận hành (mỗi phần tử {@code issueGroups} = 1 issue). */
    private int operationalIssueCount;
    /** Số nhân sự distinct (theo {@code subjectUserId} / fallback tên) across all groups. */
    private int totalDistinctEmployeesAffected;
    /** Vd: «3 issues» — nhãn nút; không kèm số nhân sự. */
    private String pendingKpisLine;
    /** Vd: «3 issues — KPI Setting». */
    private String popoverTitle;
    private List<GmTimelineIssueGroupDto> issueGroups = new ArrayList<>();
}
