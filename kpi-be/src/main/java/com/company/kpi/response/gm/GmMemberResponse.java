package com.company.kpi.response.gm;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GmMemberResponse {

    private UUID userId;
    private String fullName;
    private String email;
    private String rankCode;
    private String roleCode;
    private String departmentId;
    private String departmentName;
    private Boolean departmentManager;
    private String managingDepartmentName;
    private String employmentStatus;
    private OffsetDateTime resignedAt;
}
