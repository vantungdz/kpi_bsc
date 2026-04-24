package com.company.kpi.aggregate;

import lombok.Data;

import java.util.UUID;

@Data
public class KpiTemplateEntityRow {
    private UUID id;
    private String name;
    private String description;
    private UUID jobFamilyId;
    private UUID rankId;
}

