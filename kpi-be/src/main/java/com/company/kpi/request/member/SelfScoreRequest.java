package com.company.kpi.request.member;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SelfScoreRequest {

    @NotNull
    @Min(1) @Max(5)
    private Integer selfScore;
}
