package com.company.kpi.response.common;


import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class KpiCycleResponse {
    private UUID id;
    private Integer year;
    private String name;
    private OffsetDateTime goalSettingStart;
    private OffsetDateTime goalSettingEnd;
    private OffsetDateTime midYearStart;
    private OffsetDateTime midYearEnd;
    private OffsetDateTime endYearStart;
    private OffsetDateTime endYearEnd;
    private String activePhase;
}
