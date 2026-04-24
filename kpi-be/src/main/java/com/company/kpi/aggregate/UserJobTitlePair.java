package com.company.kpi.aggregate;

import lombok.Data;

import java.util.UUID;

@Data
public class UserJobTitlePair {
    private UUID userId;
    private UUID jobTitleId;
}

