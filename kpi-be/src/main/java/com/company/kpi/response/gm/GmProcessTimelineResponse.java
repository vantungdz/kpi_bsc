package com.company.kpi.response.gm;

import lombok.Data;

/**
 * Response tổng hợp cho endpoint {@code GET /v1/kpi/gm/process-timeline}.
 * Gồm 3 phases theo lịch năm: setting (Jan–Mar), midYear (Jun–Jul), yearEnd (Nov–Dec).
 */
@Data
public class GmProcessTimelineResponse {
    /** Phase 1: KPI Setting (Jan–Mar) — status 401–406. */
    private GmTimelinePhaseData setting;
    /** Phase 2: Mid-Year Review (Jun–Jul) — status 501–502 + 405 */
    private GmTimelinePhaseData midYear;
    /** Phase 3: Year-End Review (Nov–Dec) — status 601–602 + 405/503 */
    private GmTimelinePhaseData yearEnd;
}
