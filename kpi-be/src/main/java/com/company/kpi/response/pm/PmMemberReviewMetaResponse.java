package com.company.kpi.response.pm;

import lombok.Builder;
import lombok.Data;

/**
 * Nhận xét tổng (member + PM) tách portfolio vs promotion cho drawer Team Review.
 */
@Data
@Builder
public class PmMemberReviewMetaResponse {
    private String evaluationCommentsPortfolio;
    private String evaluationCommentsPromotion;
    private String supervisorCommentsPortfolio;
    private String supervisorCommentsPromotion;
}
