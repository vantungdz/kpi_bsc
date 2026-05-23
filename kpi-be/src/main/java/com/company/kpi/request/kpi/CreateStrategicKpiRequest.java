package com.company.kpi.request.kpi;

import com.company.kpi.dto.kpi.KpiScoringRulesPayload;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.DecimalMin;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Body tạo KPI chiến lược (GM) — đồng bộ payload emit từ {@code GmCreateStrategicKpiModal.vue}.
 */
@Data
public class CreateStrategicKpiRequest {

    private UUID cycleId;

    /** {@code sys_status_codes} KPI_TYPE: 101 INDIVIDUAL, 102 TEAM (cascading), 103 PROMOTION. */
    @NotNull
    private Integer typeCode;

    /** UUID {@code kpi_categories.id} (field legacy trên FE: {@code perspective}). */
    @NotNull
    private UUID perspective;

    @NotBlank
    @Size(max = 255)
    private String kpiName;

    /** Quy tắc chấm điểm (JSON) — lưu vào {@code kpis_information.target_description} (JSONB). */
    private KpiScoringRulesPayload targetDescription;

    /**
     * Giá trị mục tiêu số — lưu vào {@code kpis_information.target_value} / assignment.
     * JSON nên gửi kiểu số (vd. {@code 95}, {@code 95.5}); có thể {@code null} (vd. KPI không có target số trên form).
     */
    @DecimalMin(value = "0", inclusive = false, message = "targetValue must be greater than 0")
    private BigDecimal targetValue;

    @NotNull
    private Integer unitCode;

    /** Trọng số (JSON number hoặc chuỗi số; % được bỏ qua nếu gửi dạng chuỗi). */
    @NotNull
    private BigDecimal weightPct;

    /**
     * Chuỗi persisted đồng bộ FE {@code kpiCalculationCodes}:
     * {@code manual_member_input}, {@code mean_actual_plan}, {@code mean_plan_actual},
     * {@code mean_plan_actual_pct}, {@code mean_plan_actual_sum}.
     */
    @NotBlank
    private String calculationMethod;

    private Boolean isImportant;

    /**
     * Khi {@code true}: người nhận assignment có thể sửa {@code target_value} và {@code scoring_scale}
     * trên dòng assignment của họ (không ảnh hưởng assignment khác).
     */
    private Boolean allowAssigneeTargetScaleEdit;

    /** TEAM / cascading: chỉ các user id này nhận {@code kpi_assignments} (GM chọn PM; không mở rộng theo org). */
    private List<UUID> assignPMs;

    /**
     * TEAM: mục tiêu theo từng {@code assignPMs} (key = UUID user dạng chuỗi). Giá trị JSON có thể là số hoặc chuỗi số.
     * User không có trong map (hoặc giá trị rỗng) → dùng {@link #targetValue} cho dòng {@code kpi_assignments} tương ứng.
     */
    private Map<String, Object> pmTargets;

    /** INDIVIDUAL / PROMOTION: danh sách member nhận KPI. */
    private List<UUID> memberIds;

    /** Tùy chọn — cập nhật KPI đã có (khi FE gửi id thật từ DB). */
    private UUID editingKpiInformationId;
}
