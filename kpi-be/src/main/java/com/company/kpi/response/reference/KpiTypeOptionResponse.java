package com.company.kpi.response.reference;

import lombok.Data;

/** Một dòng {@code sys_status_codes} nhóm {@code KPI_TYPE} — chọn loại hình KPI khi tạo strategic. */
@Data
public class KpiTypeOptionResponse {

    private Integer code;
    private String name;
    private String description;
}
