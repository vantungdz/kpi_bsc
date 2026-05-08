package com.company.kpi.response.gm.report;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/** Bell curve theo từng section + summary (best/worst section, avg). */
@Data
public class GmReportSectionBellCurveResponse {

    private List<String> levelLabels;
    private List<SectionSeries> sections;
    private Summary summary;

    @Data
    public static class SectionSeries {
        /** "all" | uuid của department. */
        private String id;
        private String label;
        /** Counts có cùng độ dài với `levelLabels`. */
        private List<Integer> counts;
    }

    @Data
    public static class Summary {
        private BigDecimal avgCompany;
        private String bestSectionName;
        private String worstSectionName;
        private Integer topGroupCount;
        private BigDecimal topGroupPercent;
        private Integer totalCount;
    }
}
