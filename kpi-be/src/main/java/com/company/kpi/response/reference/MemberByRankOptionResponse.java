package com.company.kpi.response.reference;

import lombok.Data;

import java.util.UUID;

/** User active + phòng ban / cấp bậc — KPI individual (theo rank) hoặc KPI Promotion (toàn bộ). */
@Data
public class MemberByRankOptionResponse {

    private UUID id;
    private String username;
    private String email;
    private String fullName;
    /** Mã cấp bậc ({@code ranks.code}), khớp tham số truy vấn. */
    private String rankCode;
    /** Phòng ban chính ({@code user_departments.is_primary}), có thể null. */
    private String departmentName;
}
