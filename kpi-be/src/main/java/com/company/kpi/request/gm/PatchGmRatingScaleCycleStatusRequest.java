package com.company.kpi.request.gm;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/** Đổi trạng thái chu kỳ KPI: 201 OPEN / 202 CLOSED (đồng bộ toàn hệ thống). */
@Data
public class PatchGmRatingScaleCycleStatusRequest {

    @NotNull
    @Min(201)
    @Max(202)
    private Integer statusCode;
}
