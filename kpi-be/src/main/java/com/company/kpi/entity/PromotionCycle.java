package com.company.kpi.entity;

import com.company.kpi.entity.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@EqualsAndHashCode(callSuper = true)
public class PromotionCycle extends BaseEntity {
    private UUID userId;
    private String name;
    private OffsetDateTime startDate;
    private OffsetDateTime endDate;
    private Integer durationMonths;
    private Integer statusCode;
}
