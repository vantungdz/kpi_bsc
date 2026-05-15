package com.company.kpi.request.admin;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Đổi trạng thái kỳ KPI: 201 OPEN / 202 CLOSED (theo {@code sys_status_codes}).
 */
@Data
public class PatchAdminKpiCycleStatusRequest {

    @NotNull
    @Min(201)
    @Max(202)
    private Integer statusCode;
}
