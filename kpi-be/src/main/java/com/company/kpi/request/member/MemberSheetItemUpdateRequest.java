package com.company.kpi.request.member;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

/**
 * Cập nhật một dòng KPI assignment: điểm tự đánh giá (theo phase) + JSON evidences (JSONB).
 */
@Data
public class MemberSheetItemUpdateRequest {

    @Min(1)
    @Max(5)
    private Integer selfScore;

    /** Chuỗi JSON hợp lệ — ghi vào kpi_assignments.evidences */
    private String evidences;
}
