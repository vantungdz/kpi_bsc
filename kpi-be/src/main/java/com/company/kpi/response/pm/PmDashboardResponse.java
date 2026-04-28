package com.company.kpi.response.pm;

import lombok.Builder;
import lombok.Getter;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.company.kpi.response.common.KpiCycleResponse;

@Getter
@Builder
public class PmDashboardResponse {
    
    @Builder.Default
    private List<KpiGroupDto> kpis = new ArrayList<>();

    @Builder.Default
    private KpiCycleResponse kpiCycle = null;
    @Getter
    @Builder
    public static class KpiGroupDto {
        private UUID id;            // asm_id
        private UUID infoId;        // info_id
        private String group;       // category_name
        private String code;        // master_code
        private String name;        // master_name
        private Integer kpiType;    // type_code
        private Boolean isImportant; 
        private String target;      // target_description
        private BigDecimal weight;
        private Integer statusCode;
        // Bổ sung Data của riêng PM
        private String actualResult; 
        private BigDecimal selfScore;
        private BigDecimal pmScore; // Điểm của PM (do GM đánh giá)
        private Boolean isTree;
        private Boolean expanded;
        
        @Builder.Default
        private List<KpiChildDto> children = new ArrayList<>();
    }

    @Getter
    @Builder
    public static class KpiChildDto {
        private UUID id;            // assignment_id
        private String name;        // full_name
        private String role;        // job_title_name
        private BigDecimal targetValue; // assignment target
        private String actualResult;    // evidences
        private BigDecimal selfScore;   // end_self_score fallback mid_self_score
        private BigDecimal pmScore;     // end_pm_score
        private Integer statusCode;
    }
}