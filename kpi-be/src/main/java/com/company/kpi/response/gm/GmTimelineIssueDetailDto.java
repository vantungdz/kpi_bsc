package com.company.kpi.response.gm;

import lombok.Data;

/**
 * Một issue item — hiển thị trong drawer "View Issues" của Process Timeline.
 * Gồm tên KPI, tên các bên liên quan, bottleneck và lý do block.
 */
@Data
public class GmTimelineIssueDetailDto {
    private String kpi;
    private String pm;
    private String leader;   // null ở V1 — chưa join thêm cấp leader
    private String member;
    /** "Member" | "PM" | "GM" — vai trò đang block workflow. */
    private String bottleneck;
    /** Mô tả ngắn vì sao bị block. */
    private String reason;
}
