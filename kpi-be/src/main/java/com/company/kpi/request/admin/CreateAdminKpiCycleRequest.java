package com.company.kpi.request.admin;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Khởi tạo chu kỳ KPI mới (Admin) — ngày theo định dạng {@code yyyy-MM-dd}.
 */
@Data
public class CreateAdminKpiCycleRequest {

    @NotNull
    @Min(2000)
    @Max(2100)
    private Integer year;

    @NotBlank
    @Size(max = 100)
    private String name;

    @NotBlank
    @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}")
    private String goalSettingStartDate;

    @NotBlank
    @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}")
    private String goalSettingEndDate;

    @NotBlank
    @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}")
    private String midYearStartDate;

    @NotBlank
    @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}")
    private String midYearEndDate;

    @NotBlank
    @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}")
    private String endYearStartDate;

    @NotBlank
    @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}")
    private String endYearEndDate;

    /** Nếu true: đóng (202) mọi chu kỳ đang OPEN (201) trước khi tạo năm mới. */
    private Boolean activateImmediately;
}
