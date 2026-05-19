package com.company.kpi.response.member;

import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
public class MemberKpiAssignmentDTO {
    private UUID assignmentId;
    private UUID kpiInformationId;
    private UUID cycleId;
    private String masterCode;
    private String masterName;
    private String objective;
    private String targetDescription;
    private Double weight;
    /** KPI_TYPE name from sys_status_codes e.g. INDIVIDUAL / PROMOTION */
    private String type;
    private Integer typeCode;
    private Integer unitCode;
    private String unitName;
    private Integer statusCode;
    private Double kpiInfoTargetValue;
    private Double assignmentTargetValue;
    /** Mid-year: chỉ có self score theo init-db.sql schema */
    private Double midSelfScore;
    /** Final: đủ 3 cấp đánh giá */
    private Double endSelfScore;
    private Double endPmScore;
    private Double endGmScore;
    /** JSON string (JSONB column) */
    private String evidences;
    /** Feedback tách riêng khỏi evidences JSON */
    private String feedbackComment;
    /** Lý do cập nhật / từ chối từ luồng PM/GM (kpi_assignments.update_reason). */
    private String updateReason;
    /** Assignment do chính user hiện tại tạo ra. */
    private Boolean createdByCurrentUser;
    /** Vai trò người tạo assignment (GM / PM / LEADER / MEMBER). */
    private String createdByRoleCode;
    /** Mã role đang xử lý feedback active — PM hoặc GM (roles.code). */
    private String feedbackTargetRoleCode;
    /** {@code kpi_master.calculation_rule_code} — CALC_RULE 801–804 */
    private Integer calculationRuleCode;
    /** {@code kpi_master.calculation_type_code} — CALC_TYPE 701 (Actual/Plan) | 702 (Plan/Actual) */
    private Integer calculationTypeCode;
    private UUID categoryId;
    private String categoryName;
    /** {@code kpi_assignments.created_at} — dùng để phân nhánh onboard sau giữa kỳ (bỏ nộp 1H). */
    private OffsetDateTime assignmentCreatedAt;
    private String inactiveReason;
    private Boolean excludedFromRollup;
}
