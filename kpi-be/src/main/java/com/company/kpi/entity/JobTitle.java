package com.company.kpi.entity;

import lombok.Data;
import java.util.UUID;

import com.company.kpi.entity.base.BaseEntity;

@Data
public class JobTitle extends BaseEntity {
    private UUID jobFamilyId;
    private UUID rankId;
    private String name;
}
