package com.company.kpi.entity;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class RefreshToken {

    private UUID id;
    private UUID userId;
    private String token;
    private OffsetDateTime expiresAt;
    private Boolean revoked;
    private OffsetDateTime createdAt;
}
