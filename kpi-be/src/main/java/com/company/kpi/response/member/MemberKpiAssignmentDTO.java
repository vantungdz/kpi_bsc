package com.company.kpi.response.member;

import lombok.Data;

import java.util.UUID;

@Data
public class MemberKpiAssignmentDTO {
    private UUID assignmentId;
    private UUID cycleId;
    private String masterCode;
    private String masterName;
    private String objective;
    private String targetDescription;
    private Double weight;
    /** KPI_TYPE name from sys_status_codes e.g. INDIVIDUAL / PROMOTION */
    private String type;
    private Integer typeCode;
    private Integer statusCode;
    private Double kpiInfoTargetValue;
    private Double assignmentTargetValue;
    /** Mid-year: chỉ có self score theo init-db.sql schema */
    private Double midSelfScore;
    /** Final: đủ 3 cấp đánh giá */
    private Double endSelfScore;
    private Double endPmScore;
    /** JSON string (JSONB column) */
    private String evidences;
    /** {@code kpi_master.calculation_rule_code} — CALC_RULE 801–804 */
    private Integer calculationRuleCode;
    /** {@code kpi_master.calculation_type_code} — CALC_TYPE 701 (Actual/Plan) | 702 (Plan/Actual) */
    private Integer calculationTypeCode;
    private UUID categoryId;
    private String categoryName;
}
