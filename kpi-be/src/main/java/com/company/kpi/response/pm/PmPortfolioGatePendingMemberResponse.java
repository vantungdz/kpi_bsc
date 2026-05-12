package com.company.kpi.response.pm;

import lombok.Data;

import java.util.UUID;

/** Member trong cây PM còn ít nhất một KPI Member (individual/team) chưa đạt trạng thái chờ PM (≥501). */
@Data
public class PmPortfolioGatePendingMemberResponse {
    private UUID userId;
    private String fullName;
}
