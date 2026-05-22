package com.company.kpi.response.gm;

import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Một dòng KPI cá nhân trong chu kỳ — ASM 401/402/403 trên tab Approved KPI GM. */
@Data
public class GmApprovedKpiQueueItemResponse {

    private UUID assignmentId;
    private UUID cycleId;
    private Integer statusCode;
    private String statusName;
    private String statusDescription;
    private UUID userId;
    private String userFullName;
    private String userUsername;
    /**
     * {@code roles.code} của assignee (user_roles), nối {@code |||} — thứ tự GM → PM → LEADER → MEMBER.
     */
    private String userRoleCodes;
    /** Thời điểm tạo bản ghi assignment được chọn (DISTINCT ON). */
    private OffsetDateTime requestedAt;
    private String masterCode;
    private String masterName;
    /** Target value số ưu tiên từ assignment, fallback về target chu kỳ. */
    private BigDecimal targetValue;
    private String targetDescription;
    private BigDecimal weight;
    private Boolean important;
    private String categoryName;
    /** {@code sys_status_codes.code} KPI_TYPE — 101 INDIVIDUAL, 102 TEAM, 103 PROMOTION. */
    private Integer typeCode;
    /** {@code kpi_master.unit_code} của KPI. */
    private Integer unitCode;
    /** Legacy field: queue không còn hiển thị 407; giữ để tương thích response cũ. */
    private String feedbackNote;
    /** {@code roles.code} của người tạo KPI master ({@code kpi_master.created_by}). */
    private String creatorRoleCode;
}
