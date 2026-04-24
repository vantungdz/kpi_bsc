package com.company.kpi.response.member;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CalcRuleOption {
    private Integer code;
    private String name;
    private String description;
}
