package com.company.kpi.response.pm;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class KpiSheetResponse {

    private String id;
    private UUID userId;
    private String userName;
    private String rank;
    private Integer year;
    private String phase;
    private List<KpiItemResponse> items;
    private BigDecimal totalWeight;
    private Integer evidenceCount;
    private Integer evidenceTotalCount;
    private String status;

    @Data
    @Builder
    public static class KpiItemResponse {
        private String id;
        private String code;
        private String name;
        private String description;
        private String target;
        private BigDecimal weight;
        private String group;
        private String evidenceStatus;
        private String evidenceNote;
        private Integer selfScore;
        private Integer pmScore;
        private Integer leaderScore;
        private boolean canEditEvidence;
        private boolean canViewEvidence;
        private boolean canEditScore;
        private String evidenceTooltip;
        private String evaluationState;
    }
}
