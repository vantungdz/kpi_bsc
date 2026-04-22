package com.company.kpi.response.gm;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class KpiSectionMemberResponse {

    private String id;
    private String name;
    private String rank;
    private String targetStatus;
    private String midYearStatus;
    private String finalStatus;
    private BigDecimal score;
}
