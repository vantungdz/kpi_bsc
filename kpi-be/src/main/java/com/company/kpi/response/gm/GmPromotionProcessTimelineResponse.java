package com.company.kpi.response.gm;

import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Aggregated response for promotion process timeline APIs.
 * {@code GET /v1/kpi/gm/promotion-process-timeline} and PM dashboard equivalent.
 */
@Data
public class GmPromotionProcessTimelineResponse {

    private UUID promotionCycleId;
    private String name;
    private OffsetDateTime startDate;
    private OffsetDateTime endDate;
    private Integer durationMonths;
    private Integer statusCode;

    /**
     * {@code NOT_STARTED} | {@code IN_PROGRESS} | {@code COMPLETED} | {@code OVERDUE}
     */
    private String activeSegment;

    /** Calendar progress along the promotion window, clamped 0–100. */
    private int progressPercent;

    /** Operational issues for the promotion evaluation flow (single phase). */
    private GmTimelinePhaseData operational;
}
