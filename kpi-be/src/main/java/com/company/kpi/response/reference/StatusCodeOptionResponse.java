package com.company.kpi.response.reference;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/** Một dòng {@code sys_status_codes} (theo category) — dùng cho CALC_TYPE / CALC_RULE. */
@Data
public class StatusCodeOptionResponse {

    private Integer code;

    @JsonProperty("value")
    private String formValue;

    /** Nhãn = cột {@code name} (đồng bộ yêu cầu UI). */
    private String label;
}
