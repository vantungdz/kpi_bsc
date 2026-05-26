package com.company.kpi.response.gm;

import lombok.Data;

/**
 * Aggregated response for {@code GET /v1/kpi/gm/process-timeline}.
 * Three calendar phases: setting (Jan–Mar), midYear (Jun–Jul), yearEnd (Nov–Dec).
 */
@Data
public class GmProcessTimelineResponse {
    /** Phase 1: KPI Setting (Jan–Mar) — status 401–406. */
    private GmTimelinePhaseData setting;
    /** Phase 2: Mid-Year Review (Jun–Jul) — status 501–502, 504, 405 (not evaluated). */
    private GmTimelinePhaseData midYear;
    /** Phase 3: Year-End Review (Nov–Dec) — status 601–602, 604, 503 (not evaluated). */
    private GmTimelinePhaseData yearEnd;
}
