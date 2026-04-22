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
    private OffsetDateTime goalSettingDeadline;
    private OffsetDateTime midYearDeadline;
    private OffsetDateTime endYearDeadline;
    private String status;
}
