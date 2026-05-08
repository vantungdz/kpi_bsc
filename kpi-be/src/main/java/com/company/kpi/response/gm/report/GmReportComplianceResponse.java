package com.company.kpi.response.gm.report;

import lombok.Data;

import java.util.List;

/** Compliance: doughnut tiến độ + danh sách bottleneck quá hạn. */
@Data
public class GmReportComplianceResponse {

    private Status status;
    private List<Bottleneck> bottlenecks;

    @Data
    public static class Status {
        private Integer completed;
        private Integer pendingApproval;
        private Integer missingEvidence;
        private Integer total;
        /** 0..100 — phần trăm hoàn tất so với total. */
        private Integer percentComplete;
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
