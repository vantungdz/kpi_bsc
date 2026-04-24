package com.company.kpi.aggregate.pm;
import com.company.kpi.entity.KpiAssignment;
import com.company.kpi.entity.User;
import lombok.Data;
import java.util.List;

@Data
public class PmDashboardAggregate {
    // Acts as a projection to combine a member and their assignments
    private User member;
    private List<KpiAssignment> assignments;
}