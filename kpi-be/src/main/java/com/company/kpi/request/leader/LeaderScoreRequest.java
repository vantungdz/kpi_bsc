package com.company.kpi.request.leader;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class LeaderScoreRequest {

    @NotNull
    @Min(1) @Max(5)
    private Integer leaderScore;
}
