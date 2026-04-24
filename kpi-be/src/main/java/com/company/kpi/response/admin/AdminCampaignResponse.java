package com.company.kpi.response.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminCampaignResponse {

    private String id;
    private String label;
    /** Giá trị: "current" | "future" | "past_YYYY" */
    private String period;
    /** Giá trị: "active" | "upcoming" | "archived" */
    private String status;
    private String startDate;
    private String endDate;
    private CampaignStats stats;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CampaignStats {
        private int total;
        private int completed;
        private int pending;
        private int notStarted;
        private int overdue;
    }
}
