package com.company.kpi.response.pm;

import lombok.Data;
import java.math.BigDecimal;
import java.util.UUID;

@Data
public class MemberKpiDetailResponse {
    private UUID id;
    private String group;
    private String code;
    private String name;
    private String target;
    private BigDecimal weight;
    private BigDecimal selfScore;
    /** Điểm hiển thị: {@code end_gm_score} nếu có, ngược lại {@code end_pm_score}. */
    private BigDecimal pmScore;
    /** Điểm PM chấm (cuối kỳ) — giữ nguyên sau khi GM chấm. */
    private BigDecimal endPmScore;
    /** Điểm GM chấm lại (cuối kỳ). */
    private BigDecimal endGmScore;
    /** true khi cả hai điểm có và khác nhau (GM đã sửa so với PM). */
    private Boolean gmScoreChanged;
    private String pmComment;
    private Integer statusCode;
    /** {@code sys_status_codes.name} (ASM_STATUS). */
    private String statusName;
    /** {@code sys_status_codes.description} (ASM_STATUS). */
    private String statusDesc;
    private Integer kpiTypeCode;
    /** 801/802/803 — quy tắc tổng hợp (tổng / TB / comment); FE dùng cho layout evidence & mode gộp Actual. */
    private Integer calcRuleCode;
    /** 701 Actual/Plan, 702 Plan/Actual — chiều công thức tỷ lệ %; dùng cùng calcRuleCode, không thay thế. */
    private Integer calculationTypeCode;
    private Integer unitCode;
    private String unitName;
    private String evidences;
    /**
     * Team KPI (102): trạng thái assignment PM cha — FE khóa duyệt kết quả member khi 404/406.
     */
    private Integer teamPmParentStatusCode;
    /** {@code roles.code} của người tạo KPI master. */
    private String creatorRoleCode;
}
