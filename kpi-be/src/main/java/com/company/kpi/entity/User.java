package com.company.kpi.entity;

import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
public class User {

    private UUID id;
    private String email;
    private String passwordHash;
    private String fullName;
    /** GM | PM | LEADER | MEMBER — mapped from roles.code via user_roles JOIN */
    private String role;
    private Boolean isActive;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
