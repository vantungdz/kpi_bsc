package com.company.kpi.entity;

import lombok.Data;

import java.util.UUID;

import com.company.kpi.entity.base.BaseEntity;

@Data
public class User extends BaseEntity {
     private UUID id;
    /** Chức danh — cần khi insert {@code kpi_assignments} (README Flow 3). */
    private String username;
    private String email;
    private String passwordHash;
    private String fullName;
    /** GM | PM | LEADER | MEMBER — mapped from roles.code via user_roles JOIN */
    private String role;
    private UUID jobTitleId;
    private Boolean isActive;
}
