package com.company.kpi.entity;

import lombok.Data;

import java.util.UUID;

@Data
public class UserDepartment {
    private UUID userId;
    private UUID departmentId;
    private UUID supervisorId;
}
