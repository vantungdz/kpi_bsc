package com.company.kpi.response.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Meta cho dropdown năm và nút tạo KPI cá nhân trên Member / Leader dashboard.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class KpiDashboardOptionsResponse {

    /** Các năm chu kỳ mà user có ít nhất một {@code kpi_assignments} (mọi loại KPI). */
    private List<Integer> yearsWithAssignments;

    /** User có ít nhất một dòng {@code user_departments} (phòng ban / section). */
    private boolean hasOrgMembership;
}
