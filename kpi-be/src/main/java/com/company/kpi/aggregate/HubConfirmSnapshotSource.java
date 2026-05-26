package com.company.kpi.aggregate;

import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

/** Dữ liệu nguồn khi GM confirm giữa kỳ — lưu {@code evidences.approvedMidYearSnapshot}. */
@Data
public class HubConfirmSnapshotSource {
    private UUID id;
    private UUID cycleId;
    private UUID userId;
    private Integer statusCode;
    private BigDecimal midSelfScore;
    private String evidences;
}
