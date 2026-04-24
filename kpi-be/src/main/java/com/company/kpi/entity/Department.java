package com.company.kpi.entity;

import lombok.Data;
import java.util.UUID;

import com.company.kpi.entity.base.BaseEntity;

@Data
public class Department extends BaseEntity {
    private String name;
    private UUID managerId;
}
