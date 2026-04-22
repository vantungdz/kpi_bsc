package com.company.kpi.entity;

import com.company.kpi.entity.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@EqualsAndHashCode(callSuper = true)
public class KpiItem extends BaseEntity {

    private UUID kpiSheetId;
    private String code;
    private String name;
    private String description;
    private String target;
    private BigDecimal weight;
    /** A | B | C */
    private String itemGroup;
    /** SUBMITTED | MISSING | PENDING */
    private String evidenceStatus;
    private String evidenceNote;
    private Integer selfScore;
    private Integer pmScore;
    private Integer leaderScore;
}
