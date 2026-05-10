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
        /** JSON quy tắc chấm điểm GM (`kpis_information.target_description`) — preview điểm trên FE. */
        private String targetDescriptionJson;
        private BigDecimal weight;
        private Integer statusCode;
        /** {@code kpi_master.calculation_rule_code} — 802 average / 803 comment, v.v. */
        private Integer calculationRuleCode;
        /** {@code kpi_master.calculation_type_code} — 701/702 hướng tỉ lệ khi rule = average */
        private Integer calculationTypeCode;
        /** {@code kpi_master.unit_code} — KPI_UNIT (901…908), hiển thị kèm cột Target. */
        private Integer unitCode;
        // Bổ sung Data của riêng PM
        private String actualResult; 
        /** Nội dung feedback active PM -> GM (kpi_assignment_feedbacks.feedback_note). */
        private String feedbackNote;
        private BigDecimal selfScore;
        private BigDecimal pmScore; // Điểm của PM (do GM đánh giá)
        private Boolean isTree;
        private Boolean expanded;
        private Boolean isSelfCreated;
        
        @Builder.Default
        private List<KpiChildDto> children = new ArrayList<>();
    }

    @Getter
    @Builder
    public static class KpiChildDto {
        private UUID id;            // assignment_id
        /** {@code users.id} — cần cho PM cascade / drawer giao việc. */
        private UUID userId;
        private String name;        // full_name
        private String role;        // job_title_name
        private BigDecimal targetValue; // assignment target
        private String actualResult;    // evidences
        /** Nội dung feedback active member -> PM (kpi_assignment_feedbacks.feedback_note). */
        private String feedbackNote;
        /** Role cần xử lý feedback member (PM / GM) — theo feedback active. */
        private String feedbackTargetRoleCode;
        private BigDecimal selfScore;   // end_self_score fallback mid_self_score
        private BigDecimal pmScore;     // end_pm_score
        private Integer statusCode;
    }
}