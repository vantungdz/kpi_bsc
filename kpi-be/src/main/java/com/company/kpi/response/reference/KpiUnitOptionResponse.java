package com.company.kpi.response.reference;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/**
 * Một dòng {@code sys_status_codes} nhóm {@code KPI_UNIT} — dropdown đơn vị KPI.
 */
@Data
public class KpiUnitOptionResponse {

    /** Mã {@code sys_status_codes.code} (901–908). */
    private Integer unitCode;

    /** Giá trị select trên form (UPPER(name), ví dụ {@code MM}, {@code PERCENT}). */
    @JsonProperty("value")
    private String formValue;

    /** Nhãn hiển thị — cột {@code name} trong {@code sys_status_codes}. */
    private String label;
}
