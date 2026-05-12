package com.company.kpi.response.pm;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Điều kiện “cả team đã nộp KPI Member (individual/team) lên PM” trước khi PM được gửi đánh giá lên GM từng member.
 */
@Data
@Builder
public class PmPortfolioGateResponse {
    /** true khi không còn member nào có assignment individual/team với status dưới 501. */
    private boolean allPortfolioSubmittedToPm;
    private List<PmPortfolioGatePendingMemberResponse> pendingMembers;
}
