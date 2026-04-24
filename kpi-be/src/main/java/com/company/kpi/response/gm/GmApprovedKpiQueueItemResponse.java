package com.company.kpi.response.gm;

import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

/** Một dòng KPI cá nhân trong chu kỳ — ASM 401/402/403 (tab Approved KPI GM). */
@Data
public class GmApprovedKpiQueueItemResponse {

    private UUID assignmentId;
    private UUID cycleId;
    private Integer statusCode;
    private String statusName;
    private String statusDescription;
    private UUID userId;
    private String userFullName;
    private String userUsername;
    private String masterCode;
    private String masterName;
    private String targetDescription;
    private BigDecimal weight;
    private Boolean important;
    private String categoryName;
    /** {@code sys_status_codes.code} KPI_TYPE — 101 INDIVIDUAL, 102 TEAM, 103 PROMOTION. */
    private Integer typeCode;
}
