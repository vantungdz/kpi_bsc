package com.company.kpi.response.reference;

import lombok.Data;

import java.util.UUID;

/** Một dòng {@code ranks} — checkbox «Assign To Ranks» (KPI individual). */
@Data
public class RankOptionResponse {

    private UUID id;
    private String code;
    private String name;
}
