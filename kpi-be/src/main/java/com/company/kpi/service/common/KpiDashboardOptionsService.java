package com.company.kpi.service.common;

import com.company.kpi.mapper.DepartmentMapper;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.response.common.KpiDashboardOptionsResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class KpiDashboardOptionsService {

    private final KpiAssignmentMapper kpiAssignmentMapper;
    private final DepartmentMapper departmentMapper;

    public KpiDashboardOptionsResponse getOptionsForUser(UUID userId) {
        List<Integer> years = kpiAssignmentMapper.listDistinctAssignmentYearsForUser(userId);
        int deptCount = departmentMapper.countDepartmentsForUser(userId);
        return KpiDashboardOptionsResponse.builder()
                .yearsWithAssignments(years)
                .hasOrgMembership(deptCount > 0)
                .build();
    }
}
