package com.company.kpi.aggregate.report;

import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Một dòng KPI assignment được dùng cho các báo cáo GM.
 * Score đã được {@code SensitiveDataMybatisInterceptor} giải mã trước khi service xử lý.
 */
@Data
public class GmReportAssignmentRow {
    private UUID assignmentId;
    private UUID userId;
    private String userFullName;
    private String userRoleCode;
    private UUID sectionId;
    private String sectionName;
    private UUID categoryId;
    private String categoryName;
    private Integer year;
    private Integer statusCode;
    private BigDecimal evidenceFlag;

    private BigDecimal midSelfScore;
    private BigDecimal endSelfScore;
    private BigDecimal endPmScore;
    private BigDecimal endGmScore;
}
