package com.company.kpi.request.kpi;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@Data
public class AssignMemberRequest {
    @NotNull
    private UUID kpiInformationId;

    @NotNull
    private UUID cycleId;

    // Used as reference for cascading assignment. If null, it means this is a direct assignment from PM to members.
    private UUID parentAssignmentId; 

    // Map include memberId as key and assigned target value as value. This is used for bulk assignment to multiple members.
    @NotNull
    private Map<UUID, BigDecimal> memberTargets; 
}