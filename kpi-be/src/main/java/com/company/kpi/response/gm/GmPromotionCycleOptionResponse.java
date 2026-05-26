package com.company.kpi.response.gm;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Option for GM UI — {@code GET /kpi/gm/promotion-cycles}. */
@Data
@Builder
public class GmPromotionCycleOptionResponse {
    private UUID id;
    private UUID userId;
    private String name;
    private OffsetDateTime startDate;
    private OffsetDateTime endDate;
    private Integer durationMonths;
    private Integer statusCode;
}
