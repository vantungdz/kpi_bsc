package com.company.kpi.entity;

import com.company.kpi.entity.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.OffsetDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
public class KpiCycle extends BaseEntity {
    private Integer year;
    private String name;
    private OffsetDateTime goalSettingStart;
    private OffsetDateTime goalSettingEnd;
    private OffsetDateTime midYearStart;
    private OffsetDateTime midYearEnd;
    private OffsetDateTime endYearStart;
    private OffsetDateTime endYearEnd;
    private String status;
    private Integer statusCode;
}
