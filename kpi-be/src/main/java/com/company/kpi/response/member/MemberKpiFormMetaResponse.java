package com.company.kpi.response.member;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Meta cho form tạo KPI cá nhân: {@code kpi_categories} + {@code sys_status_codes} (CALC_RULE 801–804).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MemberKpiFormMetaResponse {
    private UUID cycleId;
    private Integer cycleYear;
    private List<KpiCategoryOption> kpiCategories;
    private List<CalcRuleOption> calcRules;
}
