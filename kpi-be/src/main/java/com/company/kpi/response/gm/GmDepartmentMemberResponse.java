package com.company.kpi.response.gm;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GmDepartmentMemberResponse {

    private UUID userId;
    private String fullName;
    private String email;
    /** {@code ranks.code} — có thể null. */
    private String rankCode;
}
