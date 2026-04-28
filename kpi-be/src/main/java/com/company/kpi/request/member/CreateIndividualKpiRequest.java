package com.company.kpi.request.member;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

/**
 * README Flow 3: Member đề xuất KPI — {@code kpi_master.category_id} từ {@code kpi_categories},
 * {@code calculation_rule_code} từ {@code sys_status_codes} (CALC_RULE 801–804).
 */
@Data
public class CreateIndividualKpiRequest {

    @NotNull
    private Integer cycleYear;

    @NotBlank
    private String kpiName;

    /** Mô tả ngắn — ghép vào target_description */
    private String description;

    /** Trọng số trên sheet (vd 15.0) */
    @NotNull
    @Min(0)
    @Max(100)
    private Double weight;

    /** Perspective BSC — FK {@code kpi_categories.id} */
    @NotNull
    private UUID categoryId;

    /** CALC_RULE: 801 SUM, 802 AVERAGE, 803 COMMENT, 804 WEIGHTED_AVG */
    @NotNull
    @Min(801)
    @Max(804)
    private Integer calculationRuleCode;

    /**
     * CALC_TYPE: 701 ACTUAL_OVER_PLAN, 702 PLAN_OVER_ACTUAL.
     * Null khi CALC_RULE = 803 (COMMENT) — không cần chiều tính.
     */
    @Min(701)
    @Max(702)
    private Integer calculationTypeCode;
}
