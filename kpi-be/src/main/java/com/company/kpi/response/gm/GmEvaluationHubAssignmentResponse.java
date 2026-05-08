package com.company.kpi.response.gm;

import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Một dòng {@code kpi_assignments} trong hub đánh giá GM — ASM 501/502/503/601/602/603.
 */
@Data
public class GmEvaluationHubAssignmentResponse {

    private UUID assignmentId;
    private Integer statusCode;
    private String assignmentStatusName;
    /** {@code sys_status_codes.description} — hiển thị cột Tiến độ. */
    private String assignmentStatusDescription;
    private BigDecimal midSelfScore;
    private BigDecimal endSelfScore;
    private BigDecimal endPmScore;
    private BigDecimal endGmScore;
    private String evidences;
    private String targetDescription;
    private BigDecimal weight;
    private String masterCode;
    private String masterName;
    private String categoryName;
    private String kpiTypeName;
    private UUID userId;
    private String userFullName;
    private String userUsername;
    private String rankCode;
    private UUID assigneeSupervisorId;
    private String assigneeSupervisorFullName;
    private UUID sectionId;
    private String sectionName;
    private UUID sectionManagerId;
    private String sectionManagerFullName;
    private String memberRoleCode;
    private String memberRoleName;
    /** Nhận xét PM tổng để GM tham chiếu/chỉnh sửa tại ô Supervisor Comment. */
    private String supervisorComment;
}
