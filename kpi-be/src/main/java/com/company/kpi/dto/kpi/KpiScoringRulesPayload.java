package com.company.kpi.dto.kpi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * KPI scoring rules stored in {@code kpis_information.target_description} (JSONB).
 * GM authoring: {@code rawInput} is the textarea DSL; {@code rules} is normalized.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class KpiScoringRulesPayload {

    private String rawInput;

    @Builder.Default
    private List<Map<String, Object>> rules = new ArrayList<>();

    public static KpiScoringRulesPayload empty() {
        return KpiScoringRulesPayload.builder()
                .rawInput("")
                .rules(new ArrayList<>())
                .build();
    }

    public static KpiScoringRulesPayload ofRawAndRules(String raw, List<Map<String, Object>> rules) {
        List<Map<String, Object>> copy = new ArrayList<>();
        if (rules != null) {
            for (Map<String, Object> r : rules) {
                copy.add(new LinkedHashMap<>(r));
            }
        }
        return KpiScoringRulesPayload.builder()
                .rawInput(raw != null ? raw : "")
                .rules(copy)
                .build();
    }
}
