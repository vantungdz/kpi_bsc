package com.company.kpi.response.gm;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class GmRatingScaleLevelResponse {
    private String id;
    private String cycleId;
    private Integer sortOrder;
    private String levelCode;
    private String label;
    private BigDecimal minScore;
    private BigDecimal maxScore;
    private BigDecimal pitch;
    private String colorHex;
    private Boolean topTier;
}
