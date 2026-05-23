package com.company.kpi.aggregate;

import lombok.Data;

import java.util.UUID;

/** User có ít nhất một {@code kpi_assignments} ASM không thuộc 404/406/407 trong chu kỳ. */
@Data
public class UserBlockingAssignmentRow {
    private UUID userId;
    private String fullName;
}
