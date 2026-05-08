package com.company.kpi.response.pm;

import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Một dòng đề xuất KPI cá nhân (ASM 402) trong tab PM Request Approval. */
@Data
public class PmMemberKpiApprovalItemResponse {

    private UUID assignmentId;
    private UUID cycleId;
    private UUID userId;
    private String userFullName;
    /**
     * Các {@code roles.code} của user (qua {@code user_roles}), nối bằng {@code |||} để FE tách tag —
     * thứ tự GM → PM → LEADER → MEMBER.
     */
    private String userRoleCodes;
    private String kpiName;
    /** Nội dung đầy đủ từ {@code kpis_information.target_description}. */
    private String targetDescription;
    /** Target được giao cho assignment của member (ưu tiên hiển thị ở PM review). */
    private BigDecimal targetValue;
    private BigDecimal weight;
    private String categoryName;
    private Integer unitCode;
    private Integer calculationRuleCode;
    private Integer calculationTypeCode;
    private Integer typeCode;
    private OffsetDateTime requestedAt;
    /** Phần mô tả member (bỏ dòng tên KPI và dòng Unit) — hiển thị cột Reason. */
    private String justification;
}
