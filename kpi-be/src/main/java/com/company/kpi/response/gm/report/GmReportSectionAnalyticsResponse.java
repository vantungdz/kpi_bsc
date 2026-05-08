package com.company.kpi.response.gm.report;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/** Section analytics: avg điểm theo phòng + radar theo kpi_categories. */
@Data
public class GmReportSectionAnalyticsResponse {

    private List<SectionScore> sectionAverages;
    private RadarPayload radar;

    @Data
    public static class SectionScore {
        private String sectionId;
        private String sectionName;
        private BigDecimal averageScore;
    }

    @Data
    public static class RadarPayload {
        /** Tên các KPI category được dùng làm trục radar. */
        private List<String> dimensions;
        /** Mỗi series là 1 phòng — mặc định trả về best & worst section. */
        private List<RadarSeries> series;
    }

    @Data
    public static class RadarSeries {
        private String sectionId;
        private String sectionName;
        /** Số liệu theo từng dimension (cùng độ dài với `dimensions`). */
        private List<BigDecimal> data;
    }
}
