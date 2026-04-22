package com.company.kpi.entity.base;

import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
public abstract class BaseEntity {

    private UUID id;
    private UUID createdBy;
    private OffsetDateTime createdAt;
    private UUID updatedBy;
    private OffsetDateTime updatedAt;
}
