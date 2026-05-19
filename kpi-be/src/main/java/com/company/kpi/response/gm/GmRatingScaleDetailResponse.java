package com.company.kpi.response.gm;

import lombok.Data;

import java.util.List;

@Data
public class GmRatingScaleDetailResponse {
    private String cycleId;
    private Integer year;
    private String name;
    private Integer statusCode;
    private Boolean editable;
    /** true khi chu kỳ đã có ít nhất một mức điểm. */
    private Boolean hasScale;
    private List<GmRatingScaleLevelResponse> levels;
}
