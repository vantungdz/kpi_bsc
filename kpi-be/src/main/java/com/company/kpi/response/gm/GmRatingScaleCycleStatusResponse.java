package com.company.kpi.response.gm;

import lombok.Data;

@Data
public class GmRatingScaleCycleStatusResponse {
    private String cycleId;
    private Integer year;
    private String name;
    private Integer statusCode;
    private Boolean editable;
}
