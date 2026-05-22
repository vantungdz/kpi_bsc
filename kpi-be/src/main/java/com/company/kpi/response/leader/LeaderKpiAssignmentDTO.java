package com.company.kpi.response.leader;

import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
public class LeaderKpiAssignmentDTO {
    private UUID assignmentId;
    private UUID kpiInformationId;
    private String kpiName;
    private String kpiCode;
    /** Ưu tiên {@code kpi_assignments.target_value}, không có thì {@code kpis_information.target_value}. */
    private BigDecimal targetValue;
    private Integer unitCode;
    private String unitName;
    private String targetDescription;
    private Double weight;
    private Integer statusCode;
    private String statusName;
    private String statusDesc;
    // Mid-year: chỉ có self score theo init-db.sql schema
    private Double midSelfScore;
    // Final: đủ 3 cấp đánh giá
    private Double endSelfScore;
    private Double endPmScore;
    private Double endGmScore;
    private String evidences;
    /** Feedback tách riêng khỏi evidences JSON */
    private String feedbackComment;
    /** Lý do cập nhật / từ chối từ luồng PM/GM (kpi_assignments.update_reason). */
    private String updateReason;
    /** Assignment do chính user hiện tại tạo ra. */
    private Boolean createdByCurrentUser;
    /** Vai trò người tạo assignment (GM / PM / LEADER / MEMBER). */
    private String createdByRoleCode;
    /** Khi ASM 407: role cần xử lý feedback — PM hoặc GM. */
    private String feedbackTargetRoleCode;
    /** Trạng thái đánh giá FE (not_started/pending_approval/approved/overdue/feedback). */
    private String evaluationStatus;
    /** Nhãn hiển thị trạng thái đánh giá. */
    private String evaluationState;
    private UUID categoryId;
    private String categoryName;
    /** kpi_master.calculation_rule_code — 801 (none) | 802 (average/ratio) | 803 (comment/text) */
    private Integer calculationRuleCode;
    /** kpi_master.calculation_type_code — 701 (Actual/Plan×100%) | 702 (Plan/Actual×100%) */
    private Integer calculationTypeCode;
    /** kpi_master.type_code — join sys_status_codes (KPI_TYPE): 101 INDIVIDUAL, 102 TEAM, … */
    private Integer typeCode;
    /** Tên loại KPI từ {@code sys_status_codes.name} (cùng category KPI_TYPE). */
    private String typeName;
    /** {@code kpi_assignments.created_at} — đồng bộ nút submit với luồng member (onboard sau giữa kỳ). */
    private OffsetDateTime assignmentCreatedAt;
}
