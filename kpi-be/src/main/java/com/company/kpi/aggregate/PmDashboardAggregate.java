package com.company.kpi.aggregate;

import com.company.kpi.entity.*;
import lombok.Data;

@Data
public class PmDashboardAggregate {
    // Thông tin KPI gốc (Sở hữu bởi PM hoặc Phòng Ban)
    private KpiAssignment pmAssignment;
    /** Nội dung feedback active của PM gửi GM cho assignment cha. */
    private String pmFeedbackNote;
    private KpisInformation kpiInfo;
    private KpiMaster kpiMaster;
    private KpiCategory kpiCategory;
    
    // Thông tin KPI Cascading (Sở hữu bởi Member)
    private KpiAssignment childAssignment;
    /** Nội dung feedback active của member gửi PM cho assignment con. */
    private String childFeedbackNote;
    private User childUser;
    private JobTitle childJobTitle;
}
