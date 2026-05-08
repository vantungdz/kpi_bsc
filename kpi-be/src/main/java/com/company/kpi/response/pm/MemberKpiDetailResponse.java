package com.company.kpi.response.pm;

import lombok.Data;
import java.math.BigDecimal;
import java.util.UUID;

@Data
public class MemberKpiDetailResponse {
    private UUID id;
    private String group;
    private String code;
    private String name;
    private String target;
    private BigDecimal weight;
    private BigDecimal selfScore;
    private BigDecimal pmScore;
    private String pmComment;
    private Integer statusCode;
    private Integer kpiTypeCode;
    private Integer calcRuleCode;
    private String evidences;
}