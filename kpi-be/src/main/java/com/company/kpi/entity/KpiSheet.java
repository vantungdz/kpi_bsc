package com.company.kpi.entity;

import com.company.kpi.entity.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@EqualsAndHashCode(callSuper = true)
public class KpiSheet extends BaseEntity {

    private UUID userId;
    private UUID kpiPeriodId;
    private Integer year;
    /** TARGET_SETUP | MID_YEAR | YEAR_END */
    private String phase;
    private BigDecimal totalWeight;
    /** DRAFT | SUBMITTED | APPROVED | REJECTED */
    private String status;
    private String submittedAt;
    private String approvedAt;
    private UUID approvedBy;
}
