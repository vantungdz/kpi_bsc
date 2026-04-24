package com.company.kpi.response.leader;

import lombok.Data;

import java.util.UUID;

@Data
public class LeaderKpiAssignmentDTO {
    private UUID assignmentId;
    private String kpiName;
    private String kpiCode;
    private String targetDescription;
    private Double weight;
    private String statusCode;
    private String statusDesc;
    // Mid-year: chỉ có self score theo init-db.sql schema
    private Double midSelfScore;
    // Final: đủ 3 cấp đánh giá
    private Double endSelfScore;
    private Double endPmScore;
    private String evidences;
    private UUID categoryId;
    private String categoryName;
}
