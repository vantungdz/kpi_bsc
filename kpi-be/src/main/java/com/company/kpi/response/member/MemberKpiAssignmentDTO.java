package com.company.kpi.response.member;

import lombok.Data;

import java.util.UUID;

@Data
public class MemberKpiAssignmentDTO {
    private UUID assignmentId;
    private String objective;
    private String targetDescription;
    private Double weight;
    private String type;
    /** Mid-year: chỉ có self score theo init-db.sql schema */
    private Double midSelfScore;
    /** Final: đủ 3 cấp đánh giá */
    private Double endSelfScore;
    private Double endPmScore;
    private String evidences;
    private UUID categoryId;
    private String categoryName;
}
