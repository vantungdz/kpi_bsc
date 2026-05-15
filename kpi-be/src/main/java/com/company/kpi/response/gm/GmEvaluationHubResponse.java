package com.company.kpi.response.gm;

import lombok.Data;

import java.util.List;
import java.util.UUID;

/** Payload tab đánh giá GM theo một {@code kpi_cycles.id}. */
@Data
public class GmEvaluationHubResponse {

    private UUID cycleId;
    private Integer year;
    private String cycleName;
    private String activePhase;
    private List<GmEvaluationHubAssignmentResponse> assignments;
}
