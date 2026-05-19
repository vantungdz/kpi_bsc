package com.company.kpi.response.gm.report;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/** Phân bố Performance Level theo các năm so sánh + tổng quan kỳ năm hiện tại. */
@Data
public class GmReportLevelDistributionResponse {

    /** Định nghĩa các mức — từ khung điểm DB của {@link #scaleYear}. */
    private List<LevelDef> levels;
    /** Năm chu kỳ dùng làm nguồn khung mức (mới nhất trong các năm được chọn). */
    private Integer scaleYear;
    /** Map year → counts theo thứ tự `levels`. */
    private List<YearSeries> years;
    /** Top performer (level O1/A1/A2) năm chính. */
    private List<TopPerformer> topPerformers;
    /** Tổng số nhân sự có điểm năm chính. */
    private Integer totalCount;

    @Data
    public static class LevelDef {
        private String code;
        private String label;
        private BigDecimal min;
        private BigDecimal max;
        /** Bậc (Pitch) hiển thị bên trái mỗi mức. */
        private BigDecimal pitch;
    }

    @Data
    public static class YearSeries {
        private Integer year;
        private List<Integer> counts;
    }

    @Data
    public static class TopPerformer {
        private String userId;
        private String fullName;
        private String roleCode;
        private String sectionName;
        private String levelCode;
        private BigDecimal score;
    }
}
