package com.company.kpi.aggregate;

import lombok.Data;

import java.util.UUID;

@Data
public class DeptMemberJoinRow {

    private UUID departmentId;
    private UUID userId;
    private String fullName;
    private String email;
    private String rankCode;
}

