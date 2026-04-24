package com.company.kpi.response.reference;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KpiCalculationReferenceResponse {

    /** Mỗi phần tử = một CALC_RULE (dropdown) + {@code calcTypes} = CALC_TYPE hợp lệ (radio). */
    private List<CalcRuleWithTypesResponse> calcRulesWithTypes;
}
