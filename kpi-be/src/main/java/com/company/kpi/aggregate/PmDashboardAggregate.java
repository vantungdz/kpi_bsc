package com.company.kpi.aggregate;

import com.company.kpi.entity.*;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class PmDashboardAggregate {
    /** {@code roles.code} của user tạo {@code kpi_master} (cùng logic GM diagnostics). */
    private String kpiCreatorRoleCode;

    /**
     * ID của PM assignment — dùng làm root {@code <id>} trong MyBatis resultMap
     * để gom nhiều hàng JOIN (cascadeChildren) về cùng một PmDashboardAggregate.
     */
    private java.util.UUID pmAssignmentId;

    // Thông tin KPI gốc (Sở hữu bởi PM hoặc Phòng Ban)
    private KpiAssignment pmAssignment;
    /** Nội dung feedback active của PM gửi GM cho assignment cha. */
    private String pmFeedbackNote;
    private KpisInformation kpiInfo;
    private KpiMaster kpiMaster;
    private KpiCategory kpiCategory;

    /**
     * Các assignment cascade dưới pmAssignment — map bằng phần tử collection trong MyBatis
     * findPmPortfolioByPmIdAndCycleId để không gộp nhiều hàng JOIN thành một.
     */
    private List<PmPortfolioCascadeChildRow> cascadeChildren = new ArrayList<>();

    // Thông tin KPI Cascading (Sở hữu bởi Member)
    private KpiAssignment childAssignment;
    /** Nội dung feedback active của member gửi PM cho assignment con. */
    private String childFeedbackNote;
    /** Mã role của feedback active trên assignment con (PM / GM). */
    private String childFeedbackTargetRoleCode;
    private User childUser;
    private JobTitle childJobTitle;

    // Thông tin người sở hữu KPI cha (Dành cho tab KPI Department)
    private java.util.UUID parentUserId;
    private String parentUserName;
    private String parentJobTitleName;
}
