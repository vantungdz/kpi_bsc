package com.company.kpi.request.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

/**
 * Cập nhật một giai đoạn trong {@code kpi_cycles}: thiết lập mục tiêu / 1H / 2H.
 */
@Data
public class UpdateAdminKpiCyclePhaseDatesRequest {

    @NotBlank
    @Pattern(regexp = "goal_setting|mid_year|end_year")
    private String phase;

    @NotBlank
    @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}")
    private String startDate;

    @NotBlank
    @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}")
    private String endDate;
}
