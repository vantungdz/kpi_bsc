package com.company.kpi.response.gm;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

/** User có thể thêm vào phòng ban — chưa có dòng {@code user_departments} cho phòng đó. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GmDepartmentMemberCandidateResponse {

    private UUID userId;
    private String fullName;
    private String email;
    /** {@code ranks.code} — có thể null. */
    private String rankCode;
    /** Nhãn chức danh (vd. job family · job title) — có thể null. */
    private String jobTitleLabel;
    private String employmentStatus;
    private OffsetDateTime resignedAt;
}
