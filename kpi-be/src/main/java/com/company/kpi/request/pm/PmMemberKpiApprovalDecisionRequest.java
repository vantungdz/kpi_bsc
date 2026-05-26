package com.company.kpi.request.pm;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class PmMemberKpiApprovalDecisionRequest {

    @NotNull
    private Integer year;

    @NotNull
    private UUID assignmentId;

    /** {@code true} → ASM 403 (chờ GM); {@code false} → ASM 406 (từ chối). */
    @NotNull
    private Boolean approve;

    /** Khi từ chối (406), PM phải nhập lý do để lưu vào {@code kpi_assignments.update_reason}. */
    @Size(max = 1000)
    private String rejectReason;

    /**
     * Khi từ chối một KPI trong drawer (không reject all): các assignment 402 khác cùng member → 404.
     */
    private Boolean resetDrawerSiblingsToPendingAcceptance;
}
