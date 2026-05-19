package com.company.kpi.request.gm;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class SaveGmRatingScaleLevelRequest {

    @NotNull
    private Integer sortOrder;

    @NotBlank
    @Size(max = 10)
    private String levelCode;

    @NotBlank
    @Size(max = 120)
    private String label;

    @NotNull
    @DecimalMin("0")
    private BigDecimal minScore;

    private BigDecimal maxScore;

    @NotNull
    private BigDecimal pitch;

    @Size(max = 7)
    private String colorHex;

    private Boolean topTier;
}
