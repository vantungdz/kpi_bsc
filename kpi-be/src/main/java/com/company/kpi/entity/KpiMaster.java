package com.company.kpi.entity;

import lombok.Data;
import java.util.UUID;

import com.company.kpi.entity.base.BaseEntity;

@Data
public class KpiMaster extends BaseEntity {
    private String code;
    private String name;
    private UUID categoryId;
    private Integer typeCode;
    private Integer calculationRuleCode;
    private Integer calculationTypeCode;
    private Integer unitCode;
    private Boolean isGlobal;
}