package com.company.kpi.entity;

import com.company.kpi.entity.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
public class KpiPeriod extends BaseEntity {

    private Integer year;
    /** TARGET_SETUP | MID_YEAR | YEAR_END */
    private String currentPhase;
    private LocalDate targetSetupDeadline;
    private LocalDate midYearDeadline;
    private LocalDate yearEndDeadline;
    private Boolean isActive;
}
