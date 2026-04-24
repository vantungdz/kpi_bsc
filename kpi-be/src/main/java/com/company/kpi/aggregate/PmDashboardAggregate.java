package com.company.kpi.aggregate;

import com.company.kpi.entity.*;
import lombok.Data;

@Data
public class PmDashboardAggregate {
    // Thông tin KPI gốc (Sở hữu bởi PM hoặc Phòng Ban)
    private KpiAssignment pmAssignment;
    private KpisInformation kpiInfo;
    private KpiMaster kpiMaster;
    private KpiCategory kpiCategory;
    
    // Thông tin KPI Cascading (Sở hữu bởi Member)
    private KpiAssignment childAssignment;
    private User childUser;
    private JobTitle childJobTitle;
}
