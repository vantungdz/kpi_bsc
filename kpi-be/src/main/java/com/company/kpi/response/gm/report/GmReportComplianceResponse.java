package com.company.kpi.response.gm.report;

import lombok.Data;

import java.util.List;

/** Compliance: doughnut phân bổ bottleneck (chờ duyệt / thiếu evidence) + danh sách. */
@Data
public class GmReportComplianceResponse {

    private Status status;
    private List<Bottleneck> bottlenecks;

    @Data
    public static class Status {
        /** Số member có ít nhất một KPI chờ duyệt điểm (501/502/601/602), cùng logic với danh sách bottleneck. */
        private Integer pendingApproval;
        /** Số member có ít nhất một KPI thiếu evidence (404|405, cùng rule danh sách). */
        private Integer missingEvidence;
        /** Tổng member trong tập bottleneck (mỗi user tối đa một lần; chờ duyệt + thiếu evidence). */
        private Integer total;
    }

    @Data
    public static class Bottleneck {
        private String userId;
        private String fullName;
        private String roleCode;
        private String sectionName;
        private String reason;
        private String severity; // info | warning | critical
        /** Ví dụ "Trễ 3 ngày" / "Hôm nay Deadline". */
        private String delayLabel;
    }
}
