package com.company.kpi.response.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminKpiCycleResponse {

    private UUID id;
    private Integer year;
    private String name;
    private OffsetDateTime goalSettingStart;
    private OffsetDateTime goalSettingEnd;
    private OffsetDateTime midYearStart;
    private OffsetDateTime midYearEnd;
    private OffsetDateTime endYearStart;
    private OffsetDateTime endYearEnd;
    /** {@code sys_status_codes}: 201 OPEN, 202 CLOSED */
    private Integer statusCode;
}
