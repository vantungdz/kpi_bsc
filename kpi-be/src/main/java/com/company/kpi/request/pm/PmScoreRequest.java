package com.company.kpi.request.pm;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PmScoreRequest {

    @NotNull
    @Min(1) @Max(5)
    private Integer pmScore;
}
