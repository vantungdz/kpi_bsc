package com.company.kpi.response.reference;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Một CALC_RULE (dropdown) kèm các CALC_TYPE được phép (radio).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CalcRuleWithTypesResponse {

    private Integer code;

    @JsonProperty("value")
    private String formValue;

    private String label;

    private List<StatusCodeOptionResponse> calcTypes;
}
